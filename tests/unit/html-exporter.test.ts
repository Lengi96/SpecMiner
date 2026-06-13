import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../../src/exporters/html-exporter.js";
import type { CoverageReport } from "../../src/coverage/coverage-report.js";
import type { SpecDocument } from "../../src/models/types.js";

describe("renderHtmlReport", () => {
  it("renders claim classification, evidence links, coverage, and screenshot references", () => {
    const spec: SpecDocument = {
      run: {
        id: "run_1",
        startedAt: "2026-06-13T00:00:00.000Z",
        baseUrl: "https://app.test",
        toolVersion: "0.1.0",
        privacyProfile: "default"
      },
      generatedAt: "2026-06-13T00:00:00.000Z",
      summary: "Summary",
      claims: [
        {
          id: "claim_1",
          kind: "observation",
          category: "business_rule",
          text: "Email is required.",
          evidenceIds: ["ev_1"],
          confidence: "high"
        }
      ],
      modules: [],
      openQuestions: []
    };
    const coverage: CoverageReport = {
      urlCount: 1,
      pageSnapshotCount: 1,
      actionCount: 1,
      formCount: 1,
      tableCount: 0,
      errorMessageCount: 1,
      clickedControls: ["Save"],
      unclickedControls: ["Delete"]
    };

    const html = renderHtmlReport(spec, coverage, [
      { id: "ev_1", kind: "screenshot", url: "https://app.test", artifactPath: "screenshots/home.png" }
    ]);

    expect(html).toContain("Email is required.");
    expect(html).toContain("#ev_1");
    expect(html).toContain("screenshots/home.png");
    expect(html).toContain("Unclicked controls");
  });
});
