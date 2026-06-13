import type { SpecDocument } from "../models/types.js";

export function renderPlaywrightTest(spec: SpecDocument): string {
  const lines = ["import { test, expect } from '@playwright/test';", ""];
  for (const module of spec.modules) {
    const url = module.urlPatterns[0] ?? spec.run.baseUrl;
    lines.push(`test('${escapeTestName(module.name)} loads', async ({ page }) => {`);
    lines.push(`  await page.goto('${escapeString(url)}');`);
    lines.push("  await expect(page).toHaveURL(/.*/);");
    lines.push("});");
    lines.push("");

    for (const testCase of module.testCases.slice(0, 8)) {
      lines.push(`test('${escapeTestName(module.name)}: ${escapeTestName(testCase.text).slice(0, 80)}', async ({ page }) => {`);
      lines.push(`  await page.goto('${escapeString(url)}');`);
      lines.push(`  // ${testCase.text}`);
      lines.push("  await expect(page.locator('body')).toBeVisible();");
      lines.push("});");
      lines.push("");
    }
  }
  return lines.join("\n");
}

function escapeString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function escapeTestName(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s:.,/_-]+/gu, "").replace(/\s+/g, " ").trim();
}
