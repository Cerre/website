"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GRAPHS } from "./graphs-data";
import { GraphRenderer } from "./graph-renderer";

export default function GraphsPage() {
  const [graphIdx, setGraphIdx] = useState(0);
  const [step, setStep] = useState(0);

  const graph = GRAPHS[graphIdx];
  const maxStep = Math.max(...graph.layers.map((l) => l.step));

  const canStepForward = step < maxStep;
  const canStepBack = step > 0;
  const canNextGraph = graphIdx < GRAPHS.length - 1;
  const canPrevGraph = graphIdx > 0;

  const stepForward = () => {
    if (canStepForward) setStep((s) => s + 1);
  };
  const stepBack = () => {
    if (canStepBack) setStep((s) => s - 1);
  };
  const goNextGraph = () => {
    if (canNextGraph) {
      setGraphIdx((g) => g + 1);
      setStep(0);
    }
  };
  const goPrevGraph = () => {
    if (canPrevGraph) {
      setGraphIdx((g) => g - 1);
      setStep(0);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepForward();
      else if (e.key === "ArrowLeft") stepBack();
      else if (e.key === "ArrowDown") goNextGraph();
      else if (e.key === "ArrowUp") goPrevGraph();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const btn =
    "rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Home
        </Link>

        <div className="mt-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Graphs</h1>
          <span className="text-sm text-zinc-500">
            {graphIdx + 1} / {GRAPHS.length}
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 sm:p-6">
          <GraphRenderer graph={graph} step={step} />

          <div className="mt-2 text-sm text-zinc-500">
            Step {step + 1} / {maxStep + 1}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={stepBack} disabled={!canStepBack} className={btn}>
              ← Back
            </button>
            <button onClick={stepForward} disabled={!canStepForward} className={btn}>
              Add info →
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={goPrevGraph} disabled={!canPrevGraph} className={btn}>
            ← Previous graph
          </button>
          <button onClick={goNextGraph} disabled={!canNextGraph} className={btn}>
            Next graph →
          </button>
        </div>
      </main>
    </div>
  );
}
