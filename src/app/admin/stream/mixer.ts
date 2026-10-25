// The picture-in-picture mixer, in the browser: screen and camera drawn onto one canvas,
// the mic through Web Audio, and the result as one MediaStream to publish.

/** Layout space: the small picture's place is given in these pixels whatever the output size. */
export const W = 1280;
export const H = 720;
export const MIN_W = 80;
const FPS = 30;

export type Source = "screen" | "cam";
export type Box = { x: number; y: number; w: number };
export type Layout = Box & { swap: boolean; screen: boolean; cam: boolean; mic: boolean };

export const DEFAULT_LAYOUT: Layout = { swap: false, screen: true, cam: true, mic: true, x: 940, y: 520, w: 320 };

/** Keep the small picture inside the frame. */
export function clamp({ x, y, w }: Box): Box {
  w = Math.min(Math.max(Math.round(w), MIN_W), W);
  return {
    w,
    x: Math.min(Math.max(Math.round(x), 0), W - w),
    y: Math.min(Math.max(Math.round(y), 0), H - Math.floor((w * 9) / 16)),
  };
}

type Drawable = HTMLVideoElement | HTMLCanvasElement;

function size(d: Drawable): [number, number] {
  return d instanceof HTMLVideoElement ? [d.videoWidth, d.videoHeight] : [d.width, d.height];
}

/** Draw `d` into the rectangle, either whole with black bars (screen text must not be cut) or filling it. */
function draw(ctx: CanvasRenderingContext2D, d: Drawable, x: number, y: number, w: number, h: number, fill: boolean) {
  const [sw, sh] = size(d);
  if (!sw || !sh) return;
  const s = fill ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * s;
  const dh = sh * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(d, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Ticks from a worker: background tabs throttle requestAnimationFrame and the page's own
 *  timers, but not a worker's. */
function ticker(onTick: () => void) {
  const code = `setInterval(() => postMessage(0), ${1000 / FPS})`;
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  worker.onmessage = onTick;
  return () => worker.terminate();
}

export class Mixer {
  readonly canvas = document.createElement("canvas");
  readonly audio = new AudioContext();
  /** What gets published: the canvas plus the mixed audio. */
  readonly output: MediaStream;
  layout = DEFAULT_LAYOUT;
  /** Frames actually drawn per second, measured; low means the browser is holding us back. */
  fps = FPS;

  private ctx: CanvasRenderingContext2D;
  private sources: Partial<Record<Source, Drawable>> = {};
  private mic: AudioNode | null = null;
  private micGain: GainNode;
  private mix: GainNode;
  private stopTicks: () => void;
  private beforeDraw: (() => void)[] = [];
  private frames = 0;
  private since = performance.now();

  constructor(width: number) {
    this.ctx = this.canvas.getContext("2d")!;
    this.resize(width);

    // mic -> micGain (mute) -> mix -> output, and -> speakers only for "Preview sound"
    this.micGain = this.audio.createGain();
    this.mix = this.audio.createGain();
    const out = this.audio.createMediaStreamDestination();
    this.micGain.connect(this.mix).connect(out);

    const video = this.canvas.captureStream(FPS).getVideoTracks()[0];
    video.contentHint = "detail"; // keep resolution under load, so text stays sharp
    this.output = new MediaStream([video, ...out.stream.getAudioTracks()]);
    this.stopTicks = ticker(() => this.tick());
  }

  /** Output width: 1920 (1080p) or 1280 (720p). */
  resize(width: number) {
    this.canvas.width = width;
    this.canvas.height = (width * 9) / 16;
  }

  setSource(source: Source, d: Drawable | null) {
    if (d) this.sources[source] = d;
    else delete this.sources[source];
  }

  /** The mic, as a stream from getUserMedia or a node already in this mixer's AudioContext. */
  setMic(mic: MediaStream | AudioNode | null) {
    this.mic?.disconnect();
    this.mic = mic instanceof MediaStream ? this.audio.createMediaStreamSource(mic) : mic;
    this.mic?.connect(this.micGain);
  }

  setLayout(l: Partial<Layout>) {
    this.layout = { ...this.layout, ...l };
    this.micGain.gain.value = this.layout.mic ? 1 : 0;
  }

  /** Play the mix on this computer's speakers too. */
  setPreviewSound(on: boolean) {
    if (on) this.mix.connect(this.audio.destination);
    else this.mix.disconnect(this.audio.destination);
  }

  /** Run `f` every frame before drawing (the test source animates this way). */
  onFrame(f: () => void) {
    this.beforeDraw.push(f);
    return () => {
      this.beforeDraw = this.beforeDraw.filter((g) => g !== f);
    };
  }

  close() {
    this.stopTicks();
    this.output.getTracks().forEach((t) => t.stop());
    this.audio.close();
  }

  private tick() {
    this.beforeDraw.forEach((f) => f());
    const { ctx, canvas, layout } = this;
    const shown = (["screen", "cam"] as Source[]).filter((s) => this.sources[s] && layout[s]);
    // The big one is the screen unless swapped; alone, either fills the frame
    const [big, small] = shown.length === 2 ? (layout.swap ? ["cam", "screen"] : ["screen", "cam"]) : [shown[0]];

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (big) draw(ctx, this.sources[big as Source]!, 0, 0, canvas.width, canvas.height, false);
    if (small) {
      const s = canvas.width / W;
      draw(ctx, this.sources[small as Source]!, layout.x * s, layout.y * s, layout.w * s, ((layout.w * 9) / 16) * s, true);
    }

    this.frames++;
    const now = performance.now();
    if (now - this.since >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.since));
      this.frames = 0;
      this.since = now;
    }
  }
}
