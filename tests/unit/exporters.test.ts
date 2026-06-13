import { describe, expect, it } from "vitest";
import { renderGherkinFeatures } from "../../src/exporters/gherkin-exporter.js";
import { renderMarkdown } from "../../src/exporters/markdown-exporter.js";
import type { SpecDocument } from "../../src/models/types.js";

describe("exporters", () => {
  const spec: SpecDocument = {
    run: {
      id: "run_1",
      startedAt: "2026-06-13T00:00:00.000Z",
      baseUrl: "https://example.test",
      toolVersion: "0.1.0",
      privacyProfile: "default"
    },
    generatedAt: "2026-06-13T00:00:00.000Z",
    summary: "Summary",
    claims: [],
    modules: [
      {
        name: "Home",
        urlPatterns: ["https://example.test"],
        evidenceIds: ["ev_1"],
        stories: [],
        acceptanceCriteria: [
          {
            id: "claim_1",
            kind: "derived",
            category: "acceptance_criteria",
            text: "Given a user opens the page, when the page loads, then content is visible.",
            evidenceIds: ["ev_1"],
            confidence: "high"
          }
        ],
        businessRules: [],
        testCases: []
      }
    ],
    openQuestions: []
  };

  it("renders markdown with evidence references", () => {
    expect(renderMarkdown(spec)).toContain("Evidence: ev_1");
  });

  it("renders gherkin features", () => {
    const features = renderGherkinFeatures(spec);

    expect(features[0]?.content).toContain("Feature: Home");
    expect(features[0]?.content).toContain("Given a user opens the page");
  });
});
