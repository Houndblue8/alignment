// The disposable camera look (Eli, Oct 12): warm tones, lifted blacks, grain, a soft vignette, and an orange
// date stamp in the corner. The pixel math is pure (tested); the canvas helpers below draw with it.

/** Small fast deterministic random numbers (mulberry32), so the same seed gives the same grain. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Disposable film, in place on RGBA pixels: warm (red and yellow up, blue down), slightly faded blacks and
 * softer whites, a touch more contrast in the mids, film grain, and a vignette toward the corners.
 */
export function disposable(px: Uint8ClampedArray, w: number, h: number, seed = 1): void {
  const rand = rng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = px[i]!;
      let g = px[i + 1]!;
      let b = px[i + 2]!;
      // Contrast around the middle, then warmth.
      r = (r - 128) * 1.08 + 128 + 14;
      g = (g - 128) * 1.06 + 128 + 6;
      b = (b - 128) * 1.02 + 128 - 12;
      // Faded blacks, softer whites.
      r = 22 + r * 0.9;
      g = 18 + g * 0.9;
      b = 16 + b * 0.88;
      // Grain: the same amount on all channels, like film.
      const n = (rand() - 0.5) * 26;
      // Vignette.
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const v = 1 - Math.max(0, d - 0.55) * 0.7;
      px[i] = clamp((r + n) * v);
      px[i + 1] = clamp((g + n) * v);
      px[i + 2] = clamp((b + n) * v);
    }
  }
}

/** The stamp in the corner, like a 90s disposable: '26 10 12. */
export const dateStamp = (date: string): string => `'${date.slice(2, 4)} ${date.slice(5, 7)} ${date.slice(8, 10)}`;

/** Draw a video frame (or image) into a w by h box, cropping to fill it (object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number }, x: number, y: number, w: number, h: number, mirror = false): void {
  const sw = (src.videoWidth || (src.width as number)) ?? w;
  const sh = (src.videoHeight || (src.height as number)) ?? h;
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  } else {
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
  }
  ctx.restore();
}

export const SHOT_W = 1200;
export const SHOT_H = 1600;

/**
 * The BeReal shot: the main picture full frame and the other one small in the top left corner with a white
 * border, then the film look and the date stamp. Returns a JPEG.
 */
export async function develop(main: HTMLCanvasElement, inset: HTMLCanvasElement | null, date: string): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = SHOT_W;
  c.height = SHOT_H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(main, 0, 0, SHOT_W, SHOT_H);
  if (inset) {
    const iw = 360;
    const ih = 480;
    const x = 40;
    const y = 40;
    ctx.save();
    roundRect(ctx, x - 7, y - 7, iw + 14, ih + 14, 34);
    ctx.fillStyle = '#f8f4ea';
    ctx.fill();
    roundRect(ctx, x, y, iw, ih, 28);
    ctx.clip();
    ctx.drawImage(inset, x, y, iw, ih);
    ctx.restore();
  }
  const img = ctx.getImageData(0, 0, SHOT_W, SHOT_H);
  disposable(img.data, SHOT_W, SHOT_H, Number(date.replace(/-/g, '')));
  ctx.putImageData(img, 0, 0);
  // The stamp: orange, slightly glowing, bottom right.
  ctx.font = 'bold 54px "Courier New", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(255, 120, 30, 0.85)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText(dateStamp(date), SHOT_W - 56, SHOT_H - 48);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('The camera could not save the shot.');
  return blob;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A photo picked from the library gets the same look (no inset). */
export async function developFile(file: Blob, date: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) return file;
  const c = document.createElement('canvas');
  c.width = SHOT_W;
  c.height = SHOT_H;
  drawCover(c.getContext('2d')!, bitmap as unknown as CanvasImageSource & { width: number; height: number }, 0, 0, SHOT_W, SHOT_H);
  bitmap.close();
  return develop(c, null, date);
}
