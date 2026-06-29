import { describe, expect, it } from "vitest";
import { renderStudioHtml } from "../../src/web/studio-html.js";

describe("renderStudioHtml", () => {
  it("contains the SpecMiner Studio app shell and API hooks", () => {
    const html = renderStudioHtml();

    expect(html).toContain("SpecMiner Studio");
    expect(html).toContain("Neue Website analysieren");
    expect(html).toContain("/api/run");
    expect(html).toContain("/api/review");
    expect(html).toContain("/api/workflow/start");
    expect(html).toContain("/api/workflow/stop");
    expect(html).toContain("/api/workflow/status");
    expect(html).toContain("/api/runs");
    expect(html).toContain("/api/runs/select");
    expect(html).toContain("Letzte Analysen");
    expect(html).toContain("Login / SSO zuerst");
    expect(html).toContain("Datenschutz");
    expect(html).toContain("Evidence ansehen");
    expect(html).toContain("data-edited-text");
  });
});
