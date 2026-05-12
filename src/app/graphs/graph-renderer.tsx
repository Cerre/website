"use client";

import type { Graph } from "./graphs-data";
import {
  ChartProvider,
  Frame,
  Axes,
  AxisLabels,
  Title,
  Line,
  Point,
  Label,
  Arrow,
  type Dim,
} from "./primitives";

const DIM: Dim = {
  width: 600,
  height: 400,
  padding: { top: 50, right: 30, bottom: 50, left: 55 },
};

export function GraphRenderer({ graph, step }: { graph: Graph; step: number }) {
  const visible = graph.layers.filter((l) => l.step <= step);
  return (
    <div className="w-full text-zinc-700 dark:text-zinc-300">
      <svg
        viewBox={`0 0 ${DIM.width} ${DIM.height}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
          </marker>
        </defs>
        <ChartProvider view={graph.view} dim={DIM}>
          {visible.map((layer, i) => {
            switch (layer.type) {
              case "frame":
                return <Frame key={i} />;
              case "axes":
                return <Axes key={i} />;
              case "axisLabels":
                return <AxisLabels key={i} xLabel={layer.xLabel} yLabel={layer.yLabel} />;
              case "title":
                return <Title key={i} text={layer.text} />;
              case "line":
                return <Line key={i} points={layer.points} color={layer.color} />;
              case "point":
                return <Point key={i} at={layer.at} label={layer.label} />;
              case "label":
                return <Label key={i} at={layer.at} text={layer.text} />;
              case "arrow":
                return <Arrow key={i} from={layer.from} to={layer.to} label={layer.label} />;
            }
          })}
        </ChartProvider>
      </svg>
    </div>
  );
}
