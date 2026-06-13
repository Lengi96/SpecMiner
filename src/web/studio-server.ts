import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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

type WorkflowStatus = "idle" | "recording" | "crawling" | "stopping" | "generating" | "ready" | "failed";

interface WorkflowState {
  currentRoot: string;
  runsRoot: string;
  status: WorkflowStatus;
  activeRunDir?: string;
  lastRunDir?: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  log: string[];
  child?: ChildProcess;
}

interface RunSummary {
  dir: string;
  name: string;
  baseUrl: string;
  startedAt: string;
  claimCount: number;
  evidenceCount: number;
  isCurrent: boolean;
}

export async function serveStudio(options: StudioServerOptions): Promise<{ close: () => Promise<void>; url: string }> {
  const initialRoot = resolve(options.runDir);
  const state: WorkflowState = {
    currentRoot: initialRoot,
    runsRoot: dirname(initialRoot),
    status: "idle",
    lastRunDir: initialRoot,
    message: "Bereit.",
    log: []
  };
  const server = createServer(async (request, response) => {
    try {
      await routeRequest(state, request, response);
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

async function routeRequest(state: WorkflowState, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    send(response, 200, "text/html; charset=utf-8", renderStudioHtml());
    return;
  }
  if (url.pathname === "/api/workflow/status") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(publicWorkflowState(state)));
    return;
  }
  if (url.pathname === "/api/runs") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ runs: await listRuns(state) }));
    return;
  }
  if (url.pathname === "/api/runs/select" && request.method === "POST") {
    if (isBusy(state)) {
      send(response, 409, "application/json; charset=utf-8", JSON.stringify({ error: "Cannot switch runs while SpecMiner is recording or generating." }));
      return;
    }
    const body = JSON.parse(await readRequestBody(request)) as { dir?: string };
    const nextRoot = safeRunRoot(state, String(body.dir ?? ""));
    await new ArtifactStore(nextRoot).readRun();
    state.currentRoot = nextRoot;
    state.lastRunDir = nextRoot;
    state.message = "Analyse geladen.";
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(publicWorkflowState(state)));
    return;
  }
  if (url.pathname === "/api/workflow/start" && request.method === "POST") {
    const body = JSON.parse(await readRequestBody(request)) as { url?: string; mode?: "manual" | "crawl" };
    const targetUrl = String(body.url ?? "").trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Please enter a valid http(s) URL." }));
      return;
    }
    await startRecording(state, targetUrl, body.mode ?? "manual");
    send(response, 202, "application/json; charset=utf-8", JSON.stringify(publicWorkflowState(state)));
    return;
  }
  if (url.pathname === "/api/workflow/stop" && request.method === "POST") {
    await stopRecording(state);
    send(response, 202, "application/json; charset=utf-8", JSON.stringify(publicWorkflowState(state)));
    return;
  }
  if (url.pathname === "/api/workflow/generate" && request.method === "POST") {
    const runDir = state.activeRunDir ?? state.lastRunDir ?? state.currentRoot;
    void generateRun(state, runDir);
    send(response, 202, "application/json; charset=utf-8", JSON.stringify(publicWorkflowState(state)));
    return;
  }
  if (url.pathname === "/api/run") {
    const root = state.currentRoot;
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
    const root = state.currentRoot;
    const body = await readRequestBody(request);
    JSON.parse(body);
    await writeFile(join(root, "review.json"), body, "utf8");
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname.startsWith("/artifact/")) {
    const root = state.currentRoot;
    const relative = decodeURIComponent(url.pathname.slice("/artifact/".length));
    const path = safeJoin(root, relative);
    const contentType = contentTypeFor(path);
    send(response, 200, contentType, await readFile(path));
    return;
  }
  send(response, 404, "text/plain; charset=utf-8", "Not found");
}

