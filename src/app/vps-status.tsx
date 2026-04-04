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

export function SpotifyNowPlaying() {
  const [spotify, setSpotify] = useState<SpotifyTrack | null>(null);

  useEffect(() => {
    fetch("/api/spotify/now-playing")
      .then((r) => r.json())
      .then(setSpotify)
      .catch(() => {});
  }, []);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/spotify/now-playing")
        .then((r) => r.json())
        .then(setSpotify)
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!spotify || !spotify.track) return null;

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <dt className="text-xs text-zinc-400 mb-3">
        {spotify.is_playing ? "Now playing" : "Last played"}
      </dt>
      <a
        href={spotify.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 group"
      >
        {spotify.album_art && (
          <img
            src={spotify.album_art}
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
