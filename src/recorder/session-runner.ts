import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { BrowserContext, Page } from "playwright";
import { PageAnalyzer } from "../analyzer/page-analyzer.js";
import { ArtifactStore } from "../artifacts/artifact-store.js";
import { BrowserAdapter } from "../browser/browser-adapter.js";
import { TOOL_VERSION } from "../config/defaults.js";
import type { Evidence, RecordOptions, Run, UserAction } from "../models/types.js";
import { PrivacyEngine } from "../privacy/privacy-engine.js";
import { createId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";

type BrowserActionPayload = {
  type: UserAction["type"];
  url: string;
  selector?: string;
  label?: string;
  text?: string;
  value?: string;
  tagName?: string;
  inputType?: string;
};

export class SessionRunner {
  constructor(private readonly browserAdapter = new BrowserAdapter()) {}

  async record(options: RecordOptions): Promise<void> {
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

    await store.init();
    await store.writeRun(run);

    const session = await this.browserAdapter.launch(options.browser, options.headed);
    const capture = debounceAsync(async (page: Page, reason: string) => {
      try {
        await analyzer.capture(page, run.id, reason);
        output.write(`\nCaptured page state: ${page.url()}\n`);
      } catch (error) {
        output.write(`\nCapture failed: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }, 700);

    await this.installActionRecorder(session.context, store, privacy, run.id, options.raw, capture);
    this.installNavigationRecorder(session.page, store, privacy, run.id, options.raw, capture);
    this.installNetworkRecorder(session.page, store, privacy, run.id, options.raw);

    output.write(`SpecMiner recording started for ${options.url}\n`);
    if (options.stopAfterMs) {
      output.write(`Recording will stop automatically after ${options.stopAfterMs}ms.\n`);
    } else {
      output.write("Interact with the browser. Press ENTER in this terminal to stop and save.\n");
    }
    await session.page.goto(options.url, { waitUntil: "domcontentloaded" });
    await analyzer.capture(session.page, run.id, "initial-load");
    if (options.stopAfterMs) {
      await new Promise((resolve) => setTimeout(resolve, options.stopAfterMs));
    } else {
      await waitForEnter();
    }
    await capture.flush();
    await session.browser.close();
    output.write(`Recording complete. Artifacts written to ${options.outDir}\n`);
  }

  private async installActionRecorder(
    context: BrowserContext,
    store: ArtifactStore,
    privacy: PrivacyEngine,
    runId: string,
    raw: boolean,
    capture: DebouncedCapture
  ): Promise<void> {
    let paused = false;
    await context.exposeBinding("__specminerRecordAction", async ({ page }, payload: BrowserActionPayload) => {
      if (paused) {
        return;
      }
      const maskedPayload = raw ? payload : (privacy.maskUnknown(payload) as BrowserActionPayload);
      maskedPayload.url = raw ? payload.url : privacy.maskUrl(payload.url) ?? payload.url;
      const action: UserAction = {
        id: createId("act"),
        type: maskedPayload.type,
        beforeUrl: maskedPayload.url,
        timestamp: nowIso(),
        valueMasked: maskedPayload.value,
        metadata: {
          selector: maskedPayload.selector,
          label: maskedPayload.label,
          text: maskedPayload.text,
          tagName: maskedPayload.tagName,
          inputType: maskedPayload.inputType
        }
      };

      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "user_action",
        url: maskedPayload.url,
        timestamp: action.timestamp,
        selector: maskedPayload.selector,
        label: maskedPayload.label,
        textMasked: maskedPayload.text,
        metadata: { ...action }
      };

      action.targetEvidenceId = evidence.id;
      await store.appendEvent(action);
      await store.appendEvidence(evidence);
      capture(page, `action-${action.type}`);
    });

    await context.exposeBinding("__specminerCaptureNow", async ({ page }, reason: string) => {
      if (paused) {
        return;
      }
      const action: UserAction = {
        id: createId("act"),
        type: "capture",
        beforeUrl: raw ? page.url() : privacy.maskUrl(page.url()) ?? page.url(),
        timestamp: nowIso(),
        metadata: { reason }
      };
      await store.appendEvent(action);
      capture(page, `manual-${reason || "capture"}`);
    });

    await context.exposeBinding("__specminerRecordNote", async ({ page }, note: string) => {
      if (!note.trim()) {
        return;
      }
      const action: UserAction = {
        id: createId("act"),
        type: "note",
        beforeUrl: raw ? page.url() : privacy.maskUrl(page.url()) ?? page.url(),
        timestamp: nowIso(),
        valueMasked: raw ? note : privacy.maskText(note),
        metadata: { source: "overlay" }
      };
      await store.appendEvent(action);
      await store.appendEvidence({
        id: createId("ev"),
        runId,
        kind: "user_action",
        url: action.beforeUrl,
        timestamp: action.timestamp,
        textMasked: action.valueMasked,
        metadata: { ...action }
      });
    });

    await context.exposeBinding("__specminerSetPaused", async (_source, nextPaused: boolean) => {
      paused = nextPaused;
    });

    await context.addInitScript(() => {
      type Payload = {
        type: string;
        url: string;
        selector?: string;
        label?: string;
        text?: string;
        value?: string;
        tagName?: string;
        inputType?: string;
      };

      function cleanText(value: string | null | undefined): string | undefined {
        const cleaned = value?.replace(/\s+/g, " ").trim();
        return cleaned && cleaned.length > 0 ? cleaned.slice(0, 500) : undefined;
      }

      function selectorFor(element: Element): string {
        const id = element.getAttribute("id");
        if (id) {
          return `${element.tagName.toLowerCase()}#${CSS.escape(id)}`;
        }
        const name = element.getAttribute("name");
        if (name) {
          return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
        }
        const role = element.getAttribute("role");
        if (role) {
          return `${element.tagName.toLowerCase()}[role="${CSS.escape(role)}"]`;
        }
        return element.tagName.toLowerCase();
      }

      function labelFor(element: Element): string | undefined {
        const aria = element.getAttribute("aria-label");
        if (aria) {
          return aria;
        }
        const id = element.getAttribute("id");
        if (id) {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const text = cleanText(label?.textContent);
          if (text) {
            return text;
          }
        }
        return cleanText(element.closest("label")?.textContent) ?? cleanText(element.textContent);
      }

      function emit(payload: Payload): void {
        const binding = (window as unknown as { __specminerRecordAction?: (payload: Payload) => void }).__specminerRecordAction;
        if (binding) {
          binding(payload);
        }
      }

      document.addEventListener(
        "click",
        (event) => {
          const target = event.target instanceof Element ? event.target.closest("button, a, [role=button], input, select, textarea") : null;
          if (!target) {
            return;
          }
          emit({
            type: "click",
            url: location.href,
            selector: selectorFor(target),
            label: labelFor(target),
            text: cleanText(target.textContent),
            tagName: target.tagName.toLowerCase(),
            inputType: target.getAttribute("type") ?? undefined
          });
        },
        true
      );

      document.addEventListener(
        "change",
        (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
          if (!target || !("value" in target)) {
            return;
          }
          emit({
            type: target.tagName.toLowerCase() === "select" ? "select" : "fill",
            url: location.href,
            selector: selectorFor(target),
            label: labelFor(target),
            value: target.value,
            tagName: target.tagName.toLowerCase(),
            inputType: target.getAttribute("type") ?? undefined
          });
        },
        true
      );

      document.addEventListener(
        "submit",
        (event) => {
          const target = event.target instanceof Element ? event.target : undefined;
          emit({
            type: "submit",
            url: location.href,
            selector: target ? selectorFor(target) : undefined,
            label: target ? labelFor(target) : undefined,
            tagName: target?.tagName.toLowerCase()
          });
        },
        true
      );

      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "Enter" && event.key !== "Escape") {
            return;
          }
          const target = event.target instanceof Element ? event.target : undefined;
          emit({
            type: "keypress",
            url: location.href,
            selector: target ? selectorFor(target) : undefined,
            label: target ? labelFor(target) : undefined,
            text: event.key,
            tagName: target?.tagName.toLowerCase()
          });
        },
        true
      );

      function installOverlay(): void {
        if (document.getElementById("specminer-overlay")) {
          return;
        }
        const overlay = document.createElement("div");
        overlay.id = "specminer-overlay";
        overlay.style.cssText =
          "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111827;color:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.3);font:12px system-ui,sans-serif;padding:10px;display:flex;gap:8px;align-items:center";
        overlay.innerHTML =
          '<strong>SpecMiner</strong><button data-sm="capture">Capture</button><button data-sm="note">Note</button><button data-sm="pause">Pause</button>';
        for (const button of Array.from(overlay.querySelectorAll("button"))) {
          (button as HTMLButtonElement).style.cssText =
            "border:0;border-radius:5px;background:#2563eb;color:#fff;padding:5px 8px;font:12px system-ui,sans-serif;cursor:pointer";
        }
        let paused = false;
        overlay.addEventListener("click", (event) => {
          const target = event.target instanceof HTMLElement ? event.target.closest("button") : null;
          const action = target?.getAttribute("data-sm");
          const bindings = window as unknown as {
            __specminerCaptureNow?: (reason: string) => void;
            __specminerRecordNote?: (note: string) => void;
            __specminerSetPaused?: (paused: boolean) => void;
          };
          if (action === "capture") {
            bindings.__specminerCaptureNow?.("overlay");
          }
          if (action === "note") {
            const note = window.prompt("SpecMiner note for this screen");
            if (note) {
              bindings.__specminerRecordNote?.(note);
            }
          }
          if (action === "pause") {
            paused = !paused;
            if (target) {
              target.textContent = paused ? "Resume" : "Pause";
            }
            bindings.__specminerSetPaused?.(paused);
          }
        });
        document.documentElement.appendChild(overlay);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installOverlay, { once: true });
      } else {
        installOverlay();
      }
    });
  }

  private installNavigationRecorder(
    page: Page,
    store: ArtifactStore,
    privacy: PrivacyEngine,
    runId: string,
    raw: boolean,
    capture: DebouncedCapture
  ): void {
    page.on("framenavigated", async (frame) => {
      if (frame !== page.mainFrame()) {
        return;
      }
      const url = raw ? frame.url() : privacy.maskUrl(frame.url()) ?? frame.url();
      const action: UserAction = {
        id: createId("act"),
        type: "navigate",
        beforeUrl: url,
        afterUrl: url,
        timestamp: nowIso()
      };
      await store.appendEvent(action);
      await store.appendEvidence({
        id: createId("ev"),
        runId,
        kind: "url",
        url,
        timestamp: action.timestamp,
        metadata: {
          type: "navigation"
        }
      });
      capture(page, "navigation");
    });
  }

  private installNetworkRecorder(page: Page, store: ArtifactStore, privacy: PrivacyEngine, runId: string, raw: boolean): void {
    page.on("request", async (request) => {
      const url = raw ? request.url() : privacy.maskUrl(request.url()) ?? request.url();
      await store.appendEvidence({
        id: createId("ev"),
        runId,
        kind: "network",
        url,
        timestamp: nowIso(),
        metadata: {
          phase: "request",
          method: request.method(),
          resourceType: request.resourceType()
        }
      });
    });

    page.on("response", async (response) => {
      const url = raw ? response.url() : privacy.maskUrl(response.url()) ?? response.url();
      await store.appendEvidence({
        id: createId("ev"),
        runId,
        kind: "network",
        url,
        timestamp: nowIso(),
        metadata: {
          phase: "response",
          status: response.status(),
          statusText: response.statusText()
        }
      });
    });
  }
}

type DebouncedCapture = ((page: Page, reason: string) => void) & { flush: () => Promise<void> };

function debounceAsync(fn: (page: Page, reason: string) => Promise<void>, delayMs: number): DebouncedCapture {
  let timer: NodeJS.Timeout | undefined;
  let pending: { page: Page; reason: string } | undefined;
  let running: Promise<void> = Promise.resolve();

  const debounced = ((page: Page, reason: string) => {
    pending = { page, reason };
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      if (!pending) {
        return;
      }
      const next = pending;
      pending = undefined;
      running = running.then(() => fn(next.page, next.reason));
    }, delayMs);
  }) as DebouncedCapture;

  debounced.flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pending) {
      const next = pending;
      pending = undefined;
      running = running.then(() => fn(next.page, next.reason));
    }
    await running;
  };

  return debounced;
}

async function waitForEnter(): Promise<void> {
  const rl = createInterface({ input, output });
  await rl.question("");
  rl.close();
}
