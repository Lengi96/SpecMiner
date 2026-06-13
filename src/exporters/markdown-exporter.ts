import type { SpecDocument, SpecClaim } from "../models/types.js";

export function renderMarkdown(spec: SpecDocument): string {
  const lines: string[] = [
    "# SpecMiner Report",
    "",
    "## Systembeschreibung",
    "",
    spec.summary,
    "",
    `- Base URL: ${spec.run.baseUrl}`,
    `- Run ID: ${spec.run.id}`,
    `- Generiert: ${spec.generatedAt}`,
    `- Datenschutzprofil: ${spec.run.privacyProfile}`,
    "",
    "## Modulübersicht",
    ""
  ];

  for (const module of spec.modules) {
    lines.push(`### ${module.name}`, "");
    lines.push(`- URLs: ${module.urlPatterns.join(", ")}`);
    lines.push(`- Evidenz: ${summarizeEvidence(module.evidenceIds)}`);
    lines.push("");
    pushClaims(lines, "User Stories", module.stories);
    pushClaims(lines, "Akzeptanzkriterien", module.acceptanceCriteria);
    pushClaims(lines, "Business Rules", module.businessRules);
    pushClaims(lines, "Testfallvorschläge", module.testCases);
  }

  pushClaims(lines, "Offene Fragen", spec.openQuestions);
  lines.push("## Traceability-Regel", "");
  lines.push("Jede Aussage ist als Beobachtung, Ableitung, Annahme oder offene Frage markiert und verweist auf Evidence IDs.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function pushClaims(lines: string[], title: string, claims: SpecClaim[]): void {
  lines.push(`## ${title}`, "");
  if (claims.length === 0) {
    lines.push("- Keine Einträge.", "");
    return;
  }

  for (const claim of claims) {
    lines.push(`- **${claim.kind} / ${claim.confidence}** ${claim.text}`);
    lines.push(`  - Evidence: ${summarizeEvidence(claim.evidenceIds)}`);
  }
  lines.push("");
}

function summarizeEvidence(evidenceIds: string[]): string {
  if (evidenceIds.length === 0) {
    return "none";
  }
  const shown = evidenceIds.slice(0, 6).join(", ");
  const remaining = evidenceIds.length - 6;
  return remaining > 0 ? `${shown}, ... (+${remaining} more)` : shown;
}
