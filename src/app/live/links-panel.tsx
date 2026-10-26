"use client";

import { useEffect, useState } from "react";
import { fetchLinks } from "@/lib/ocr";

const POLL_MS = 5000;

/** Website links seen on stream, newest first. Copy only: OCR can misread a character, so
 *  they're never clickable. */
export default function LinksPanel({ active }: { active: boolean }) {
  const [links, setLinks] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const poll = () =>
      fetchLinks().then(
        (l) => !stopped && setLinks(l),
        () => {}, // keep the last list; the next poll tries again
      );
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active]);

  if (!active || links.length === 0) return null;

  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(link);
    setTimeout(() => setCopied((c) => (c === link ? null : c)), 1500);
  };

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold">Links on stream</h2>
      <p className="mt-1 text-xs text-zinc-500">Read from the screen, so check them before use.</p>
      <ul className="mt-2 max-h-64 divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {links.map((link) => (
          <li key={link} className="flex items-center gap-3 px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
            <button
              onClick={() => copy(link)}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {copied === link ? "Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
