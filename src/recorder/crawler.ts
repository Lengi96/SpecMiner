import { PageAnalyzer } from "../analyzer/page-analyzer.js";
import { ArtifactStore } from "../artifacts/artifact-store.js";
import { BrowserAdapter } from "../browser/browser-adapter.js";
import { TOOL_VERSION } from "../config/defaults.js";
import type { CrawlOptions, Run } from "../models/types.js";
import { PrivacyEngine } from "../privacy/privacy-engine.js";
import { createId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";

export class SafeCrawler {
  constructor(private readonly browserAdapter = new BrowserAdapter()) {}

  async crawl(options: CrawlOptions): Promise<void> {
    const store = new ArtifactStore(options.outDir);
    const privacy = await PrivacyEngine.fromProfilePath(options.profilePath);
    const analyzer = new PageAnalyzer(store, privacy, options.raw);
    const run: Run = {
      id: createId("run"),
      startedAt: nowIso(),
      baseUrl: options.url,
      toolVersion: TOOL_VERSION,
      privacyProfile: options.raw ? "raw" : privacy.profileName
    };
    const session = await this.browserAdapter.launch(options.browser, options.headed);
    const queue = [options.url];
    const visited = new Set<string>();
    const origin = new URL(options.url).origin;

    await store.init();
    await store.writeRun(run);

    try {
      while (queue.length > 0 && visited.size < options.maxPages) {
        const url = queue.shift();
        if (!url || visited.has(url)) {
          continue;
        }
        visited.add(url);
        await session.page.goto(url, { waitUntil: "domcontentloaded" });
        await analyzer.capture(session.page, run.id, "crawl");
        const links = await session.page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .map((anchor) => (anchor as HTMLAnchorElement).href)
            .filter(Boolean)
        );
        for (const link of links) {
          const normalized = new URL(link);
          normalized.hash = "";
          if (normalized.origin === origin && !visited.has(normalized.toString())) {
            queue.push(normalized.toString());
          }
        }
      }
    } finally {
      await session.browser.close();
    }
  }
}
