import { describe, expect, it } from "vitest";
import { createReviewDraft } from "../../src/review/review-draft.js";
import type { SpecDocument } from "../../src/models/types.js";

describe("createReviewDraft", () => {
  it("wraps generated claims in draft review records", () => {
    const spec = {
      run: {
        id: "run_1",
        startedAt: "2026-06-13T00:00:00.000Z",
        baseUrl: "https://app.test",
        toolVersion: "0.1.0",
        privacyProfile: "default"
      },
      claims: [
        {
          id: "claim_1",
          kind: "derived",
          category: "user_story",
          text: "As a user...",
          evidenceIds: ["ev_1"],
          confidence: "medium"
        }
      ]
    } as SpecDocument;

    const draft = createReviewDraft(spec);

    expect(draft.claims).toEqual([
      expect.objectContaining({ claimId: "claim_1", status: "draft", reviewerNote: "" })
    ]);
  });
});
