/** A grayscale bitmap: one byte per pixel, 0 black, 255 white. */
export interface Gray {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Otsu's threshold: the grey level that best separates dark from bright. */
function otsu(gray: Gray): { threshold: number; contrast: number } {
  const histogram = new Array<number>(256).fill(0);
  for (const v of gray.data) histogram[v]!++;
  const total = gray.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i]!;
  let [weightB, sumB, best, threshold] = [0, 0, -1, 128];
  let [meanLow, meanHigh] = [0, 255];
  for (let t = 0; t < 256; t++) {
    weightB += histogram[t]!;
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * histogram[t]!;
    const [mB, mF] = [sumB / weightB, (sum - sumB) / weightF];
    const between = weightB * weightF * (mB - mF) ** 2;
    if (between > best) [best, threshold, meanLow, meanHigh] = [between, t, mB, mF];
  }
  return { threshold, contrast: meanHigh - meanLow };
}

/** Clears the dark region that touches the frame (a desk around the page, a shadow): what is left is the ink inside the page. */
function removeBorderRegion(mask: Uint8Array, width: number, height: number): void {
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = y * width + x;
    if (mask[i]) {
      mask[i] = 0;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const [x, y] = [i % width, Math.floor(i / width)];
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
}

/**
 * The angle, in degrees, to turn a page by so its text lines run level — the projection-profile method: the right angle is the one
 * where the dark pixels pile up in the fewest rows. Positive turns clockwise (image coordinates, y down). 0 for a blank page or a
 * tie: a page that is already level is never touched.
 */
export function estimateSkew(gray: Gray, { max, step }: { max: number; step: number }): number {
  const { threshold, contrast } = otsu(gray);
  if (contrast < 60) return 0;
  const mask = new Uint8Array(gray.data.length);
  for (let i = 0; i < mask.length; i++) mask[i] = gray.data[i]! <= threshold ? 1 : 0;
  removeBorderRegion(mask, gray.width, gray.height);
  const dark: number[] = [];
  const [cx, cy] = [gray.width / 2, gray.height / 2];
  for (let y = 0; y < gray.height; y++) for (let x = 0; x < gray.width; x++) if (mask[y * gray.width + x]) dark.push(x - cx, y - cy);
  if (dark.length / 2 < gray.data.length * 0.002) return 0;
  const bins = gray.height * 2;
  const scoreOf = (degrees: number) => {
    const [sin, cos] = [Math.sin((degrees * Math.PI) / 180), Math.cos((degrees * Math.PI) / 180)];
    const rows = new Float64Array(bins);
    for (let i = 0; i < dark.length; i += 2) {
      const row = Math.round(dark[i]! * sin + dark[i + 1]! * cos + gray.height);
      if (row >= 0 && row < bins) rows[row]!++;
    }
    let score = 0;
    for (const r of rows) score += r * r;
    return score;
  };
  const level = scoreOf(0);
  let [best, bestScore] = [0, level];
  for (let a = -max; a <= max + 1e-9; a += step) {
    const score = scoreOf(a);
    if (score > bestScore) [best, bestScore] = [a, score];
  }
  // a gain under 0.5 % is noise: leave the page as it is
  return bestScore > level * 1.005 ? Number(best.toFixed(2)) : 0;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The bright page in a photo (a sheet on a darker desk), with a small margin — or null when there is nothing to crop: the page
 * already fills the frame, there is no clear page, or it covers less than `minShare` of the photo (then the photo is left whole).
 */
export function pageBox(gray: Gray, minShare: number): Box | null {
  const { threshold, contrast } = otsu(gray);
  if (contrast < 60) return null;
  const [rows, cols] = [new Uint32Array(gray.height), new Uint32Array(gray.width)];
  for (let y = 0; y < gray.height; y++) {
    for (let x = 0; x < gray.width; x++) {
      if (gray.data[y * gray.width + x]! > threshold) {
        rows[y]!++;
        cols[x]!++;
      }
    }
  }
  const first = (counts: Uint32Array, need: number) => counts.findIndex((c) => c >= need);
  const last = (counts: Uint32Array, need: number) => counts.length - 1 - [...counts].reverse().findIndex((c) => c >= need);
  const [needRow, needCol] = [Math.max(2, gray.width * 0.05), Math.max(2, gray.height * 0.05)];
  const [top, bottom, left, right] = [first(rows, needRow), last(rows, needRow), first(cols, needCol), last(cols, needCol)];
  if (top < 0 || left < 0 || bottom < top || right < left) return null;
  const share = ((right - left + 1) * (bottom - top + 1)) / (gray.width * gray.height);
  if (share < minShare) return null;
  const [marginX, marginY] = [Math.round(gray.width * 0.015), Math.round(gray.height * 0.015)];
  const box = { left: Math.max(0, left - marginX), top: Math.max(0, top - marginY), right: Math.min(gray.width - 1, right + marginX), bottom: Math.min(gray.height - 1, bottom + marginY) };
  if (box.right - box.left + 1 >= gray.width * 0.96 && box.bottom - box.top + 1 >= gray.height * 0.96) return null;
  return box;
}
