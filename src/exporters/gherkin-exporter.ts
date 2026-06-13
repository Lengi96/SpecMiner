import type { ModuleSpec, SpecDocument } from "../models/types.js";

export function renderGherkinFeatures(spec: SpecDocument): Array<{ name: string; content: string }> {
  return spec.modules.map((module) => ({
    name: sanitizeFeatureName(module.name),
    content: renderFeature(module)
  }));
}

function renderFeature(module: ModuleSpec): string {
  const lines = [`Feature: ${module.name}`, ""];
  const criteria = module.acceptanceCriteria.filter((claim) => claim.kind !== "open_question");

  if (criteria.length === 0) {
    lines.push("  Scenario: Explore module behavior");
    lines.push(`    Given a user opens ${module.urlPatterns[0] ?? "the module"}`);
    lines.push("    When the observed workflow is executed");
    lines.push("    Then the expected behavior should be confirmed by a reviewer");
    return `${lines.join("\n")}\n`;
  }

  for (const criterion of criteria.slice(0, 10)) {
    const scenario = criterion.text.replace(/^Given\s+/i, "Given ");
    lines.push(`  Scenario: ${shortScenarioName(criterion.text)}`);
    for (const line of splitGivenWhenThen(scenario)) {
      lines.push(`    ${line}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function splitGivenWhenThen(text: string): string[] {
  const normalized = text.replace(/,\s+when\s+/i, "\nWhen ").replace(/,\s+then\s+/i, "\nThen ");
  const lines = normalized.split(/\n/).map((line) => line.trim());
  return lines.every((line) => /^(Given|When|Then)\b/.test(line)) ? lines : [`Given ${text}`, "When the workflow is executed", "Then the expected outcome is observed"];
}

function shortScenarioName(value: string): string {
  return value.replace(/^(Given|When|Then)\s+/i, "").slice(0, 80);
}

function sanitizeFeatureName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "feature";
}
