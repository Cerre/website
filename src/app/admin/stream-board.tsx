"use client";

import { useEffect, useRef, useState } from "react";

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? "https://stream.filipcederquist.com";

// The mixer's frame is 1280x720; the small picture's place is given in those pixels.
const W = 1280;
const H = 720;
const MIN_W = 80;

type Source = "screen" | "cam";

/** The mixer's layout, as the control service keeps it. */
type Layout = { swap: boolean; screen: boolean; cam: boolean; mic: boolean; x: number; y: number; w: number };
type Box = Pick<Layout, "x" | "y" | "w">;

const button =
  "rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900";

/** Keep the small picture inside the frame (control does the same). */
function clamp({ x, y, w }: Box): Box {
  w = Math.min(Math.max(Math.round(w), MIN_W), W);
  return {
    w,
    x: Math.min(Math.max(Math.round(x), 0), W - w),
    y: Math.min(Math.max(Math.round(y), 0), H - Math.floor((w * 9) / 16)),
  };
}

/** Layout command for the mixer: "swap", "mic off", "size 360", "move 900 500", ... Returns the new layout. */
async function command(cmd: string): Promise<Layout> {
  const res = await fetch("/api/stream/command", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd }),
  });
  if (!res.ok) throw new Error(`The mixer refused "${cmd}" (${res.status})`);
  return res.json();
}

/** Send a stream to the media server with WHIP: one POST with our offer, the answer comes back. */
async function publish(path: Source, stream: MediaStream): Promise<RTCPeerConnection> {
  const tokenRes = await fetch("/api/stream/token", { method: "POST", credentials: "include" });
  if (!tokenRes.ok) throw new Error(`Could not get a send token (${tokenRes.status})`);
  const { token } = await tokenRes.json();

  const pc = new RTCPeerConnection();
  const video = pc.addTransceiver(stream.getVideoTracks()[0], { direction: "sendonly" });
  // The mixer reads H.264 only, so offer nothing else
  const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs ?? [];
  video.setCodecPreferences(codecs.filter((c) => c.mimeType === "video/H264"));
  // The mic, if any, goes along as a second track
  stream.getAudioTracks().forEach((t) => pc.addTransceiver(t, { direction: "sendonly" }));

  await pc.setLocalDescription(await pc.createOffer());
  // Wait for our network addresses so they all go in the one offer
  await new Promise<void>((done) => {
    if (pc.iceGatheringState === "complete") return done();
    pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && done();
    setTimeout(done, 2000);
  });

  const res = await fetch(`${STREAM_URL}/${path}/whip`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${token}` },
    body: pc.localDescription!.sdp,
  });
  if (!res.ok) {
    pc.close();
    throw new Error(`The media server refused ${path} (${res.status})`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  return pc;
}

const video = { width: 1280, height: 720, frameRate: 30 };
const capture: Record<Source, () => Promise<MediaStream>> = {
  // 720p: what the mixer outputs anyway, and much lighter for it than 1080p
  screen: () => navigator.mediaDevices.getDisplayMedia({ video }),
  // Camera plus mic; without a mic (or if it's refused), the camera alone
  cam: () =>
    navigator.mediaDevices
      .getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } })
      .catch(() => navigator.mediaDevices.getUserMedia({ video })),
};

/** An on/off switch that says which it is: a dot and "on"/"off", filled while on. */
function Toggle({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        on
          ? "border-accent bg-accent text-white"
          : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : "bg-zinc-400"}`} />
      {label}: {on ? "on" : "off"}
    </button>
  );
}

/** How loud the mic is right now, read in the browser before anything is sent. Flat means a muted mic. */
function MicMeter({ stream }: { stream: MediaStream }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = requestAnimationFrame(function draw() {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
      // -60 dB (silence) to 0 dB (full scale) across the bar
      const level = Math.min(Math.max((20 * Math.log10(rms || 1e-6) + 60) / 60, 0), 1);
      if (bar.current) bar.current.style.width = `${level * 100}%`;
      frame = requestAnimationFrame(draw);
    });
    return () => {
      cancelAnimationFrame(frame);
      ctx.close();
    };
  }, [stream]);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-500" title="Your mic, as the browser hears it">
      Mic level
      <span className="h-2 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span ref={bar} className="block h-full w-0 bg-green-500 transition-[width] duration-75" />
      </span>
    </span>
  );
}

