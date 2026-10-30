declare module "heic-decode" {
  /** Decodes the first image of a HEIC/HEIF file to RGBA pixels (WebAssembly; the camera's rotation is applied). */
  export default function decode(input: {
    buffer: Buffer | Uint8Array;
  }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
}
