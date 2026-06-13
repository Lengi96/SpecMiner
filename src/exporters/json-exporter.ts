import type { SpecDocument } from "../models/types.js";

export function renderJson(spec: SpecDocument): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}
