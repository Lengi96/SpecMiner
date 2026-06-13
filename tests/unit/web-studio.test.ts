import { describe, expect, it } from "vitest";
import { renderStudioHtml } from "../../src/web/studio-html.js";

describe("renderStudioHtml", () => {
  it("contains the SpecMiner Studio app shell and API hooks", () => {
    const html = renderStudioHtml();

    expect(html).toContain("SpecMiner Studio");
    expect(html).toContain("/api/run");
    expect(html).toContain("/api/review");
  });
});
