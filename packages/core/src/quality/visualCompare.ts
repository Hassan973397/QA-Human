import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export interface VisualDiffResult {
  /** Fraction of pixels that differ (0..1). */
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  /** Encoded PNG of the diff, or null when sizes mismatched. */
  diffPng: Buffer | null;
  sizeMismatch: boolean;
}

/**
 * Pixel-diffs two PNG screenshots. When dimensions differ we report a full
 * mismatch (ratio 1) rather than trying to align them — a layout that changed
 * size is itself a regression worth surfacing.
 */
export function compareScreenshots(
  currentPng: Buffer,
  baselinePng: Buffer,
  threshold: number,
): VisualDiffResult {
  const current = PNG.sync.read(currentPng);
  const baseline = PNG.sync.read(baselinePng);

  if (current.width !== baseline.width || current.height !== baseline.height) {
    return {
      diffRatio: 1,
      diffPixels: current.width * current.height,
      totalPixels: current.width * current.height,
      diffPng: null,
      sizeMismatch: true,
    };
  }

  const { width, height } = current;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(current.data, baseline.data, diff.data, width, height, {
    threshold,
  });
  const totalPixels = width * height;

  return {
    diffRatio: totalPixels === 0 ? 0 : diffPixels / totalPixels,
    diffPixels,
    totalPixels,
    diffPng: PNG.sync.write(diff),
    sizeMismatch: false,
  };
}
