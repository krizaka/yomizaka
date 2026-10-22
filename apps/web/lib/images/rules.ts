import type { ImageRules } from "./port";

/** Yomizaka's photo rules — data. */
export const YOMIZAKA_IMAGE_RULES: ImageRules = {
  maxSide: 2400,
  jpegQuality: 85,
  maxPhotos: 12,
  deskewMaxDegrees: 12,
  deskewStepDegrees: 0.5,
  minPageShare: 0.25,
};
