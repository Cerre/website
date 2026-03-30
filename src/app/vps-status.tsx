"use client";

import { useState, useEffect } from "react";

const API_URL = "/api";

interface Status {
  status: string;
  uptime_seconds: number;
  server_time: string;
  message: string;
}

interface Now {
  working_on: string;
  learning: string;
}

interface SpotifyTrack {
  is_playing: boolean;
  track: string | null;
  artist: string | null;
  album: string | null;
  album_art: string | null;
  url: string | null;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SpotifyNowPlaying({ track }: { track: SpotifyTrack }) {
  if (!track.track) {
    return (
      <div className="text-sm text-zinc-400">
        Nothing played recently
      </div>
    );
  }

  return (
    <a
      href={track.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 group"
    >
      {track.album_art && (
        <img
          src={track.album_art}
          alt={track.album ?? "Album art"}
          width={48}
          height={48}
          className="rounded-md shadow-sm"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
          {track.track}
        </p>
        <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
      </div>
      {track.is_playing && (
        <div className="flex items-end gap-0.5 h-4" aria-label="Now playing">
          <span className="w-0.5 animate-[bounce_1s_ease-in-out_infinite] bg-accent rounded-full h-2" />
          <span className="w-0.5 animate-[bounce_1s_ease-in-out_0.2s_infinite] bg-accent rounded-full h-3" />
          <span className="w-0.5 animate-[bounce_1s_ease-in-out_0.4s_infinite] bg-accent rounded-full h-1.5" />
        </div>
      )}
    </a>
  );
}

export function VpsStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState<Now | null>(null);
  const [spotify, setSpotify] = useState<SpotifyTrack | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/status`).then((r) => r.json()),
      fetch(`${API_URL}/now`).then((r) => r.json()),
      fetch(`${API_URL}/spotify/now-playing`).then((r) => r.json()).catch(() => null),
    ])
      .then(([s, n, sp]) => {
        setStatus(s);
        setNow(n);
        setSpotify(sp);
      })
      .catch(() => setError(true));
  }, []);

  // Poll Spotify every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_URL}/spotify/now-playing`)
        .then((r) => r.json())
        .then(setSpotify)
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" />
          VPS offline
        </div>
      </div>
    );
  }

  if (!status || !now) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-medium">VPS Online</span>
        <span className="text-zinc-400">
          &middot; uptime {formatUptime(status.uptime_seconds)}
        </span>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-400">Working on</dt>
          <dd className="mt-1">{now.working_on}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Learning</dt>
          <dd className="mt-1">{now.learning}</dd>
        </div>
      </dl>

      {/* Spotify */}
      <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <dt className="text-xs text-zinc-400 mb-3">
          {spotify?.is_playing ? "Now playing" : "Last played"}
        </dt>
        {spotify ? (
          <SpotifyNowPlaying track={spotify} />
        ) : (
          <div className="h-12 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        )}
      </div>
    </div>
  );
}
