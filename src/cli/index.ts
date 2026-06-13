#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import { ArtifactStore } from "../artifacts/artifact-store.js";
import { defaultPrivacyProfile } from "../config/defaults.js";
import { buildCoverageReport } from "../coverage/coverage-report.js";
import { renderGherkinFeatures } from "../exporters/gherkin-exporter.js";
import { renderHtmlReport } from "../exporters/html-exporter.js";
import { renderJson } from "../exporters/json-exporter.js";
import { renderMarkdown } from "../exporters/markdown-exporter.js";
import { renderPlaywrightTest } from "../exporters/playwright-test-exporter.js";
import { SpecGenerator } from "../generator/spec-generator.js";
import { createProvider, listProviders } from "../llm/providers.js";
import type { BrowserName, CrawlOptions, GenerateOptions, RecordOptions } from "../models/types.js";
import { PrivacyEngine } from "../privacy/privacy-engine.js";
import { SafeCrawler } from "../recorder/crawler.js";
import { SessionRunner } from "../recorder/session-runner.js";
import { createReviewDraft } from "../review/review-draft.js";
import { ensureDir, writeJson } from "../utils/fs.js";
import { serveStudio } from "../web/studio-server.js";

const program = new Command();

program.name("specminer").description("Evidence-based requirements mining for existing web applications.").version("0.1.0");

program
  .command("record")
  .argument("<url>", "URL to open in a headed browser")
  .option("-o, --out <dir>", "Output directory", "./runs/specminer-run")
  .option("--profile <path>", "Privacy profile JSON path")
  .option("--browser <name>", "Browser: chromium, firefox, webkit", "chromium")
  .option("--headed", "Run with visible browser", true)
  .option("--no-headed", "Run without a visible browser")
  .option("--stop-after-ms <ms>", "Stop automatically after the given milliseconds")
  .option("--raw", "Disable masking for JSON/Markdown artifacts")
  .action(
    async (
      url: string,
      options: { out: string; profile?: string; browser: BrowserName; headed: boolean; stopAfterMs?: string; raw?: boolean }
    ) => {
    const recordOptions: RecordOptions = {
      url,
      outDir: resolve(options.out),
      profilePath: options.profile ? resolve(options.profile) : undefined,
      browser: normalizeBrowser(options.browser),
      headed: options.headed,
      raw: Boolean(options.raw),
      stopAfterMs: options.stopAfterMs ? Number.parseInt(options.stopAfterMs, 10) : undefined
    };
    await new SessionRunner().record(recordOptions);
    }
  );

program
  .command("analyze")
  .argument("<runDir>", "Recorded run directory")
  .action(async (runDir: string) => {
    const store = new ArtifactStore(resolve(runDir));
    const run = await store.readRun();
    const evidence = await store.readEvidence();
    const events = await store.readEvents();
    const pages = await store.readPageSnapshots();
    console.log(`Run: ${run.id}`);
    console.log(`Base URL: ${run.baseUrl}`);
    console.log(`Evidence: ${evidence.length}`);
    console.log(`Events: ${events.length}`);
    console.log(`Page snapshots: ${pages.length}`);
    console.log(`Visited URLs: ${new Set(evidence.map((item) => item.url)).size}`);
  });

program
  .command("serve")
  .argument("<runDir>", "Recorded run directory")
  .option("--host <host>", "Host to bind", "127.0.0.1")
  .option("--port <port>", "Port to bind", "4317")
  .description("Start the local SpecMiner Studio web UI for a run")
  .action(async (runDir: string, options: { host: string; port: string }) => {
    const server = await serveStudio({
      runDir: resolve(runDir),
      host: options.host,
      port: Number.parseInt(options.port, 10)
    });
    console.log(`SpecMiner Studio running at ${server.url}`);
    console.log("Press Ctrl+C to stop.");
  });

