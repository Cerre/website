export type View = { xMin: number; xMax: number; yMin: number; yMax: number };

export type Layer =
  | { step: number; type: "frame" }
  | { step: number; type: "background"; color: string }
  | { step: number; type: "axes" }
  | { step: number; type: "axisLabels"; xLabel: string; yLabel: string }
  | { step: number; type: "title"; text: string }
  | { step: number; type: "line"; points: [number, number][]; color?: string }
  | { step: number; type: "arrow"; from: [number, number]; to: [number, number]; label?: string }
  | { step: number; type: "point"; at: [number, number]; label?: string }
  | { step: number; type: "label"; at: [number, number]; text: string };

export type Graph = {
  id: string;
  title: string;
  view: View;
  layers: Layer[];
};

const linspace = (a: number, b: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

export const GRAPHS: Graph[] = [
  {
    id: "quadratic",
    title: "y = x²",
    view: { xMin: -3, xMax: 3, yMin: -1, yMax: 10 },
    layers: [
      { step: 0, type: "frame" },
      { step: 1, type: "line", points: linspace(-3, 3, 60).map((x) => [x, x * x]) },
      { step: 2, type: "axes" },
      { step: 3, type: "axisLabels", xLabel: "x", yLabel: "y" },
      { step: 4, type: "title", text: "y = x²" },
      { step: 5, type: "point", at: [0, 0], label: "minimum" },
      { step: 6, type: "arrow", from: [-2.4, 7.5], to: [-2, 4.2], label: "x = -2 → y = 4" },
    ],
  },
  {
    id: "throw",
    title: "How hard they come back",
    view: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
    layers: [
      { step: 0, type: "background", color: "#F4F3EE" },
      { step: 0, type: "axes" },
      { step: 1, type: "line", points: [[0, 0], [10, 10]] as [number, number][], color: "#C15F3C" },
      { step: 2, type: "axisLabels", xLabel: "How hard you throw them", yLabel: "How hard they come back" },
    ],
  },
  {
    id: "growth",
    title: "Linear vs exponential",
    view: { xMin: 0, xMax: 5, yMin: 0, yMax: 25 },
    layers: [
      { step: 0, type: "frame" },
      { step: 1, type: "axes" },
      { step: 2, type: "line", points: linspace(0, 5, 30).map((x) => [x, x * 2]), color: "blue" },
      { step: 3, type: "line", points: linspace(0, 5, 60).map((x) => [x, Math.exp(x) - 1]), color: "red" },
      { step: 4, type: "axisLabels", xLabel: "time", yLabel: "value" },
      { step: 5, type: "title", text: "Linear vs exponential growth" },
      { step: 6, type: "label", at: [4.1, 7.5], text: "linear" },
      { step: 7, type: "label", at: [3.2, 20], text: "exponential" },
    ],
  },
];
