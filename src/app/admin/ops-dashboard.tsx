"use client";

import { useEffect, useState } from "react";

interface ChannelError {
  channel_id: string;
  url: string | null;
  error: string;
}

interface RunSnapshot {
  run_id: string;
  kind: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  failed: number;
  error: string | null;
  channel_errors: ChannelError[];
}

interface OpsStatus {
  now: string;
  latest_daily_poll: RunSnapshot | null;
  latest_backup: RunSnapshot | null;
  backup_age_hours: number | null;
  backup_fresh: boolean;
  failed_videos: number;
  stale_processing: number;
  stale_oldest_age_hours: number | null;
  alerts: { code: string; message: string }[];
}

interface RunRow {
  run_id: string;
  kind: string;
  status: string;
  trigger: string | null;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  failed: number;
  error: string | null;
}

type Phase = "loading" | "ready" | "unavailable" | "error";

function fmtAge(hours: number | null): string {
  if (hours === null) return "unknown";
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function statusTone(status: string): string {
  switch (status) {
    case "succeeded":
      return "text-emerald-600 dark:text-emerald-500";
    case "partial":
      return "text-amber-600 dark:text-amber-500";
    case "failed":
    case "aborted":
      return "text-red-600 dark:text-red-500";
    case "running":
      return "text-sky-600 dark:text-sky-500";
    default:
      return "text-zinc-500";
  }
}

export default function OpsDashboard() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  // Refresh is driven by a counter so the fetch can live inline in the effect
  // (setState only after an await), which is the pattern React/eslint allow.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch("/api/pi/ops/status", { credentials: "include" }),
          fetch("/api/pi/ops/runs?limit=20", { credentials: "include" }),
        ]);
        if (!active) return;
        if (sRes.status === 503 || rRes.status === 503) {
          setPhase("unavailable");
          return;
        }
        if (!sRes.ok || !rRes.ok) {
          setPhase("error");
          return;
        }
        const statusJson = await sRes.json();
        const runsJson = await rRes.json();
        if (!active) return;
        setStatus(statusJson);
        setRuns(runsJson.runs ?? []);
        setPhase("ready");
      } catch {
        if (active) setPhase("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Manual refresh: flip to "loading" from an event handler, then re-run.
  const load = () => {
    setPhase("loading");
    setReloadKey((k) => k + 1);
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Ingestion health</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Durable run ledger from the Pi — daily poll, backups, and alerts.
          </p>
        </div>
        <button
          onClick={load}
          disabled={phase === "loading"}
          className="shrink-0 rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {phase === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {phase === "unavailable" && (
        <p className="mt-6 text-sm text-amber-600 dark:text-amber-500">
          The ops backend is unavailable right now. Try again shortly.
        </p>
      )}
      {phase === "error" && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-500">
          Something went wrong loading the ops view.
        </p>
      )}

      {phase === "ready" && status && (
        <div className="mt-6 space-y-8">
          {/* Alerts */}
          {status.alerts.length > 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                {status.alerts.length} active alert
                {status.alerts.length > 1 ? "s" : ""}
              </h3>
              <ul className="mt-2 space-y-1">
                {status.alerts.map((a) => (
                  <li key={a.code} className="text-sm text-red-700 dark:text-red-400">
                    <span className="font-mono text-xs">[{a.code}]</span> {a.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
              All clear — no active alerts.
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card label="Daily poll">
              {status.latest_daily_poll ? (
                <>
                  <span className={statusTone(status.latest_daily_poll.status)}>
                    {status.latest_daily_poll.status}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {fmtTime(status.latest_daily_poll.finished_at)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">none on record</span>
              )}
            </Card>
            <Card label="Backup">
              {status.latest_backup ? (
                <>
                  <span
                    className={
                      status.backup_fresh
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-red-600 dark:text-red-500"
                    }
                  >
                    {status.backup_fresh ? "fresh" : "STALE"}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {fmtAge(status.backup_age_hours)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">none on record</span>
              )}
            </Card>
            <Card label="Failed videos">
              <span
                className={
                  status.failed_videos > 0 ? "text-amber-600 dark:text-amber-500" : ""
                }
              >
                {status.failed_videos}
              </span>
            </Card>
            <Card label="Stale processing">
              <span
                className={
                  status.stale_processing > 0 ? "text-amber-600 dark:text-amber-500" : ""
                }
              >
                {status.stale_processing}
              </span>
              {status.stale_oldest_age_hours !== null && (
                <span className="mt-1 block text-xs text-zinc-500">
                  oldest {status.stale_oldest_age_hours.toFixed(1)}h
                </span>
              )}
            </Card>
          </div>

          {/* Per-channel errors on the latest poll */}
          {status.latest_daily_poll &&
            status.latest_daily_poll.channel_errors.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Channel errors (latest poll)</h3>
                <ul className="mt-3 space-y-2">
                  {status.latest_daily_poll.channel_errors.map((c) => (
                    <li key={c.channel_id} className="text-sm">
                      <span className="font-mono text-xs text-zinc-500">
                        {c.channel_id}
                      </span>
                      <span className="ml-2 text-red-600 dark:text-red-500">
                        {c.error}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Recent runs */}
          <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Recent runs</h3>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No runs on record.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Kind</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Trigger</th>
                      <th className="py-2 pr-4 font-medium">Finished</th>
                      <th className="py-2 pr-4 font-medium">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr
                        key={r.run_id}
                        className="border-t border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="py-2 pr-4 font-medium">{r.kind}</td>
                        <td className={`py-2 pr-4 ${statusTone(r.status)}`}>
                          {r.status}
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">{r.trigger ?? "—"}</td>
                        <td className="py-2 pr-4 text-zinc-500">
                          {fmtTime(r.finished_at)}
                        </td>
                        <td className="py-2 pr-4">
                          {r.failed > 0 ? (
                            <span className="text-amber-600 dark:text-amber-500">
                              {r.failed}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{children}</p>
    </div>
  );
}
