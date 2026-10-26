"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { whep, type Session } from "@/lib/webrtc";
import { copyWhenReady, grayPixels, readBox, MAX_PIXELS, MIN_SIDE, type Box } from "@/lib/ocr";

const RETRY_MS = 3000;
const SUSPEND_AFTER_MS = 60_000; // a long pause stops downloading the stream

type Read = { state: "reading" } | { state: "done"; text: string } | { state: "error"; message: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Plays `live` over WebRTC in our own video element; offline, it tries again every few seconds.
 *  Pausing freezes the frame (and the sound); dragging a box over it reads the text there. */
export default function LivePlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLCanvasElement>(null);
  const player = useRef<{ connect: () => void; suspend: () => void } | null>(null);
  const suspended = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const readId = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false); // connected comes a moment before the first frame
  const [muted, setMuted] = useState(true); // browsers only autoplay muted
  const [paused, setPaused] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [size, setSize] = useState({ w: 1, h: 1 }); // the frozen frame, in stream pixels
  const [box, setBox] = useState<Box | null>(null); // in stream pixels
  const [read, setRead] = useState<Read | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let session: Session | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const offline = () => {
      session?.stop();
      session = null;
      setPlaying(false);
      setReconnecting(false);
      if (!closed && !suspended.current) retry = setTimeout(connect, RETRY_MS);
    };

    const connect = async () => {
      try {
        session = await whep("live", (stream) => {
          video.current!.srcObject = stream;
        });
        if (closed) return session.stop();
        session.pc.onconnectionstatechange = () => {
          const state = session?.pc.connectionState;
          if (state === "connected") {
            setPlaying(true);
            setReconnecting(false);
          }
          if (state === "failed" || state === "disconnected" || state === "closed") offline();
        };
      } catch {
        offline(); // not live right now (404), or the server is unreachable
      }
    };

    player.current = {
      connect: () => {
        clearTimeout(retry);
        if (!session) connect();
      },
      // stop downloading while a viewer stays paused; close() fires no state change
      suspend: () => {
        clearTimeout(retry);
        session?.stop();
        session = null;
        setPlaying(false);
      },
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      session?.stop();
    };
  }, []);

  const pause = () => {
    const v = video.current!;
    const c = frame.current!;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d", { willReadFrequently: true })!.drawImage(v, 0, 0);
    setSize({ w: c.width, h: c.height });
    setBox(null);
    setRead(null);
    setPaused(true);
  };

  const resume = useCallback(() => {
    readId.current++; // a read still on its way is no longer wanted
    setPaused(false);
    setBox(null);
    setRead(null);
    if (suspended.current) {
      suspended.current = false;
      setReconnecting(true);
      player.current?.connect();
    }
  }, []);

  useEffect(() => {
    if (!paused) return;
    const suspend = setTimeout(() => {
      suspended.current = true;
      player.current?.suspend();
    }, SUSPEND_AFTER_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && resume();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(suspend);
      window.removeEventListener("keydown", onKey);
    };
  }, [paused, resume]);

  /** Pointer position in stream pixels; the canvas is scaled to fit the player (object-contain). */
  const toFrame = (e: React.PointerEvent) => {
    const c = frame.current!;
    const r = c.getBoundingClientRect();
    const scale = Math.min(r.width / c.width, r.height / c.height);
    const left = r.left + (r.width - c.width * scale) / 2;
    const top = r.top + (r.height - c.height * scale) / 2;
    return {
      x: clamp(Math.round((e.clientX - left) / scale), 0, c.width),
      y: clamp(Math.round((e.clientY - top) / scale), 0, c.height),
    };
  };

  const boxFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  const readText = (b: Box) => {
    if (b.w < MIN_SIDE || b.h < MIN_SIDE) return setBox(null); // a click, not a drag
    if (b.w * b.h > MAX_PIXELS) {
      return setRead({ state: "error", message: "That box is too large. Select a smaller area." });
    }
    const id = ++readId.current;
    setRead({ state: "reading" });
    setCopied(false);
    const reading = readBox(grayPixels(frame.current!, b), b.w, b.h);
    copyWhenReady(reading).then((ok) => id === readId.current && setCopied(ok));
    reading.then(
      (text) => id === readId.current && setRead({ state: "done", text }),
      (e: Error) => id === readId.current && setRead({ state: "error", message: e.message }),
    );
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const overlayButton =
    "absolute rounded-full bg-black/70 px-4 py-1.5 text-sm font-medium text-white hover:bg-black/90";

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video
          ref={video}
          autoPlay
          playsInline
          muted={muted || paused}
          // Chrome reports a 2x2 placeholder until the first keyframe is decoded
          onResize={(e) => setHasFrame(e.currentTarget.videoWidth >= 320)}
          onEmptied={() => setHasFrame(false)}
          className="h-full w-full"
        />
        <canvas
          ref={frame}
          className={`absolute inset-0 h-full w-full cursor-crosshair touch-none object-contain ${paused ? "" : "hidden"}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragStart.current = toFrame(e);
            setBox(null);
          }}
          onPointerMove={(e) => dragStart.current && setBox(boxFrom(dragStart.current, toFrame(e)))}
          onPointerUp={(e) => {
            if (!dragStart.current) return;
            const b = boxFrom(dragStart.current, toFrame(e));
            dragStart.current = null;
            setBox(b);
            readText(b);
          }}
        />
        {paused && box && (
          <div
            className="pointer-events-none absolute border-2 border-amber-400 bg-amber-400/10"
            style={{ left: pct(box.x, size.w), top: pct(box.y, size.h), width: pct(box.w, size.w), height: pct(box.h, size.h) }}
          />
        )}
        {!playing && !paused && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            {reconnecting ? "Reconnecting…" : "Offline. This starts by itself when I go live."}
          </p>
        )}
        {playing && !paused && muted && (
          <button onClick={() => setMuted(false)} className={`${overlayButton} bottom-4 left-4`}>
            Tap to unmute
          </button>
        )}
        {playing && hasFrame && !paused && (
          <button onClick={pause} className={`${overlayButton} bottom-4 right-4`}>
            Pause to copy text
          </button>
        )}
        {paused && (
          <button onClick={resume} className={`${overlayButton} top-4 right-4`}>
            Back to live
          </button>
        )}
      </div>

      {paused && (
        <div className="mt-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          {!read && (
            <p className="text-zinc-500">Drag a box over text to copy it to your clipboard. Esc goes back to live.</p>
          )}
          {read?.state === "reading" && <p className="text-zinc-500">Reading…</p>}
          {read?.state === "error" && <p className="text-amber-600 dark:text-amber-400">{read.message}</p>}
          {read?.state === "done" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <textarea
                aria-label="Text from the box"
                value={read.text}
                onChange={(e) => {
                  setRead({ state: "done", text: e.target.value });
                  setCopied(false); // the clipboard has the text as it was read
                }}
                rows={Math.min(8, Math.max(1, read.text.split("\n").length))}
                className="w-full resize-y rounded border border-zinc-300 bg-transparent p-2 font-mono text-base sm:text-sm dark:border-zinc-700"
                placeholder="No text found in that box."
              />
              <button
                onClick={() => copy(read.text)}
                disabled={!read.text}
                className="shrink-0 rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
