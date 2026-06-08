declare module "pixelmatch" {
  interface PixelmatchOptions {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: boolean;
  }
  /** Compares two images and writes the diff; returns the number of differing pixels. */
  export default function pixelmatch(
    img1: Uint8Array | Buffer,
    img2: Uint8Array | Buffer,
    output: Uint8Array | Buffer | null,
    width: number,
    height: number,
    options?: PixelmatchOptions,
  ): number;
}
