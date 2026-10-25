"use client";

import { useEffect, useRef, useState } from "react";
import { whep, type Session } from "@/lib/webrtc";

const RETRY_MS = 3000;

/** Plays `live` over WebRTC in our own video element; offline, it tries again every few seconds. */
export default function LivePlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // browsers only autoplay muted

  useEffect(() => {
    let session: Session | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    const offline = () => {
      session?.stop();
      session = null;
      setPlaying(false);
      if (!closed) retry = setTimeout(connect, RETRY_MS);
    };

    const connect = async () => {
      try {
        session = await whep("live", (stream) => {
          video.current!.srcObject = stream;
        });
        if (closed) return session.stop();
        session.pc.onconnectionstatechange = () => {
          const state = session?.pc.connectionState;
          if (state === "connected") setPlaying(true);
          if (state === "failed" || state === "disconnected" || state === "closed") offline();
        };
      } catch {
        offline(); // not live right now (404), or the server is unreachable
      }
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      session?.stop();
    };
  }, []);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      <video ref={video} autoPlay playsInline muted={muted} className="h-full w-full" />
      {!playing && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
          Offline. This starts by itself when I go live.
        </p>
      )}
      {playing && muted && (
        <button
          onClick={() => setMuted(false)}
          className="absolute bottom-4 left-4 rounded-full bg-black/70 px-4 py-1.5 text-sm font-medium text-white hover:bg-black/90"
        >
          🔇 Tap to unmute
        </button>
      )}
    </div>
  );
}
