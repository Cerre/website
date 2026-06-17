"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OpsDashboard from "../ops-dashboard";

interface User {
  email: string;
  name: string | null;
  picture: string | null;
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export default function OpsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          await logout();
          router.replace("/login");
          return;
        }
        setUser(await res.json());
      } catch {
        await logout();
        router.replace("/login");
        return;
      }
      setLoading(false);
    };
    validateSession();
  }, [router]);

  const handleSignOut = async () => {
    await logout();
    router.replace("/");
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name ?? ""}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="text-sm font-medium">{user.name ?? user.email}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Ops</h1>
        <p className="mt-2 text-zinc-500">
          chess-search ingestion run ledger and health.
        </p>

        <div className="mt-10">
          <OpsDashboard />
        </div>
      </main>
    </div>
  );
}
