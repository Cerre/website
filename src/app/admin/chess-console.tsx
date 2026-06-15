"use client";

import { useState } from "react";
import PiSearch from "./pi-search";
import PiAsk from "./pi-ask";

type Mode = "search" | "ask";

export default function ChessConsole() {
  const [mode, setMode] = useState<Mode>("search");

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">chess-search</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live semantic search and grounded Q&amp;A over a 60k+ video chess
            transcript corpus — served from a Raspberry Pi, queried over the tailnet.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
          {(["search", "ask"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {m === "search" ? "Search" : "Ask"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">{mode === "search" ? <PiSearch /> : <PiAsk />}</div>
    </section>
  );
}
