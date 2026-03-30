import { TypingEffect } from "./typing-effect";
import { VpsStatus } from "./vps-status";

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/Cerre" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/filip-cederquist-8b395819a/" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6">
        {/* Hero */}
        <section className="flex min-h-[60vh] flex-col justify-center py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Filip
          </h1>
          <p className="mt-4 max-w-lg text-zinc-600 dark:text-zinc-400">
            <TypingEffect text="I like puzzles, math, and games. This site is a living playground for whatever I'm tinkering with." />
          </p>
          <div className="mt-8 flex gap-4">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {link.label}
              </a>
            ))}
            <a
              href="mailto:cederquist94@hotmail.com"
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Email
            </a>
          </div>
        </section>

        {/* Live Status */}
        <section className="py-20">
          <div className="mt-6">
            <VpsStatus />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-6 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
          &copy; {new Date().getFullYear()} Filip
        </div>
      </footer>
    </div>
  );
}
