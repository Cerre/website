"use client";

import { createContext, useContext } from "react";
import type { View } from "./graphs-data";

export type Dim = {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

type ChartCtx = { view: View; dim: Dim };

const ChartContext = createContext<ChartCtx | null>(null);

export function ChartProvider({
  view,
  dim,
  children,
}: ChartCtx & { children: React.ReactNode }) {
  return <ChartContext.Provider value={{ view, dim }}>{children}</ChartContext.Provider>;
}

function useChart(): ChartCtx {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("Chart primitive used outside ChartProvider");
  return ctx;
}

function project(ctx: ChartCtx, x: number, y: number) {
  const { view, dim } = ctx;
  const w = dim.width - dim.padding.left - dim.padding.right;
  const h = dim.height - dim.padding.top - dim.padding.bottom;
  return {
    x: dim.padding.left + ((x - view.xMin) / (view.xMax - view.xMin)) * w,
    y: dim.padding.top + ((view.yMax - y) / (view.yMax - view.yMin)) * h,
  };
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const rough = range / count;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * base);
  const step =
    candidates.find((c) => range / c <= count * 1.5) ?? candidates[candidates.length - 1];
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step / 2; v += step) {
    ticks.push(Math.round(v * 1e9) / 1e9);
  }
  return ticks;
}

const COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
};

export function Frame() {
  const { dim } = useChart();
  const x = dim.padding.left;
  const y = dim.padding.top;
  const w = dim.width - dim.padding.left - dim.padding.right;
  const h = dim.height - dim.padding.top - dim.padding.bottom;
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      opacity={0.25}
    />
  );
}

export function Axes() {
  const ctx = useChart();
  const { view } = ctx;
  const xAxisY = view.yMin <= 0 && view.yMax >= 0 ? 0 : view.yMin;
  const yAxisX = view.xMin <= 0 && view.xMax >= 0 ? 0 : view.xMin;
  const xStart = project(ctx, view.xMin, xAxisY);
  const xEnd = project(ctx, view.xMax, xAxisY);
  const yStart = project(ctx, yAxisX, view.yMin);
  const yEnd = project(ctx, yAxisX, view.yMax);

  const xTicks = niceTicks(view.xMin, view.xMax, 5);
  const yTicks = niceTicks(view.yMin, view.yMax, 5);

  return (
    <g>
      <line
        x1={xStart.x}
        y1={xStart.y}
        x2={xEnd.x}
        y2={xEnd.y}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <line
        x1={yStart.x}
        y1={yStart.y}
        x2={yEnd.x}
        y2={yEnd.y}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {xTicks.map((t) => {
        const p = project(ctx, t, xAxisY);
        return (
          <g key={`x${t}`}>
            <line x1={p.x} y1={p.y - 3} x2={p.x} y2={p.y + 3} stroke="currentColor" strokeWidth={1} />
            <text x={p.x} y={p.y + 16} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.65}>
              {t}
            </text>
          </g>
        );
      })}
      {yTicks.map((t) => {
        const p = project(ctx, yAxisX, t);
        return (
          <g key={`y${t}`}>
            <line x1={p.x - 3} y1={p.y} x2={p.x + 3} y2={p.y} stroke="currentColor" strokeWidth={1} />
            <text x={p.x - 7} y={p.y + 4} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.65}>
              {t}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function AxisLabels({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  const { dim } = useChart();
  const xLabelX = dim.padding.left + (dim.width - dim.padding.left - dim.padding.right) / 2;
  const xLabelY = dim.height - 10;
  const yLabelX = 16;
  const yLabelY = dim.padding.top + (dim.height - dim.padding.top - dim.padding.bottom) / 2;
  return (
    <g fill="currentColor" fontSize={13}>
      <text x={xLabelX} y={xLabelY} textAnchor="middle">
        {xLabel}
      </text>
      <text
        x={yLabelX}
        y={yLabelY}
        textAnchor="middle"
        transform={`rotate(-90 ${yLabelX} ${yLabelY})`}
      >
        {yLabel}
      </text>
    </g>
  );
}

export function Title({ text }: { text: string }) {
  const { dim } = useChart();
  const x = dim.padding.left + (dim.width - dim.padding.left - dim.padding.right) / 2;
  return (
    <text x={x} y={26} textAnchor="middle" fontSize={16} fontWeight={600} fill="currentColor">
      {text}
    </text>
  );
}

export function Line({ points, color }: { points: [number, number][]; color?: string }) {
  const ctx = useChart();
  const path = points
    .map(([x, y]) => {
      const p = project(ctx, x, y);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = color ? COLORS[color] ?? color : COLORS.blue;
  return (
    <polyline
      points={path}
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function Point({ at, label }: { at: [number, number]; label?: string }) {
  const ctx = useChart();
  const p = project(ctx, at[0], at[1]);
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={4} fill="currentColor" />
      {label && (
        <text x={p.x + 8} y={p.y + 4} fontSize={12} fill="currentColor">
          {label}
        </text>
      )}
    </g>
  );
}

export function Label({ at, text }: { at: [number, number]; text: string }) {
  const ctx = useChart();
  const p = project(ctx, at[0], at[1]);
  return (
    <text x={p.x} y={p.y} fontSize={13} fill="currentColor">
      {text}
    </text>
  );
}

export function Arrow({
  from,
  to,
  label,
}: {
  from: [number, number];
  to: [number, number];
  label?: string;
}) {
  const ctx = useChart();
  const a = project(ctx, from[0], from[1]);
  const b = project(ctx, to[0], to[1]);
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="currentColor"
        strokeWidth={1.5}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text x={a.x} y={a.y - 6} fontSize={12} fill="currentColor" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
