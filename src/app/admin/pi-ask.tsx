"use client";

import { useState } from "react";

interface Source {
  video_id: string;
  title: string;
  start_seconds: number;
  snippet: string;
}

interface AskAnswer {
  answer: string;
  found: boolean;
  sources: Source[];
}

type Status = "idle" | "loading" | "ready" | "unavailable" | "error";

const SUGGESTIONS = [
  "How should I respond to the London System?",
  "What's the idea behind a pawn storm?",
  "How do I attack a castled king?",
];

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`
    : `${m}:${rem.toString().padStart(2, "0")}`;
}

function youtubeUrl(videoId: string, startSeconds: number): string {
  const t = Math.max(0, Math.floor(startSeconds));
  return `https://youtube.com/watch?v=${videoId}&t=${t}s`;
}

// Safe markdown-lite: bold (**…**) only, no raw HTML.
function renderInline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

// Render the grounded answer as headings / quotes / list items / paragraphs.
function AnswerBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ol key={key} className="ml-1 list-decimal space-y-1 pl-5 text-sm">
        {list.map((it, i) => (
          <li key={`${key}-${i}`}>{renderInline(it, `${key}-${i}`)}</li>
        ))}
      </ol>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = `b-${idx}`;
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      list.push(olMatch[1]);
      return;
    }
    flushList(`${key}-l`);
    if (!line) return;
    if (line.startsWith("## ")) {
      blocks.push(
        <h4 key={key} className="mt-4 text-sm font-semibold">
          {renderInline(line.slice(3), key)}
        </h4>,
      );
    } else if (line.startsWith("> ") || line.startsWith('"') || line.startsWith("“")) {
      blocks.push(
        <blockquote
          key={key}
          className="border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-500 dark:border-zinc-700"
        >
          {renderInline(line.replace(/^>\s?/, ""), key)}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={key} className="text-sm leading-relaxed">
          {renderInline(line, key)}
        </p>,
      );
    }
  });
  flushList("b-tail");
  return <div className="space-y-2">{blocks}</div>;
}

export default function PiAsk() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AskAnswer | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question) return;
    setQuery(question);
    setStatus("loading");
    try {
      const res = await fetch(`/api/pi/ask?q=${encodeURIComponent(question)}`, {
        credentials: "include",
      });
      if (res.status === 503) {
        setResult(null);
        setStatus("unavailable");
        return;
      }
      if (!res.ok) {
        setResult(null);
        setStatus("error");
        return;
      }
      const data = (await res.json()) as AskAnswer;
      setResult(data);
      setStatus("ready");
    } catch {
      setResult(null);
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">Ask the corpus</h2>
      <p className="mt-1 text-sm text-zinc-500">
        A grounded answer composed only from retrieved transcript chunks — with the
        clips it cites. The model declines rather than inventing lines.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(query);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a chess question…"
          className="flex-1 rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
        />
        <button
          type="submit"
          disabled={status === "loading" || !query.trim()}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {status === "loading" ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={status === "loading"}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {status === "loading" && (
          <p className="text-sm text-zinc-500">
            Retrieving chunks and composing an answer — this can take ~30s on a cold
            start.
          </p>
        )}
        {status === "unavailable" && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            The answer service is unavailable right now. Try again shortly.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-500">
            Something went wrong with that question.
          </p>
        )}

        {status === "ready" && result && (
          <div>
            {!result.found && (
              <p className="mb-2 text-xs text-zinc-500">
                No confident match — the model declined to answer from the corpus.
              </p>
            )}
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <AnswerBody text={result.answer} />
            </div>

            {result.sources.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Sources
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.sources.map((s, i) => (
                    <li key={`${s.video_id}-${s.start_seconds}-${i}`}>
                      <a
                        href={youtubeUrl(s.video_id, s.start_seconds)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.title}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                      >
                        ▸ {formatTimestamp(s.start_seconds)}
                        <span className="max-w-[16ch] truncate">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
