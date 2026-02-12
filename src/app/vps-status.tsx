"use client";

import { useState, useEffect } from "react";

const API_URL = "http://136.244.53.103";

interface Status {
  status: string;
  uptime_seconds: number;
  server_time: string;
  message: string;
}

interface Now {
  working_on: string;
  learning: string;
  listening_to: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function VpsStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState<Now | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/status`).then((r) => r.json()),
      fetch(`${API_URL}/now`).then((r) => r.json()),
    ])
      .then(([s, n]) => {
        setStatus(s);
        setNow(n);
      })
      .catch(() => setError(true));
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
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-400">Working on</dt>
          <dd className="mt-1">{now.working_on}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Learning</dt>
          <dd className="mt-1">{now.learning}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Listening to</dt>
          <dd className="mt-1">{now.listening_to}</dd>
        </div>
      </dl>
    </div>
  );
}