program
  .command("crawl")
  .argument("<url>", "URL to safely crawl")
  .option("-o, --out <dir>", "Output directory", "./runs/specminer-crawl")
  .option("--profile <path>", "Privacy profile JSON path")
  .option("--browser <name>", "Browser: chromium, firefox, webkit", "chromium")
  .option("--headed", "Run with visible browser", false)
  .option("--max-pages <count>", "Maximum same-origin pages to visit", "5")
  .option("--raw", "Disable masking for JSON/Markdown artifacts")
  .description("Capture same-origin links without submitting forms or clicking buttons")
  .action(async (url: string, options: { out: string; profile?: string; browser: BrowserName; headed: boolean; maxPages: string; raw?: boolean }) => {
    const crawlOptions: CrawlOptions = {
      url,
      outDir: resolve(options.out),
      profilePath: options.profile ? resolve(options.profile) : undefined,
      browser: normalizeBrowser(options.browser),
      headed: options.headed,
      raw: Boolean(options.raw),
      maxPages: Number.parseInt(options.maxPages, 10)
    };
    await new SafeCrawler().crawl(crawlOptions);
    console.log(`Crawl complete. Artifacts written to ${crawlOptions.outDir}`);
  });

program
  .command("generate")
  .argument("<runDir>", "Recorded run directory")
  .option("--format <formats>", "Comma-separated formats: markdown,json,html", "markdown,json")
  .option("--gherkin", "Write Gherkin feature files")
  .option("--review", "Write review.json with draft claim statuses")
  .option("--playwright", "Write Playwright test skeleton")
  .option("--provider <name>", "Optional LLM provider for separate draft notes", "disabled")
  .action(async (runDir: string, options: { format: string; gherkin?: boolean; review?: boolean; playwright?: boolean; provider: string }) => {
    const generateOptions: GenerateOptions = {
      runDir: resolve(runDir),
      formats: parseFormats(options.format),
      gherkin: Boolean(options.gherkin),
      review: Boolean(options.review),
      playwright: Boolean(options.playwright),
      provider: options.provider
    };
    const spec = await generateSpec(generateOptions);
    console.log(`Generated ${spec.claims.length} claims in ${generateOptions.runDir}`);
  });

program
  .command("export-tests")
  .argument("<runDir>", "Recorded run directory")
  .description("Write Playwright test skeletons from generated or freshly derived specs")
  .action(async (runDir: string) => {
    const spec = await generateSpec({
      runDir: resolve(runDir),
      formats: ["json"],
      gherkin: false,
      review: false,
      playwright: true,
      provider: "disabled"
    });
    console.log(`Wrote Playwright skeleton for ${spec.modules.length} module(s).`);
  });

program
  .command("redact")
  .argument("<runDir>", "Recorded run directory")
  .option("--profile <path>", "Privacy profile JSON path")
  .option("--out <dir>", "Output directory for redacted copy")
  .action(async (runDir: string, options: { profile?: string; out?: string }) => {
    const sourceDir = resolve(runDir);
    const targetDir = resolve(options.out ?? `${sourceDir}-redacted`);
    const privacy = await PrivacyEngine.fromProfilePath(options.profile ? resolve(options.profile) : undefined);
    await redactRun(sourceDir, targetDir, privacy);
    console.log(`Redacted copy written to ${targetDir}`);
  });

