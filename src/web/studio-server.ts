import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { ArtifactStore } from "../artifacts/artifact-store.js";
import { buildCoverageReport } from "../coverage/coverage-report.js";
import { SpecGenerator } from "../generator/spec-generator.js";
import { createReviewDraft } from "../review/review-draft.js";
import { renderStudioHtml } from "./studio-html.js";

export interface StudioServerOptions {
  runDir: string;
  host: string;
  port: number;
}

export async function serveStudio(options: StudioServerOptions): Promise<{ close: () => Promise<void>; url: string }> {
  const root = resolve(options.runDir);
  const server = createServer(async (request, response) => {
    try {
      await routeRequest(root, request, response);
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolveListen) => server.listen(options.port, options.host, resolveListen));
  return {
    url: `http://${options.host}:${options.port}/`,
    close: () => new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())))
  };
}

async function routeRequest(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    send(response, 200, "text/html; charset=utf-8", renderStudioHtml());
    return;
  }
  if (url.pathname === "/api/run") {
    const store = new ArtifactStore(root);
    const run = await store.readRun();
    const evidence = await store.readEvidence();
    const events = await store.readEvents();
    const pages = await store.readPageSnapshots();
    const spec = await readOrGenerateSpec(root, run, evidence, events, pages);
    const coverage = buildCoverageReport(evidence, events, pages);
    const review = await readOrCreateReview(root, spec);
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ run, spec, coverage, evidence, events, pages, review }));
    return;
  }
  if (url.pathname === "/api/review" && request.method === "POST") {
    const body = await readRequestBody(request);
    JSON.parse(body);
    await writeFile(join(root, "review.json"), body, "utf8");
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname.startsWith("/artifact/")) {
    const relative = decodeURIComponent(url.pathname.slice("/artifact/".length));
    const path = safeJoin(root, relative);
    const contentType = contentTypeFor(path);
    send(response, 200, contentType, await readFile(path));
    return;
  }
  send(response, 404, "text/plain; charset=utf-8", "Not found");
}

async function readOrGenerateSpec(root: string, run: Awaited<ReturnType<ArtifactStore["readRun"]>>, evidence: Awaited<ReturnType<ArtifactStore["readEvidence"]>>, events: Awaited<ReturnType<ArtifactStore["readEvents"]>>, pages: Awaited<ReturnType<ArtifactStore["readPageSnapshots"]>>) {
  try {
    return JSON.parse(await readFile(join(root, "spec.json"), "utf8"));
  } catch {
    return new SpecGenerator().generate(run, evidence, events, pages);
  }
}

async function readOrCreateReview(root: string, spec: Awaited<ReturnType<typeof readOrGenerateSpec>>) {
  try {
    return JSON.parse(await readFile(join(root, "review.json"), "utf8"));
  } catch {
    return createReviewDraft(spec);
  }
}

function safeJoin(root: string, relative: string): string {
  const normalized = normalize(relative).replace(/^(\.\.(?:\/|\\|$))+/, "");
  const resolved = resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error("Artifact path escapes run directory.");
  }
  return resolved;
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ts")) return "text/typescript; charset=utf-8";
  return "application/octet-stream";
}

function send(response: ServerResponse, status: number, contentType: string, body: string | Buffer): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
