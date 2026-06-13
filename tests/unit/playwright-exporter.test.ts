import { describe, expect, it } from "vitest";
import { renderPlaywrightTest } from "../../src/exporters/playwright-test-exporter.js";
import type { SpecDocument } from "../../src/models/types.js";

describe("renderPlaywrightTest", () => {
  it("creates a Playwright test skeleton from module test cases", () => {
    const spec = {
      run: { baseUrl: "https://app.test" },
      modules: [
        {
          name: "Home",
          urlPatterns: ["https://app.test/home"],
          testCases: [{ text: "Verify that Home loads at https://app.test/home and displays content." }]
        }
      ]
    } as SpecDocument;

    const output = renderPlaywrightTest(spec);

    expect(output).toContain("import { test, expect } from '@playwright/test';");
    expect(output).toContain("test('Home loads'");
    expect(output).toContain("await page.goto('https://app.test/home');");
  });
});
