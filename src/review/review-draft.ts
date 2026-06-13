import type { SpecDocument } from "../models/types.js";

export type ReviewStatus = "draft" | "accepted" | "rejected" | "edited";

export interface ReviewClaim {
  claimId: string;
  status: ReviewStatus;
  reviewerNote: string;
  editedText?: string;
}

export interface ReviewDraft {
  runId: string;
  createdAt: string;
  claims: ReviewClaim[];
}

export function createReviewDraft(spec: SpecDocument): ReviewDraft {
  return {
    runId: spec.run.id,
    createdAt: new Date().toISOString(),
    claims: spec.claims.map((claim) => ({
      claimId: claim.id,
      status: "draft",
      reviewerNote: ""
    }))
  };
}
