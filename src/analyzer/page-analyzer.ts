import type { Page } from "playwright";
import { fileURLToPath } from "node:url";
import { ArtifactStore, safeFileStem } from "../artifacts/artifact-store.js";
import type {
  ElementObservation,
  Evidence,
  FieldObservation,
  FormObservation,
  PageSnapshot,
  TableObservation
} from "../models/types.js";
import { PrivacyEngine } from "../privacy/privacy-engine.js";
import { createId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";

interface RawPageAnalysis {
  title: string;
  visibleTexts: string[];
  forms: FormObservation[];
  buttons: ElementObservation[];
  tables: TableObservation[];
  errorMessages: string[];
}

export class PageAnalyzer {
  constructor(
    private readonly store: ArtifactStore,
    private readonly privacy: PrivacyEngine,
    private readonly raw: boolean
  ) {}

  async capture(page: Page, runId: string, reason: string): Promise<PageSnapshot> {
    const capturedAt = nowIso();
    const rawUrl = page.url();
    const url = this.raw ? rawUrl : this.privacy.maskUrl(rawUrl) ?? rawUrl;
    const rawAnalysis = await this.extractPageAnalysis(page);
    const analysis = this.raw ? rawAnalysis : (this.privacy.maskUnknown(rawAnalysis) as RawPageAnalysis);
    const evidenceIds: string[] = [];

    const screenshotEvidence = await this.captureScreenshot(page, runId, rawUrl, url, reason);
    evidenceIds.push(screenshotEvidence.id);
    await this.store.appendEvidence(screenshotEvidence);

    const accessibilityEvidence = await this.captureAccessibility(page, runId, url);
    if (accessibilityEvidence) {
      evidenceIds.push(accessibilityEvidence.id);
      await this.store.appendEvidence(accessibilityEvidence);
    }

    await this.appendTextEvidence(runId, url, analysis.visibleTexts, evidenceIds);
    await this.appendFormEvidence(runId, url, analysis.forms, evidenceIds);
    await this.appendButtonEvidence(runId, url, analysis.buttons, evidenceIds);
    await this.appendTableEvidence(runId, url, analysis.tables, evidenceIds);
    await this.appendErrorEvidence(runId, url, analysis.errorMessages, evidenceIds);

    const snapshot: PageSnapshot = {
      id: createId("page"),
      runId,
      url,
      title: analysis.title,
      capturedAt,
      screenshotEvidenceId: screenshotEvidence.id,
      accessibilityEvidenceId: accessibilityEvidence?.id,
      visibleTexts: analysis.visibleTexts,
      forms: analysis.forms,
      buttons: analysis.buttons,
      tables: analysis.tables,
      errorMessages: analysis.errorMessages,
      evidenceIds
    };

    const artifactPath = await this.store.writePageSnapshot(snapshot);
    await this.store.appendEvidence({
      id: createId("ev"),
      runId,
      kind: "url",
      url,
      timestamp: capturedAt,
      artifactPath,
      metadata: {
        title: snapshot.title,
        reason
      }
    });

    return snapshot;
  }

  private async captureScreenshot(page: Page, runId: string, rawUrl: string, evidenceUrl: string, reason: string): Promise<Evidence> {
    const stem = `${Date.now()}-${safeFileStem(new URL(rawUrl).pathname || "root")}`;
    const screenshot = await this.store.screenshotPath(stem);
    await this.withHiddenOverlay(page, async () => {
      await page.screenshot({
        path: screenshot.absolute,
        fullPage: true,
        mask: this.raw ? [] : [page.locator("input, textarea, select, [contenteditable=true]")]
      });
    });

    return {
      id: createId("ev"),
      runId,
      kind: "screenshot",
      url: evidenceUrl,
      timestamp: nowIso(),
      artifactPath: screenshot.relative,
      metadata: {
        reason,
        redaction: this.raw ? "disabled" : "masked common form controls",
        privacyNote: this.raw
          ? "Screenshots are stored as captured because raw mode is enabled."
          : "Common form controls are masked in screenshots. Use non-production data for highly sensitive workflows."
      }
    };
  }

  private async withHiddenOverlay(page: Page, callback: () => Promise<void>): Promise<void> {
    await page.evaluate(() => {
      const overlay = document.getElementById("specminer-overlay");
      if (overlay) {
        overlay.dataset.specminerPreviousDisplay = overlay.style.display;
        overlay.style.display = "none";
      }
    });
    try {
      await callback();
    } finally {
      await page.evaluate(() => {
        const overlay = document.getElementById("specminer-overlay");
        if (overlay) {
          overlay.style.display = overlay.dataset.specminerPreviousDisplay ?? "";
          delete overlay.dataset.specminerPreviousDisplay;
        }
      });
    }
  }

  private async captureAccessibility(page: Page, runId: string, url: string): Promise<Evidence | undefined> {
    try {
      const locator = page.locator("body");
      const ariaSnapshot = await locator.ariaSnapshot({ mode: "ai" });
      const textMasked = this.raw ? ariaSnapshot : this.privacy.maskText(ariaSnapshot);

      return {
        id: createId("ev"),
        runId,
        kind: "accessibility",
        url,
        timestamp: nowIso(),
        textMasked,
        metadata: {
          source: "playwright.locator(body).ariaSnapshot",
          mode: "ai"
        }
      };
    } catch (error) {
      return {
        id: createId("ev"),
        runId,
        kind: "accessibility",
        url,
        timestamp: nowIso(),
        textMasked: "Accessibility snapshot unavailable.",
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async appendTextEvidence(runId: string, url: string, texts: string[], evidenceIds: string[]): Promise<void> {
    for (const text of texts.slice(0, 80)) {
      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "visible_text",
        url,
        timestamp: nowIso(),
        textMasked: text,
        metadata: {}
      };
      evidenceIds.push(evidence.id);
      await this.store.appendEvidence(evidence);
    }
  }

  private async appendFormEvidence(runId: string, url: string, forms: FormObservation[], evidenceIds: string[]): Promise<void> {
    for (const form of forms) {
      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "form",
        url,
        timestamp: nowIso(),
        selector: form.selector,
        label: form.label,
        metadata: { ...form }
      };
      evidenceIds.push(evidence.id);
      await this.store.appendEvidence(evidence);

      for (const field of form.fields) {
        const fieldEvidence: Evidence = {
          id: createId("ev"),
          runId,
          kind: "field",
          url,
          timestamp: nowIso(),
          selector: field.selector,
          label: field.label ?? field.name,
          metadata: { ...field }
        };
        evidenceIds.push(fieldEvidence.id);
        await this.store.appendEvidence(fieldEvidence);
      }
    }
  }

  private async appendButtonEvidence(
    runId: string,
    url: string,
    buttons: ElementObservation[],
    evidenceIds: string[]
  ): Promise<void> {
    for (const button of buttons) {
      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "button",
        url,
        timestamp: nowIso(),
        selector: button.selector,
        role: button.role,
        label: button.label,
        textMasked: button.textMasked,
        metadata: { ...button }
      };
      evidenceIds.push(evidence.id);
      await this.store.appendEvidence(evidence);
    }
  }

  private async appendTableEvidence(runId: string, url: string, tables: TableObservation[], evidenceIds: string[]): Promise<void> {
    for (const table of tables) {
      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "table",
        url,
        timestamp: nowIso(),
        selector: table.selector,
        label: table.caption,
        metadata: { ...table }
      };
      evidenceIds.push(evidence.id);
      await this.store.appendEvidence(evidence);
    }
  }

  private async appendErrorEvidence(runId: string, url: string, errors: string[], evidenceIds: string[]): Promise<void> {
    for (const message of errors) {
      const evidence: Evidence = {
        id: createId("ev"),
        runId,
        kind: "error_message",
        url,
        timestamp: nowIso(),
        textMasked: message,
        metadata: {}
      };
      evidenceIds.push(evidence.id);
      await this.store.appendEvidence(evidence);
    }
  }

  private async extractPageAnalysis(page: Page): Promise<RawPageAnalysis> {
    if (fileURLToPath(import.meta.url).endsWith(".ts")) {
      // TSX/esbuild can emit this helper inside serialized page.evaluate callbacks.
      await page.evaluate("globalThis.__name ??= (target) => target");
    }
    return page.evaluate(() => {
      function cssPath(element: Element): string {
        const parts: string[] = [];
        let current: Element | null = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : "";
          if (id) {
            parts.unshift(`${tag}${id}`);
            break;
          }
          const siblings = Array.from(current.parentElement?.children ?? []).filter(
            (sibling) => sibling.tagName === current?.tagName
          );
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}:nth-of-type(${Math.max(index, 1)})`);
          current = current.parentElement;
        }
        return parts.length > 0 ? parts.join(" > ") : "body";
      }

      function cleanText(value: string | null | undefined): string | undefined {
        const cleaned = value?.replace(/\s+/g, " ").trim();
        return cleaned && cleaned.length > 0 ? cleaned : undefined;
      }

      function labelFor(control: Element): string | undefined {
        const id = control.getAttribute("id");
        if (id) {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const text = cleanText(label?.textContent);
          if (text) {
            return text;
          }
        }
        return cleanText(control.closest("label")?.textContent) ?? control.getAttribute("aria-label") ?? undefined;
      }

      function isSpecMinerUi(element: Element): boolean {
        return Boolean(element.closest("#specminer-overlay"));
      }

      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      bodyClone.querySelector("#specminer-overlay")?.remove();
      const visibleTexts = Array.from(bodyClone.innerText.split(/\r?\n/))
        .map((line) => cleanText(line))
        .filter((line): line is string => Boolean(line))
        .filter((line, index, all) => all.indexOf(line) === index)
        .slice(0, 250);

      const forms = Array.from(document.querySelectorAll("form"))
        .filter((form) => !isSpecMinerUi(form))
        .map((form) => {
        const fields = Array.from(form.querySelectorAll("input, textarea, select")).map((field) => {
          const input = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          return {
            selector: cssPath(input),
            name: input.getAttribute("name") ?? undefined,
            label: labelFor(input),
            type: input.getAttribute("type") ?? input.tagName.toLowerCase(),
            required: input.hasAttribute("required") || input.getAttribute("aria-required") === "true",
            placeholder: input.getAttribute("placeholder") ?? undefined,
            valueMasked: "value" in input ? input.value : undefined
          };
        });

        const buttons = Array.from(form.querySelectorAll("button, input[type=button], input[type=submit]")).map(
          (button) => ({
            selector: cssPath(button),
            role: button.getAttribute("role") ?? "button",
            label: button.getAttribute("aria-label") ?? cleanText(button.textContent),
            textMasked: cleanText(button.textContent),
            disabled: (button as HTMLButtonElement).disabled
          })
        );

        return {
          selector: cssPath(form),
          label: form.getAttribute("aria-label") ?? undefined,
          method: form.getAttribute("method") ?? undefined,
          action: form.getAttribute("action") ?? undefined,
          fields,
          buttons
        };
      });

      const buttons = Array.from(document.querySelectorAll("button, [role=button], a[href], input[type=button], input[type=submit]"))
        .filter((button) => !isSpecMinerUi(button))
        .map((button) => ({
        selector: cssPath(button),
        role: button.getAttribute("role") ?? (button.tagName.toLowerCase() === "a" ? "link" : "button"),
        label: button.getAttribute("aria-label") ?? cleanText(button.textContent) ?? button.getAttribute("value") ?? undefined,
        textMasked: cleanText(button.textContent) ?? button.getAttribute("value") ?? undefined,
        disabled: (button as HTMLButtonElement).disabled || button.getAttribute("aria-disabled") === "true"
      }));

      const tables = Array.from(document.querySelectorAll("table")).filter((table) => !isSpecMinerUi(table)).map((table) => {
        const headers = Array.from(table.querySelectorAll("th")).map((cell) => cleanText(cell.textContent) ?? "");
        const rows = Array.from(table.querySelectorAll("tbody tr, tr")).map((row) =>
          Array.from(row.querySelectorAll("td, th")).map((cell) => cleanText(cell.textContent) ?? "")
        );
        return {
          selector: cssPath(table),
          caption: cleanText(table.querySelector("caption")?.textContent),
          headers,
          rowCount: rows.length,
          sampleRows: rows.slice(0, 5)
        };
      });

      const errorMessages = Array.from(
        document.querySelectorAll('[role="alert"], [aria-live], [aria-invalid="true"], .error, .errors, .invalid, .validation')
      )
        .filter((node) => !isSpecMinerUi(node))
        .map((node) => cleanText(node.textContent))
        .filter((message): message is string => Boolean(message))
        .filter((message, index, all) => all.indexOf(message) === index);

      return {
        title: document.title,
        visibleTexts,
        forms,
        buttons,
        tables,
        errorMessages
      };
    });
  }
}
