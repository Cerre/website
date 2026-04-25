"use client";

import { useState, useEffect } from "react";

interface SpotifyTrack {
  is_playing: boolean;
  track: string | null;
  artist: string | null;
  album: string | null;
  album_art: string | null;
  url: string | null;
}

const POLL_MS = 30_000;

function safeSpotifyUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    if (parsed.hostname !== "open.spotify.com") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function safeAlbumArt(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    if (!parsed.hostname.endsWith(".scdn.co")) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function SpotifyNowPlaying() {
  const [spotify, setSpotify] = useState<SpotifyTrack | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const r = await fetch("/api/spotify/now-playing", {
          signal: controller.signal,
        });
        if (!r.ok) return;
        const data = (await r.json()) as SpotifyTrack;
        setSpotify(data);
      } catch {
        // ignore aborts and network errors
      }
    };

    load();
    const interval = setInterval(load, POLL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (!spotify || !spotify.track) return null;

  const trackUrl = safeSpotifyUrl(spotify.url);
  const artUrl = safeAlbumArt(spotify.album_art);

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <dt className="text-xs text-zinc-400 mb-3">
        {spotify.is_playing ? "Now playing" : "Last played"}
      </dt>
      <a
        href={trackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 group"
      >
        {artUrl && (
          <img
            src={artUrl}
            alt={spotify.album ?? "Album art"}
            width={48}
            height={48}
            className="rounded-md shadow-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
            {spotify.track}
          </p>
          <p className="text-xs text-zinc-400 truncate">{spotify.artist}</p>
        </div>
        {spotify.is_playing && (
          <div className="flex items-end gap-0.5 h-4" aria-label="Now playing">
            <span className="w-0.5 animate-[bounce_1s_ease-in-out_infinite] bg-accent rounded-full h-2" />
            <span className="w-0.5 animate-[bounce_1s_ease-in-out_0.2s_infinite] bg-accent rounded-full h-3" />
            <span className="w-0.5 animate-[bounce_1s_ease-in-out_0.4s_infinite] bg-accent rounded-full h-1.5" />
          </div>
        )}
      </a>
    </div>
  );
}
