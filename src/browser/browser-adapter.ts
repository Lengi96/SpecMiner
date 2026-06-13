import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import type { BrowserName } from "../models/types.js";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export class BrowserAdapter {
  async launch(browserName: BrowserName, headed: boolean): Promise<BrowserSession> {
    const browserType = browserName === "firefox" ? firefox : browserName === "webkit" ? webkit : chromium;
    const browser = await browserType.launch({ headless: !headed });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    return { browser, context, page };
  }
}
