import { buildEvidenceGraph, evidenceForUrl, type EvidenceGraph } from "../evidence/evidence-graph.js";
import type { Evidence, ModuleSpec, Run, SpecClaim, SpecDocument, UserAction, PageSnapshot } from "../models/types.js";
import { createId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";

export class SpecGenerator {
  generate(run: Run, evidence: Evidence[], events: UserAction[], pages: PageSnapshot[]): SpecDocument {
    const graph = buildEvidenceGraph(evidence, events, pages);
    const modules = this.createModules(graph);
    const claims = modules.flatMap((module) => [
      ...module.stories,
      ...module.acceptanceCriteria,
      ...module.businessRules,
      ...module.testCases
    ]);
    const openQuestions = this.createOpenQuestions(graph);

    return {
      run,
      generatedAt: nowIso(),
      summary: this.createSummary(run, graph),
      claims: [
        this.claim("observation", "system", `The application was observed at base URL ${run.baseUrl}.`, [evidence[0]?.id].filter(Boolean), "high"),
        ...claims,
        ...openQuestions
      ],
      modules,
      openQuestions
    };
  }

  private createSummary(run: Run, graph: EvidenceGraph): string {
    const urlCount = new Set(graph.evidence.map((item) => item.url)).size;
    const pageCount = graph.pages.length;
    const actionCount = graph.events.length;
    return `SpecMiner analyzed ${pageCount} page snapshot(s), ${urlCount} URL(s), and ${actionCount} user action(s) for ${run.baseUrl}.`;
  }

  private createModules(graph: EvidenceGraph): ModuleSpec[] {
    const pagesByPath = new Map<string, PageSnapshot[]>();
    for (const page of graph.pages) {
      const key = moduleNameFromUrl(page.url);
      pagesByPath.set(key, [...(pagesByPath.get(key) ?? []), page]);
    }

    if (pagesByPath.size === 0 && graph.evidence.length > 0) {
      const firstUrl = graph.evidence[0]?.url ?? "unknown";
      pagesByPath.set(moduleNameFromUrl(firstUrl), []);
    }

    return Array.from(pagesByPath.entries()).map(([name, pages]) => {
      const urls = [...new Set(pages.map((page) => page.url))];
      const moduleEvidence = urls.flatMap((url) => evidenceForUrl(graph, url)).map((item) => item.id);
      const evidenceIds = moduleEvidence.length > 0 ? moduleEvidence : graph.evidence.slice(0, 5).map((item) => item.id);
      const storyClaims = uniqueClaims(this.createStories(name, pages, evidenceIds));
      const acceptanceCriteria = uniqueClaims(this.createAcceptanceCriteria(name, pages, evidenceIds));
      const businessRules = uniqueClaims(this.createBusinessRules(name, pages, evidenceIds));
      const testCases = uniqueClaims(this.createTestCases(name, pages, evidenceIds));

      return {
        name,
        urlPatterns: urls.length > 0 ? urls : ["unknown"],
        evidenceIds,
        stories: storyClaims,
        acceptanceCriteria,
        businessRules,
        testCases
      };
    });
  }

  private createStories(name: string, pages: PageSnapshot[], evidenceIds: string[]): SpecClaim[] {
    const title = pages.find((page) => page.title)?.title;
    const mainLabel = title || name;
    const claims: SpecClaim[] = [
      this.claim(
        "derived",
        "user_story",
        `As a user, I want to access ${mainLabel} so that I can complete the workflow exposed by this screen.`,
        evidenceIds,
        "medium"
      )
    ];

    const forms = pages.flatMap((page) => page.forms);
    for (const form of forms.slice(0, 5)) {
      const label = form.label || form.fields.map((field) => field.label || field.name).filter(Boolean).join(", ") || "the form";
      claims.push(
        this.claim(
          "derived",
          "user_story",
          `As a user, I want to submit ${label} so that the system can process the entered information.`,
          evidenceIds,
          "medium"
        )
      );
    }

    return claims;
  }

  private createAcceptanceCriteria(name: string, pages: PageSnapshot[], evidenceIds: string[]): SpecClaim[] {
    const claims: SpecClaim[] = [];
    for (const page of pages) {
      claims.push(
        this.claim(
          "derived",
          "acceptance_criteria",
          `Given a user opens ${page.url}, when the page loads, then the system displays the observed ${name} content.`,
          page.evidenceIds,
          "high"
        )
      );

      for (const form of page.forms.slice(0, 5)) {
        const requiredFields = form.fields.filter((field) => field.required);
        const fieldList = requiredFields.map((field) => field.label || field.name || field.selector).join(", ");
        claims.push(
          this.claim(
            "derived",
            "acceptance_criteria",
            requiredFields.length > 0
              ? `Given a user submits ${form.label || "the form"}, when required fields (${fieldList}) are empty, then validation should prevent incomplete submission or display an error.`
              : `Given a user completes ${form.label || "the form"}, when the form is submitted, then the system should process the provided values.`,
            page.evidenceIds,
            "medium"
          )
        );
      }
    }

    return claims.length > 0
      ? claims
      : [this.claim("open_question", "acceptance_criteria", "No page snapshots were available to derive acceptance criteria.", evidenceIds, "low")];
  }

  private createBusinessRules(name: string, pages: PageSnapshot[], evidenceIds: string[]): SpecClaim[] {
    const claims: SpecClaim[] = [];
    for (const page of pages) {
      for (const form of page.forms) {
        const required = form.fields.filter((field) => field.required);
        if (required.length > 0) {
          claims.push(
            this.claim(
              "observation",
              "business_rule",
              `The ${name} workflow marks the following field(s) as required: ${required
                .map((field) => field.label || field.name || field.selector)
                .join(", ")}.`,
              page.evidenceIds,
              "high"
            )
          );
        }
      }

      for (const message of page.errorMessages.slice(0, 5)) {
        claims.push(this.claim("observation", "business_rule", `The UI exposes this validation or error message: ${message}`, page.evidenceIds, "high"));
      }
    }

    return claims.length > 0
      ? claims
      : [this.claim("open_question", "business_rule", `No explicit business rules were observed for ${name}.`, evidenceIds, "low")];
  }

  private createTestCases(name: string, pages: PageSnapshot[], evidenceIds: string[]): SpecClaim[] {
    const claims: SpecClaim[] = [];
    for (const page of pages) {
      claims.push(
        this.claim(
          "derived",
          "test_case",
          `Verify that ${name} loads at ${page.url} and displays the observed primary content.`,
          page.evidenceIds,
          "high"
        )
      );

      for (const button of page.buttons.slice(0, 8)) {
        claims.push(
          this.claim(
            "derived",
            "test_case",
            `Verify that activating "${button.label || button.textMasked || button.selector}" leads to the expected state change or navigation.`,
            page.evidenceIds,
            "medium"
          )
        );
      }

      for (const form of page.forms.slice(0, 5)) {
        claims.push(
          this.claim(
            "derived",
            "test_case",
            `Verify successful and invalid submission behavior for ${form.label || "the observed form"}.`,
            page.evidenceIds,
            "medium"
          )
        );
      }
    }

    return claims.length > 0
      ? claims
      : [this.claim("open_question", "test_case", "No UI observations were available to propose test cases.", evidenceIds, "low")];
  }

  private createOpenQuestions(graph: EvidenceGraph): SpecClaim[] {
    const questions: SpecClaim[] = [];
    const allEvidence = graph.evidence.slice(0, 10).map((item) => item.id);
    const clickedLabels = new Set(
      graph.events
        .filter((event) => event.type === "click")
        .map((event) => String(event.metadata?.label ?? event.metadata?.text ?? ""))
        .filter(Boolean)
    );
    const observedButtons = graph.pages.flatMap((page) => page.buttons);
    const unclicked = observedButtons.filter((button) => {
      const label = button.label || button.textMasked || "";
      return label && !clickedLabels.has(label);
    });
    const unclickedLabels = [...new Set(unclicked.map((button) => button.label || button.textMasked).filter(Boolean))];

    if (unclickedLabels.length > 0) {
      questions.push(
        this.claim(
          "open_question",
          "test_case",
          `The following observed controls were not clicked during recording and may need exploration: ${unclickedLabels
            .slice(0, 10)
            .join(", ")}.`,
          allEvidence,
          "medium"
        )
      );
    }

    if (graph.pages.length === 0) {
      questions.push(this.claim("open_question", "system", "No page snapshots were found. Was recording completed successfully?", allEvidence, "high"));
    }

    return questions;
  }

  private claim(
    kind: SpecClaim["kind"],
    category: SpecClaim["category"],
    text: string,
    evidenceIds: string[],
    confidence: SpecClaim["confidence"]
  ): SpecClaim {
    return {
      id: createId("claim"),
      kind,
      category,
      text,
      evidenceIds: evidenceIds.filter(Boolean),
      confidence
    };
  }
}

function moduleNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    return segment ? titleCase(segment.replace(/[-_]+/g, " ")) : "Home";
  } catch {
    return "Unknown";
  }
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function uniqueClaims(claims: SpecClaim[]): SpecClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.kind}:${claim.category}:${claim.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
