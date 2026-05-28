"use client";

import { useState } from "react";

interface SearchResult {
  video_id: string;
  title: string;
  start_seconds: number;
  snippet: string;
  score: number;
  url: string;
}

type Status = "idle" | "loading" | "ready" | "unavailable" | "error";

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function PiSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setStatus("loading");
    try {
      const res = await fetch(`/api/pi/search?q=${encodeURIComponent(q)}`, {
        credentials: "include",
      });
      if (res.status === 503) {
        setResults([]);
        setStatus("unavailable");
        return;
      }
      if (!res.ok) {
        setResults([]);
        setStatus("error");
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setStatus("ready");
    } catch {
      setResults([]);
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">Transcript search</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Semantic search over your YouTube transcript corpus.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a moment…"
          className="flex-1 rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
        />
        <button
          type="submit"
          disabled={status === "loading" || !query.trim()}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-4">
        {status === "unavailable" && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Search is unavailable right now. Try again shortly.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-500">
            Something went wrong with that search.
          </p>
        )}
        {status === "ready" && results.length === 0 && (
          <p className="text-sm text-zinc-500">No matches found.</p>
        )}

        {results.length > 0 && (
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li key={`${r.video_id}-${r.start_seconds}-${i}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatTimestamp(r.start_seconds)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                    {r.snippet}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
