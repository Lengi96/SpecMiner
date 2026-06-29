import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactStore } from "../../src/artifacts/artifact-store.js";
import type { Run, SpecDocument } from "../../src/models/types.js";
import { createReviewDraft } from "../../src/review/review-draft.js";
import { serveStudio } from "../../src/web/studio-server.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

describe("SpecMiner Studio server", () => {
  it("serves run data on the actual dynamic port and summarizes privacy", async () => {
    const { runDir } = await createRun();
    const server = await serveStudio({ runDir, host: "127.0.0.1", port: 0 });
    cleanups.push(server.close);

    expect(server.url).not.toContain(":0/");
    const response = await fetch(`${server.url}api/run`);
    const body = await response.json() as { privacy: { profile: string; markers: Array<{ name: string; count: number }> } };

    expect(response.status).toBe(200);
    expect(body.privacy.profile).toBe("default");
    expect(body.privacy.markers).toContainEqual({ name: "EMAIL", count: 1 });
  });

  it("rejects cross-origin mutations and invalid JSON", async () => {
    const { runDir } = await createRun();
    const server = await serveStudio({ runDir, host: "127.0.0.1", port: 0 });
    cleanups.push(server.close);

    const crossOrigin = await fetch(`${server.url}api/workflow/generate`, {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    });
    const invalidJson = await fetch(`${server.url}api/workflow/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    const invalidMode = await fetch(`${server.url}api/workflow/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", mode: "unsafe" })
    });

    expect(crossOrigin.status).toBe(403);
    expect(invalidJson.status).toBe(400);
    expect(invalidMode.status).toBe(400);
  });

  it("validates and persists edited review text", async () => {
    const { runDir, run, spec } = await createRun();
    const server = await serveStudio({ runDir, host: "127.0.0.1", port: 0 });
    cleanups.push(server.close);
    const review = createReviewDraft(spec);
    review.claims[0] = { ...review.claims[0], status: "edited", editedText: "Updated requirement" };

    const valid = await fetch(`${server.url}api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(review)
    });
    const invalid = await fetch(`${server.url}api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...review, runId: "another-run" })
    });
    const incomplete = await fetch(`${server.url}api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...review, claims: [] })
    });
    const persisted = JSON.parse(await readFile(join(runDir, "review.json"), "utf8")) as typeof review;

    expect(valid.status).toBe(200);
    expect(invalid.status).toBe(400);
    expect(incomplete.status).toBe(400);
    expect(persisted.runId).toBe(run.id);
    expect(persisted.claims[0].editedText).toBe("Updated requirement");
  });
});

async function createRun(): Promise<{ runDir: string; run: Run; spec: SpecDocument }> {
  const root = await mkdtemp(join(tmpdir(), "specminer-studio-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const runDir = join(root, "run-001");
  const store = new ArtifactStore(runDir);
  const run: Run = {
    id: "run-001",
    startedAt: "2026-06-29T00:00:00.000Z",
    baseUrl: "https://example.com/",
    toolVersion: "0.1.0",
    privacyProfile: "default"
  };
  const spec: SpecDocument = {
    run,
    generatedAt: "2026-06-29T00:01:00.000Z",
    summary: "Example",
    claims: [{
      id: "claim-001",
      kind: "observation",
      category: "system",
      text: "The example page is visible.",
      evidenceIds: ["evidence-001"],
      confidence: "high"
    }],
    modules: [],
    openQuestions: []
  };
  await store.init();
  await store.writeRun(run);
  await store.appendEvidence({
    id: "evidence-001",
    runId: run.id,
    kind: "visible_text",
    url: run.baseUrl,
    timestamp: run.startedAt,
    textMasked: "Contact [EMAIL]",
    metadata: {}
  });
  await store.writeSpec(spec);
  await store.writeReviewDraft(createReviewDraft(spec));
  return { runDir, run, spec };
}
