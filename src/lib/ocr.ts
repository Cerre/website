// Text from the live stream, read by the OCR worker on the Pi through the API.
// A box goes up as raw 8-bit grayscale pixels (width * height bytes), never an image file,
// so nothing on the server has to decode a file from the internet.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.filipcederquist.com";

export const MIN_SIDE = 16;
export const MAX_PIXELS = 1_000_000; // about half a 1080p frame

export type Box = { x: number; y: number; w: number; h: number };

/** The box's pixels from the frozen frame, as grayscale bytes (luma). */
export function grayPixels(frame: HTMLCanvasElement, box: Box): Uint8Array {
  const rgba = frame.getContext("2d")!.getImageData(box.x, box.y, box.w, box.h).data;
  const gray = new Uint8Array(box.w * box.h);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  return gray;
}

const MESSAGES: Record<number, string> = {
  409: "The stream is offline.",
  413: "That box is too large. Select a smaller area.",
  429: "Too many at once. Wait a moment.",
};

/** The text in a box; throws an Error with a message for the viewer. */
export async function readBox(pixels: Uint8Array, w: number, h: number): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/stream/ocr?w=${w}&h=${h}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: pixels as BodyInit,
    });
  } catch {
    throw new Error("Couldn't reach the server.");
  }
  if (res.ok) return (await res.json()).text;
  const detail = await res.json().then((b) => b.detail, () => null);
  throw new Error(MESSAGES[res.status] ?? (typeof detail === "string" ? `${detail}.` : "Something went wrong."));
}

/** Copy the box's text once it arrives; true if it reached the clipboard.
 *  Call it while handling the drag: browsers only allow clipboard writes during a user action,
 *  so the write starts now with the text still on its way. An empty or failed read rejects
 *  it and leaves the clipboard alone. */
export async function copyWhenReady(text: Promise<string>): Promise<boolean> {
  const blob = text.then((t) => (t ? new Blob([t], { type: "text/plain" }) : Promise.reject(new Error("nothing to copy"))));
  blob.catch(() => {}); // handled through the clipboard write, or below
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return true;
  } catch {
    // No ClipboardItem with a pending value here; a plain write may still be allowed
    const t = await text.catch(() => "");
    if (!t) return false;
    return navigator.clipboard.writeText(t).then(() => true, () => false);
  }
}
