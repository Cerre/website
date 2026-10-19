import type { Metadata } from "next";
import Link from "next/link";

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? "https://stream.filipcederquist.com";

export const metadata: Metadata = {
  title: "Live",
  description: "Screen and camera, live.",
};

export default function LivePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Home
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Live</h1>
        <p className="mt-2 text-zinc-500">
          Screen and camera, live. If the player says there&apos;s no stream, I&apos;m not live right now.
        </p>
        <div className="mt-8 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={`${STREAM_URL}/live/`}
            allow="autoplay; fullscreen"
            allowFullScreen
            title="Live stream"
            className="h-full w-full border-0"
          />
        </div>
      </main>
    </div>
  );
}