export default function StreamBoard() {
  const [sending, setSending] = useState<Record<Source, boolean>>({ screen: false, cam: false });
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [previewSound, setPreviewSound] = useState(false);
  const [error, setError] = useState("");
  // Our copy of the small picture's place, so dragging doesn't wait for the server
  const [box, setBox] = useState<Box>({ x: 940, y: 520, w: 320 });
  const peers = useRef<Partial<Record<Source, { pc: RTCPeerConnection; stream: MediaStream }>>>({});
  const pad = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const moving = useRef(false); // a move is on its way to the mixer
  const moveAgain = useRef(false); // the box moved again meanwhile
  const latest = useRef(box); // the box right now, for code that runs between renders
  const place = (b: Box) => {
    latest.current = b;
    setBox(b);
  };

  // The layout lives on the server and outlasts this page: start from it
  useEffect(() => {
    fetch("/api/stream/state", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Could not load the layout (${res.status})`))))
      .then((l: Layout) => {
        setLayout(l);
        place({ x: l.x, y: l.y, w: l.w });
      })
      .catch((e) => setError(e.message));
  }, []);

  /** Send a command; the reply is the whole layout. The box is ours while dragging. */
  const send = async (cmd: string) => {
    try {
      const l = await command(cmd);
      setLayout(l);
      setError((e) => (e.startsWith("The mixer") ? "" : e)); // it answers again
      if (!dragging.current) place({ x: l.x, y: l.y, w: l.w });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stop = (source: Source) => {
    const peer = peers.current[source];
    if (!peer) return;
    peer.pc.close();
    peer.stream.getTracks().forEach((t) => t.stop());
    delete peers.current[source];
    setSending((s) => ({ ...s, [source]: false }));
    if (source === "cam") setMicStream(null);
  };

  const toggleSend = async (source: Source) => {
    if (peers.current[source]) return stop(source);
    setError("");
    try {
      const stream = await capture[source]();
      // "Stop sharing" in the browser's own bar
      stream.getVideoTracks()[0].onended = () => stop(source);
      peers.current[source] = { pc: await publish(source, stream), stream };
      setSending((s) => ({ ...s, [source]: true }));
      if (source === "cam") {
        if (stream.getAudioTracks().length) setMicStream(stream);
        else setError("No mic: the camera is sending without sound");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => () => (["screen", "cam"] as Source[]).forEach(stop), []);

  const resize = (w: number) => {
    const b = clamp({ ...latest.current, w });
    place(b);
    send(`size ${b.w}`);
  };

  /** Send the box's place, one move at a time: while one is on its way, later positions
   *  collapse into a single move of wherever the box is when it's back. A slow link then
   *  means fewer moves, not a growing queue. */
  const sendMove = async () => {
    if (moving.current) {
      moveAgain.current = true;
      return;
    }
    moving.current = true;
    do {
      moveAgain.current = false;
      // Read the place only now, after the previous move came back
      await send(`move ${latest.current.x} ${latest.current.y}`);
    } while (moveAgain.current);
    moving.current = false;
  };

  // Drag: center the small picture on the pointer, inside the frame.
  const moveTo = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const s = W / r.width;
    const { w } = latest.current;
    const b = clamp({ x: (e.clientX - r.left) * s - w / 2, y: (e.clientY - r.top) * s - (w * 9) / 32, w });
    place(b);
    sendMove();
  };

  const live = sending.screen || sending.cam;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Screen share" on={sending.screen} onClick={() => toggleSend("screen")} />
        <Toggle label="Camera + mic" on={sending.cam} onClick={() => toggleSend("cam")} />
        <span className={`ml-auto inline-flex items-center gap-2 text-sm font-medium ${live ? "text-red-500" : "text-zinc-500"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-red-500" : "bg-zinc-400"}`} />
          {live ? "Live" : "Offline"}
        </span>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          key={previewSound ? "sound" : "muted"}
          src={`${STREAM_URL}/live/?controls=false&muted=${!previewSound}&autoplay=true`}
          allow="autoplay"
          title="Live preview"
          className="absolute inset-0 h-full w-full border-0"
        />
        <div
          ref={pad}
          className="absolute inset-0 cursor-grab touch-none"
          onPointerDown={(e) => {
            dragging.current = true;
            pad.current!.setPointerCapture(e.pointerId);
            moveTo(e);
          }}
          onPointerMove={(e) => dragging.current && moveTo(e)}
          onPointerUp={() => (dragging.current = false)}
        >
          <div
            className="pointer-events-none absolute border-2 border-dashed border-amber-400"
            style={{
              left: `${(box.x / W) * 100}%`,
              top: `${(box.y / H) * 100}%`,
              width: `${(box.w / W) * 100}%`,
              height: `${((box.w * 9) / 16 / H) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Screen" on={layout?.screen ?? true} disabled={!layout} onClick={() => send(`screen ${layout?.screen ? "off" : "on"}`)} />
        <Toggle label="Cam" on={layout?.cam ?? true} disabled={!layout} onClick={() => send(`cam ${layout?.cam ? "off" : "on"}`)} />
        <Toggle label="Mic" on={layout?.mic ?? true} disabled={!layout} onClick={() => send(`mic ${layout?.mic ? "off" : "on"}`)} />
        {micStream && <MicMeter stream={micStream} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={!layout} onClick={() => send("swap")}>Swap big/small</button>
        <button className={button} disabled={!layout} onClick={() => resize(box.w - 40)}>Smaller</button>
        <button className={button} disabled={!layout} onClick={() => resize(box.w + 40)}>Bigger</button>
        <Toggle label="Preview sound" on={previewSound} onClick={() => setPreviewSound((p) => !p)} />
      </div>
      <p className="text-sm text-zinc-500">
        Drag on the video to move the small picture. The yellow box shows where it goes; the video follows about a
        second later. With only one source on, it fills the frame. Preview sound plays the stream back about a
        second late, so use headphones while talking.
      </p>
    </div>
  );
}
