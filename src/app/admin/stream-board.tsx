"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { whip, type Session } from "@/lib/webrtc";
import { clamp, DEFAULT_LAYOUT, Mixer, W, type Layout, type Source } from "./stream/mixer";
import { startTestSource } from "./stream/test-source";

const button =
  "rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900";

/** Output sizes and the most the encoder may send for each. */
const RESOLUTIONS = { 1080: { width: 1920, bitrate: 4_500_000 }, 720: { width: 1280, bitrate: 2_500_000 } };
type Resolution = keyof typeof RESOLUTIONS;

const capture: Record<Source, () => Promise<MediaStream>> = {
  // As sharp as the screen allows up to 1080p, so text stays readable
  screen: () =>
    navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: 30 } }),
  // Camera plus mic; without a mic (or if it's refused), the camera alone
  cam: () => {
    const video = { width: 1280, height: 720, frameRate: 30 };
    return navigator.mediaDevices
      .getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } })
      .catch(() => navigator.mediaDevices.getUserMedia({ video }));
  },
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
  const mixer = useRef<Mixer | null>(null);
  const captured = useRef<Partial<Record<Source, MediaStream>>>({});
  const session = useRef<Session | null>(null);
  const stopTest = useRef<(() => void) | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const [sharing, setSharing] = useState<Record<Source, boolean>>({ screen: false, cam: false });
  const [test, setTest] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  // The test source: always in development, in production with ?test=1
  const testAllowed = useSyncExternalStore(
    () => () => {},
    () => process.env.NODE_ENV === "development" || new URLSearchParams(window.location.search).has("test"),
    () => false
  );
  const [resolution, setResolution] = useState<Resolution>(1080);
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previewSound, setPreviewSound] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");

  // One mixer for the page's life; its canvas is the preview
  useEffect(() => {
    const m = new Mixer(RESOLUTIONS[1080].width);
    mixer.current = m;
    m.canvas.className = "absolute inset-0 h-full w-full";
    preview.current!.prepend(m.canvas);
    const streams = captured.current;
    return () => {
      session.current?.stop();
      stopTest.current?.();
      Object.values(streams).forEach((s) => s?.getTracks().forEach((t) => t.stop()));
      m.canvas.remove();
      m.close();
    };
  }, []);

  // Watch the frame rate while live: a background tab may slow the browser down
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSlow((mixer.current?.fps ?? 30) < 20), 1000);
    return () => clearInterval(id);
  }, [live]);

  /** Change the layout; it takes effect on the next frame. */
  const change = (l: Partial<Layout>) => {
    mixer.current!.setLayout(l);
    setLayout(mixer.current!.layout);
  };

  const stopSharing = (source: Source) => {
    captured.current[source]?.getTracks().forEach((t) => t.stop());
    delete captured.current[source];
    mixer.current!.setSource(source, null);
    if (source === "cam") {
      mixer.current!.setMic(null);
      setMicStream(null);
    }
    setSharing((s) => ({ ...s, [source]: false }));
  };

  const toggleSharing = async (source: Source) => {
    if (captured.current[source]) return stopSharing(source);
    setError("");
    mixer.current!.audio.resume(); // the AudioContext may only start after a click
    try {
      const stream = await capture[source]();
      // "Stop sharing" in the browser's own bar
      stream.getVideoTracks()[0].onended = () => stopSharing(source);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      captured.current[source] = stream;
      mixer.current!.setSource(source, video);
      if (source === "cam") {
        const mic = stream.getAudioTracks();
        if (mic.length) {
          mixer.current!.setMic(new MediaStream(mic));
          setMicStream(stream);
        } else setError("No mic: the camera is on without sound");
      }
      setSharing((s) => ({ ...s, [source]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleTest = () => {
    if (stopTest.current) {
      stopTest.current();
      stopTest.current = null;
      setTest(false);
      return;
    }
    (["screen", "cam"] as Source[]).forEach(stopSharing);
    mixer.current!.audio.resume();
    stopTest.current = startTestSource(mixer.current!);
    setTest(true);
  };

  const goLive = async () => {
    setError("");
    setStarting(true);
    mixer.current!.audio.resume();
    try {
      const res = await fetch("/api/stream/token", { method: "POST", credentials: "include" });
      if (res.status === 409) throw new Error("Already live from another tab or device. End that stream first (after a crash, the old one lingers for about 30 seconds).");
      if (!res.ok) throw new Error(`Could not get a send token (${res.status})`);
      const { token } = await res.json();
      const s = await whip("live", mixer.current!.output, token, RESOLUTIONS[resolution].bitrate);
      s.pc.onconnectionstatechange = () => {
        if (s.pc.connectionState === "failed") {
          s.stop();
          session.current = null;
          setLive(false);
          setError("The connection to the media server was lost. Go live again to continue.");
        }
      };
      session.current = s;
      setLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const endStream = () => {
    session.current?.stop();
    session.current = null;
    setLive(false);
  };

  const changeResolution = (r: Resolution) => {
    mixer.current!.resize(RESOLUTIONS[r].width);
    setResolution(r);
  };

  // Drag: center the small picture on the pointer, inside the frame
  const moveTo = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const s = W / r.width;
    const w = mixer.current!.layout.w;
    change(clamp({ x: (e.clientX - r.left) * s - w / 2, y: (e.clientY - r.top) * s - (w * 9) / 32, w }));
  };
  const resize = (w: number) => change(clamp({ ...layout, w }));

  const anySource = sharing.screen || sharing.cam || test;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Screen share" on={sharing.screen} disabled={test} onClick={() => toggleSharing("screen")} />
        <Toggle label="Camera + mic" on={sharing.cam} disabled={test} onClick={() => toggleSharing("cam")} />
        {testAllowed && <Toggle label="Test source" on={test} onClick={toggleTest} />}
        <span className="ml-auto flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 text-sm font-medium ${live ? "text-red-500" : "text-zinc-500"}`}>
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-red-500" : "bg-zinc-400"}`} />
            {live ? "Live" : "Offline"}
          </span>
          {live ? (
            <button className={button} onClick={endStream}>End stream</button>
          ) : (
            <button
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              disabled={starting || !anySource}
              onClick={goLive}
            >
              {starting ? "Starting…" : "Go live"}
            </button>
          )}
        </span>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {live && slow && (
        <p className="text-sm text-amber-500">
          The browser is slowing the stream down. Keep this tab visible, in its own window if you work in another.
        </p>
      )}

      <div ref={preview} className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {!anySource && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            Turn on a screen share or the camera to see the preview.
          </p>
        )}
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
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Screen" on={layout.screen} onClick={() => change({ screen: !layout.screen })} />
        <Toggle label="Cam" on={layout.cam} onClick={() => change({ cam: !layout.cam })} />
        <Toggle label="Mic" on={layout.mic} onClick={() => change({ mic: !layout.mic })} />
        {micStream && <MicMeter stream={micStream} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} onClick={() => change({ swap: !layout.swap })}>Swap big/small</button>
        <button className={button} onClick={() => resize(layout.w - 40)}>Smaller</button>
        <button className={button} onClick={() => resize(layout.w + 40)}>Bigger</button>
        <Toggle
          label="Preview sound"
          on={previewSound}
          onClick={() => {
            mixer.current!.setPreviewSound(!previewSound);
            setPreviewSound(!previewSound);
          }}
        />
        <select
          className="rounded-full border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
          value={resolution}
          disabled={live}
          title={live ? "Change the quality before going live" : "Stream quality"}
          onChange={(e) => changeResolution(Number(e.target.value) as Resolution)}
        >
          <option value={1080}>1080p</option>
          <option value={720}>720p</option>
        </select>
      </div>
      <p className="text-sm text-zinc-500">
        The preview is exactly what viewers get, mixed here in your browser. Drag on it to move the small picture.
        With only one source on, it fills the frame. Preview sound plays the mix on this computer, so use headphones
        while talking.
      </p>
    </div>
  );
}
