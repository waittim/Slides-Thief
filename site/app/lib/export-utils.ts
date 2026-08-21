import type { ManualQuads } from "../schemas";
import { parseManualQuads, validateManualQuadForImage } from "../schemas/validators.ts";
import type { SlideItem } from "./types";

export function exportManualQuads(slides: SlideItem[]): ManualQuads {
  const result: ManualQuads = {};
  for (const slide of slides) {
    if (slide.quad) {
      const quad = [
        [slide.quad[0][0], slide.quad[0][1]],
        [slide.quad[1][0], slide.quad[1][1]],
        [slide.quad[2][0], slide.quad[2][1]],
        [slide.quad[3][0], slide.quad[3][1]],
      ];
      result[slide.file.name] = validateManualQuadForImage(quad, slide.file.name, slide.width, slide.height);
    }
  }
  return parseManualQuads(result);
}
