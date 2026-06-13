import { appendFile, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { Evidence, PageSnapshot, Run, SpecDocument, UserAction } from "../models/types.js";
import { ensureDir, readJson, writeJson } from "../utils/fs.js";

export class ArtifactStore {
  constructor(readonly rootDir: string) {}

  get runPath(): string {
    return join(this.rootDir, "run.json");
  }

  get evidencePath(): string {
    return join(this.rootDir, "evidence.jsonl");
  }

  get eventsPath(): string {
    return join(this.rootDir, "events.jsonl");
  }

  async init(): Promise<void> {
    await Promise.all([
      ensureDir(this.rootDir),
      ensureDir(join(this.rootDir, "pages")),
      ensureDir(join(this.rootDir, "screenshots")),
      ensureDir(join(this.rootDir, "features"))
    ]);
  }

  async writeRun(run: Run): Promise<void> {
    await writeJson(this.runPath, run);
  }

  async readRun(): Promise<Run> {
    return readJson<Run>(this.runPath);
  }

  async appendEvidence(evidence: Evidence): Promise<void> {
    await this.appendJsonLine(this.evidencePath, evidence);
  }

  async appendEvent(action: UserAction): Promise<void> {
    await this.appendJsonLine(this.eventsPath, action);
  }

  async writePageSnapshot(snapshot: PageSnapshot): Promise<string> {
    const path = join(this.rootDir, "pages", `${snapshot.id}.json`);
    await writeJson(path, snapshot);
    return this.relativePath(path);
  }

  async screenshotPath(name: string): Promise<{ absolute: string; relative: string }> {
    const absolute = join(this.rootDir, "screenshots", `${name}.png`);
    await mkdir(join(this.rootDir, "screenshots"), { recursive: true });
    return { absolute, relative: this.relativePath(absolute) };
  }

  async writeSpec(spec: SpecDocument): Promise<void> {
    await writeJson(join(this.rootDir, "spec.json"), spec);
  }

  async writeMarkdown(markdown: string): Promise<void> {
    await writeFile(join(this.rootDir, "spec.md"), markdown, "utf8");
  }

  async writeHtml(html: string): Promise<void> {
    await writeFile(join(this.rootDir, "report.html"), html, "utf8");
  }

  async writeReviewDraft(content: unknown): Promise<void> {
    await writeJson(join(this.rootDir, "review.json"), content);
  }

  async writeCoverageReport(content: unknown): Promise<void> {
    await writeJson(join(this.rootDir, "coverage.json"), content);
  }

  async writePlaywrightTest(content: string): Promise<void> {
    await ensureDir(join(this.rootDir, "tests"));
    await writeFile(join(this.rootDir, "tests", "generated.spec.ts"), content, "utf8");
  }

  async writeLlmDraft(content: string): Promise<void> {
    await writeFile(join(this.rootDir, "llm-draft.md"), content, "utf8");
  }

  async writeFeature(name: string, content: string): Promise<void> {
    await ensureDir(join(this.rootDir, "features"));
    await writeFile(join(this.rootDir, "features", `${name}.feature`), content, "utf8");
  }

  async copyRedactedRunTo(targetDir: string): Promise<void> {
    await ensureDir(targetDir);
    for (const file of ["run.json", "events.jsonl", "evidence.jsonl", "spec.json", "spec.md"]) {
      try {
        await copyFile(join(this.rootDir, file), join(targetDir, file));
      } catch {
        continue;
      }
    }
  }

  async readEvidence(): Promise<Evidence[]> {
    return this.readJsonLines<Evidence>(this.evidencePath);
  }

  async readEvents(): Promise<UserAction[]> {
    return this.readJsonLines<UserAction>(this.eventsPath);
  }

  async readPageSnapshots(): Promise<PageSnapshot[]> {
    const pageDir = join(this.rootDir, "pages");
    try {
      const names = await readdir(pageDir);
      const snapshots = await Promise.all(
        names.filter((name) => name.endsWith(".json")).map((name) => readJson<PageSnapshot>(join(pageDir, name)))
      );
      return snapshots.sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
    } catch {
      return [];
    }
  }

  relativePath(path: string): string {
    return relative(this.rootDir, path).replace(/\\/g, "/");
  }

  private async appendJsonLine(path: string, value: unknown): Promise<void> {
    await ensureDir(this.rootDir);
    await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
  }

  private async readJsonLines<T>(path: string): Promise<T[]> {
    try {
      const content = await readFile(path, "utf8");
      return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T);
    } catch {
      return [];
    }
  }
}

export function safeFileStem(value: string): string {
  const cleaned = value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : basename(value);
}
