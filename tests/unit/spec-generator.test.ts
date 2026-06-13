import { describe, expect, it } from "vitest";
import { SpecGenerator } from "../../src/generator/spec-generator.js";
import type { Evidence, PageSnapshot, Run, UserAction } from "../../src/models/types.js";

describe("SpecGenerator", () => {
  it("creates traceable claims from recorded page evidence", () => {
    const run: Run = {
      id: "run_1",
      startedAt: "2026-06-13T00:00:00.000Z",
      baseUrl: "https://example.test/customers",
      toolVersion: "0.1.0",
      privacyProfile: "default"
    };
    const evidence: Evidence[] = [
      {
        id: "ev_1",
        runId: "run_1",
        kind: "button",
        url: "https://example.test/customers",
        timestamp: run.startedAt,
        label: "Save",
        metadata: {}
      }
    ];
    const events: UserAction[] = [];
    const pages: PageSnapshot[] = [
      {
        id: "page_1",
        runId: "run_1",
        url: "https://example.test/customers",
        title: "Customers",
        capturedAt: run.startedAt,
        visibleTexts: ["Customers", "Save"],
        forms: [
          {
            selector: "form:nth-of-type(1)",
            fields: [
              {
                selector: "input[name='email']",
                name: "email",
                label: "Email",
                type: "email",
                required: true
              }
            ],
            buttons: []
          }
        ],
        buttons: [
          {
            selector: "button:nth-of-type(1)",
            label: "Save",
            textMasked: "Save"
          }
        ],
        tables: [],
        errorMessages: ["Email is required"],
        evidenceIds: ["ev_1"]
      }
    ];

    const spec = new SpecGenerator().generate(run, evidence, events, pages);

    expect(spec.modules).toHaveLength(1);
    expect(spec.claims.length).toBeGreaterThan(3);
    expect(spec.claims.every((claim) => claim.kind !== "observation" || claim.evidenceIds.length > 0)).toBe(true);
    expect(spec.claims.some((claim) => claim.category === "business_rule" && claim.text.includes("Email"))).toBe(true);
  });
});
