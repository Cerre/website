"use client";

import { useEffect, useRef, useState } from "react";

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? "https://stream.filipcederquist.com";

// The mixer's frame is 1280x720; the small picture's place is given in those pixels.
const W = 1280;
const H = 720;

type Source = "screen" | "cam";

const button =
  "rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900";
const buttonOn = "rounded-full border border-accent bg-accent px-4 py-1.5 text-sm font-medium text-white";

/** Layout command for the mixer: "swap", "toggle cam", "size 360", "move 900 500", ... */
function command(cmd: string) {
  return fetch("/api/stream/command", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd }),
  });
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

export default function StreamBoard() {
  const [sending, setSending] = useState<Record<Source, boolean>>({ screen: false, cam: false });
  const [error, setError] = useState("");
  // Our copy of the small picture's place (same start values as the mixer)
  const [box, setBox] = useState({ x: 940, y: 520, w: 320 });
  const peers = useRef<Partial<Record<Source, { pc: RTCPeerConnection; stream: MediaStream }>>>({});
  const pad = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(box);
  latest.current = box;

  const stop = (source: Source) => {
    const peer = peers.current[source];
    if (!peer) return;
    peer.pc.close();
    peer.stream.getTracks().forEach((t) => t.stop());
    delete peers.current[source];
    setSending((s) => ({ ...s, [source]: false }));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => () => (["screen", "cam"] as Source[]).forEach(stop), []);

  const resize = (w: number) => {
    w = Math.min(Math.max(w, 80), W);
    setBox((b) => ({ ...b, w }));
    command(`size ${w}`);
  };

  // Drag: center the small picture on the pointer. Send at most one move per 50 ms.
  const moveTo = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const s = W / r.width;
    const { w } = latest.current;
    const x = Math.round((e.clientX - r.left) * s - w / 2);
    const y = Math.round((e.clientY - r.top) * s - (w * 9) / 32);
    setBox({ x, y, w });
    moveTimer.current ??= setTimeout(() => {
      command(`move ${latest.current.x} ${latest.current.y}`);
      moveTimer.current = null;
    }, 50);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={sending.screen ? buttonOn : button} onClick={() => toggleSend("screen")}>
          {sending.screen ? "Stop screen" : "Share screen"}
        </button>
        <button className={sending.cam ? buttonOn : button} onClick={() => toggleSend("cam")}>
          {sending.cam ? "Stop camera" : "Start camera + mic"}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={`${STREAM_URL}/live/?controls=false&muted=true&autoplay=true`}
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
        <button className={button} onClick={() => command("swap")}>Swap</button>
        <button className={button} onClick={() => resize(box.w - 40)}>Smaller</button>
        <button className={button} onClick={() => resize(box.w + 40)}>Bigger</button>
        <button className={button} onClick={() => command("toggle screen")}>Screen on/off</button>
        <button className={button} onClick={() => command("toggle cam")}>Cam on/off</button>
        <button className={button} onClick={() => command("toggle mic")}>Mic on/off</button>
      </div>
      <p className="text-sm text-zinc-500">
        Drag on the video to move the small picture. The yellow box shows where it goes; the video follows about a
        second later.
      </p>
    </div>
  );
}