program
  .command("validate")
  .argument("<runDir>", "Recorded run directory")
  .action(async (runDir: string) => {
    const result = await validateRun(resolve(runDir));
    if (!result.valid) {
      for (const issue of result.issues) {
        console.error(`- ${issue}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Run is valid.");
  });

program
  .command("providers")
  .command("list")
  .description("List available LLM provider adapters")
  .action(() => {
    for (const provider of listProviders()) {
      console.log(provider);
    }
  });

program
  .command("config")
  .command("init")
  .description("Write default SpecMiner privacy config")
  .option("--out <path>", "Config path", "./specminer.privacy.json")
  .action(async (options: { out: string }) => {
    const path = resolve(options.out);
    await writeJson(path, defaultPrivacyProfile);
    console.log(`Wrote ${path}`);
  });

await program.parseAsync(process.argv);

async function generateSpec(options: GenerateOptions) {
  const store = new ArtifactStore(options.runDir);
  const run = await store.readRun();
  const evidence = await store.readEvidence();
  const events = await store.readEvents();
  const pages = await store.readPageSnapshots();
  const spec = new SpecGenerator().generate(run, evidence, events, pages);
  const coverage = buildCoverageReport(evidence, events, pages);
  await store.writeCoverageReport(coverage);

  if (options.formats.includes("json")) {
    await store.writeSpec(spec);
    await writeFile(join(options.runDir, "spec.json"), renderJson(spec), "utf8");
  }
  if (options.formats.includes("markdown")) {
    await store.writeMarkdown(renderMarkdown(spec));
  }
  if (options.formats.includes("html")) {
    await store.writeHtml(renderHtmlReport(spec, coverage, evidence));
  }
  if (options.gherkin) {
    for (const feature of renderGherkinFeatures(spec)) {
      await store.writeFeature(feature.name, feature.content);
    }
  }
  if (options.review) {
    await store.writeReviewDraft(createReviewDraft(spec));
  }
  if (options.playwright) {
    await store.writePlaywrightTest(renderPlaywrightTest(spec));
  }
  if (options.provider !== "disabled") {
    const provider = createProvider(options.provider);
    const response = await provider.complete({
      system:
        "You are assisting requirements reconstruction. Do not invent facts. Separate observations, derivations, assumptions, and open questions. Reference evidence IDs when possible.",
      prompt:
        "Create concise reviewer notes from the supplied SpecMiner evidence. Do not create final requirements; this is a draft aid only.",
      evidence: {
        run,
        coverage,
        evidence: evidence.slice(0, 100),
        pages: pages.slice(0, 20)
      }
    });
    await store.writeLlmDraft(`# LLM Draft (${provider.name})\n\n${response.text}\n`);
  }
  return spec;
}

async function redactRun(sourceDir: string, targetDir: string, privacy: PrivacyEngine): Promise<void> {
  await ensureDir(targetDir);
  for (const name of ["run.json", "events.jsonl", "evidence.jsonl", "spec.json", "spec.md"]) {
    await redactFileIfExists(join(sourceDir, name), join(targetDir, name), privacy);
  }

  const pagesDir = join(sourceDir, "pages");
  const targetPagesDir = join(targetDir, "pages");
  await mkdir(targetPagesDir, { recursive: true });
  try {
    for (const name of await readdir(pagesDir)) {
      if (name.endsWith(".json")) {
        await redactFileIfExists(join(pagesDir, name), join(targetPagesDir, name), privacy);
      }
    }
  } catch {
    return;
  }
}

async function redactFileIfExists(source: string, target: string, privacy: PrivacyEngine): Promise<void> {
  try {
    const content = await readFile(source, "utf8");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, privacy.maskText(content) ?? content, "utf8");
  } catch {
    return;
  }
}

async function validateRun(runDir: string): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  const store = new ArtifactStore(runDir);
  try {
    await store.readRun();
  } catch {
    issues.push("Missing or invalid run.json.");
  }

  const evidence = await store.readEvidence();
  const pages = await store.readPageSnapshots();
  if (evidence.length === 0) {
    issues.push("No evidence entries found.");
  }
  for (const item of evidence) {
    if (!item.id || !item.kind || !item.url || !item.timestamp) {
      issues.push(`Invalid evidence entry: ${JSON.stringify(item)}`);
      break;
    }
  }
  for (const page of pages) {
    if (!page.id || !page.url || !page.capturedAt) {
      issues.push(`Invalid page snapshot: ${JSON.stringify(page)}`);
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}

function parseFormats(value: string): Array<"markdown" | "json" | "html"> {
  const formats = value.split(",").map((item) => item.trim().toLowerCase());
  const allowed = new Set(["markdown", "json", "html"]);
  for (const format of formats) {
    if (!allowed.has(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }
  }
  return formats as Array<"markdown" | "json" | "html">;
}

function normalizeBrowser(value: string): BrowserName {
  if (value === "chromium" || value === "firefox" || value === "webkit") {
    return value;
  }
  throw new Error(`Unsupported browser: ${value}`);
}