async function startRecording(state: WorkflowState, targetUrl: string, mode: "manual" | "crawl"): Promise<void> {
  if (isBusy(state)) {
    throw new Error("A recording or generation is already running.");
  }
  const runDir = join(state.runsRoot, `${timestampStem()}-${urlStem(targetUrl)}`);
  state.status = mode === "crawl" ? "crawling" : "recording";
  state.activeRunDir = runDir;
  state.lastRunDir = runDir;
  state.startedAt = new Date().toISOString();
  state.finishedAt = undefined;
  state.message =
    mode === "crawl"
      ? "Safe crawl started. SpecMiner is collecting same-origin pages."
      : "Aufzeichnung gestartet. Nutze das geöffnete Browserfenster und klicke danach in Studio auf Fertig.";
  state.log = [];

  const cliPath = fileURLToPath(new URL("../cli/index.js", import.meta.url));
  const args =
    mode === "crawl"
      ? [cliPath, "crawl", targetUrl, "--out", runDir, "--max-pages", "5"]
      : [cliPath, "record", targetUrl, "--out", runDir, "--headed"];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"]
  });
  state.child = child;
  child.stdout.on("data", (chunk) => appendLog(state, chunk));
  child.stderr.on("data", (chunk) => appendLog(state, chunk));
  child.on("error", (error) => {
    state.status = "failed";
    state.message = error.message;
    state.child = undefined;
    appendLog(state, error.message);
  });
  child.on("close", (code) => {
    state.child = undefined;
    if (code !== 0) {
      state.status = "failed";
      state.message = `Recording failed with exit code ${code ?? "unknown"}.`;
      state.finishedAt = new Date().toISOString();
      return;
    }
    void generateRun(state, runDir);
  });
}

function isBusy(state: WorkflowState): boolean {
  return Boolean(state.child) || ["recording", "crawling", "stopping", "generating"].includes(state.status);
}

async function listRuns(state: WorkflowState): Promise<RunSummary[]> {
  const names = await readdir(state.runsRoot, { withFileTypes: true }).catch(() => []);
  const summaries = await Promise.all(
    names
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<RunSummary | undefined> => {
        const dir = join(state.runsRoot, entry.name);
        const store = new ArtifactStore(dir);
        try {
          const run = await store.readRun();
          const evidence = await store.readEvidence();
          const spec = await readOrGenerateSpec(dir, run, evidence, await store.readEvents(), await store.readPageSnapshots());
          return {
            dir,
            name: basename(dir),
            baseUrl: run.baseUrl,
            startedAt: run.startedAt,
            claimCount: spec.claims.length,
            evidenceCount: evidence.length,
            isCurrent: resolve(dir) === resolve(state.currentRoot)
          };
        } catch {
          return undefined;
        }
      })
  );
  return summaries
    .filter((run): run is RunSummary => Boolean(run))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 30);
}

function safeRunRoot(state: WorkflowState, dir: string): string {
  const resolved = resolve(dir);
  const runsRoot = resolve(state.runsRoot);
  if (resolved !== runsRoot && resolved.startsWith(`${runsRoot}${sep}`)) {
    return resolved;
  }
  const byName = resolve(join(runsRoot, dir));
  if (byName !== runsRoot && byName.startsWith(`${runsRoot}${sep}`)) {
    return byName;
  }
  throw new Error(`Run directory is outside the configured runs root: ${relative(runsRoot, resolved)}`);
}

async function stopRecording(state: WorkflowState): Promise<void> {
  if (!state.child || state.status !== "recording") {
    return;
  }
  state.status = "stopping";
  state.message = "Aufzeichnung wird beendet und gespeichert.";
  state.child.stdin?.write("\n");
}

async function generateRun(state: WorkflowState, runDir: string): Promise<void> {
  state.status = "generating";
  state.message = "Anforderungen, Review-Entwurf, Report, Gherkin und Playwright-Skeleton werden erzeugt.";
  const cliPath = fileURLToPath(new URL("../cli/index.js", import.meta.url));
  const child = spawn(process.execPath, [
    cliPath,
    "generate",
    runDir,
    "--format",
    "markdown,json,html",
    "--gherkin",
    "--review",
    "--playwright"
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });
  state.child = child;
  child.stdout.on("data", (chunk) => appendLog(state, chunk));
  child.stderr.on("data", (chunk) => appendLog(state, chunk));
  child.on("error", (error) => {
    state.status = "failed";
    state.message = error.message;
    state.child = undefined;
    appendLog(state, error.message);
  });
  child.on("close", (code) => {
    state.child = undefined;
    state.finishedAt = new Date().toISOString();
    if (code !== 0) {
      state.status = "failed";
      state.message = `Generation failed with exit code ${code ?? "unknown"}.`;
      return;
    }
    state.currentRoot = runDir;
    state.lastRunDir = runDir;
    state.activeRunDir = undefined;
    state.status = "ready";
    state.message = "Analyse fertig. Die generierten Anforderungen sind geladen.";
  });
}

function appendLog(state: WorkflowState, chunk: unknown): void {
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    state.log.push(line);
  }
  state.log = state.log.slice(-80);
}

function publicWorkflowState(state: WorkflowState) {
  return {
    status: state.status,
    currentRunDir: state.currentRoot,
    activeRunDir: state.activeRunDir,
    lastRunDir: state.lastRunDir,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    message: state.message,
    log: state.log
  };
}

function timestampStem(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function urlStem(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "website";
  } catch {
    return "website";
  }
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
