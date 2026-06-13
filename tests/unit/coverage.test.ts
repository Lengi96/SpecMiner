import { describe, expect, it } from "vitest";
import { buildCoverageReport } from "../../src/coverage/coverage-report.js";
import type { Evidence, PageSnapshot, UserAction } from "../../src/models/types.js";

describe("buildCoverageReport", () => {
  it("summarizes clicked and unclicked controls with forms and pages", () => {
    const evidence: Evidence[] = [
      { id: "ev_1", runId: "run_1", kind: "button", url: "https://app.test", timestamp: "t", label: "Save", metadata: {} }
    ];
    const events: UserAction[] = [
      { id: "act_1", type: "click", beforeUrl: "https://app.test", timestamp: "t", metadata: { label: "Save" } }
    ];
    const pages: PageSnapshot[] = [
      {
        id: "page_1",
        runId: "run_1",
        url: "https://app.test",
        title: "Customers",
        capturedAt: "t",
        visibleTexts: ["Customers"],
        forms: [{ selector: "form", fields: [], buttons: [] }],
        buttons: [
          { selector: "button:nth-of-type(1)", label: "Save" },
          { selector: "button:nth-of-type(2)", label: "Delete" }
        ],
        tables: [],
        errorMessages: [],
        evidenceIds: ["ev_1"]
      }
    ];

    const report = buildCoverageReport(evidence, events, pages);

    expect(report.pageSnapshotCount).toBe(1);
    expect(report.formCount).toBe(1);
    expect(report.clickedControls).toEqual(["Save"]);
    expect(report.unclickedControls).toEqual(["Delete"]);
  });
});
