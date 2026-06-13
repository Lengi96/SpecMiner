import type { CoverageReport } from "../coverage/coverage-report.js";
import type { Evidence, SpecDocument } from "../models/types.js";

export function renderHtmlReport(spec: SpecDocument, coverage: CoverageReport, evidence: Array<Partial<Evidence>>): string {
  const screenshotEvidence = evidence.filter((item) => item.kind === "screenshot" && item.artifactPath);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SpecMiner Report</title>
    <style>
      body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;margin:0;background:#f6f7f9;color:#172033}
      header{background:#fff;border-bottom:1px solid #dce2ea;padding:24px 32px}
      main{display:grid;gap:24px;padding:24px 32px}
      section{background:#fff;border:1px solid #dce2ea;border-radius:8px;padding:20px}
      table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e6ebf2;padding:8px;text-align:left}
      .claim{border-left:4px solid #0f6b5c;padding:10px 12px;margin:10px 0;background:#f9fbfb}
      .meta{color:#5f6b7a;font-size:13px}.screenshots{display:flex;gap:16px;flex-wrap:wrap}
      img{border:1px solid #dce2ea;border-radius:6px;max-width:420px;width:100%}
      code{background:#eef2f7;padding:2px 4px;border-radius:4px}
    </style>
  </head>
  <body>
    <header>
      <h1>SpecMiner Report</h1>
      <p>${escapeHtml(spec.summary)}</p>
    </header>
    <main>
      <section>
        <h2>Coverage</h2>
        <table>
          <tbody>
            <tr><th>URLs</th><td>${coverage.urlCount}</td></tr>
            <tr><th>Page snapshots</th><td>${coverage.pageSnapshotCount}</td></tr>
            <tr><th>Actions</th><td>${coverage.actionCount}</td></tr>
            <tr><th>Forms</th><td>${coverage.formCount}</td></tr>
            <tr><th>Tables</th><td>${coverage.tableCount}</td></tr>
            <tr><th>Error messages</th><td>${coverage.errorMessageCount}</td></tr>
            <tr><th>Clicked controls</th><td>${escapeHtml(coverage.clickedControls.join(", ") || "none")}</td></tr>
            <tr><th>Unclicked controls</th><td>${escapeHtml(coverage.unclickedControls.join(", ") || "none")}</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Claims</h2>
        ${spec.claims.map(renderClaim).join("\n")}
      </section>
      <section>
        <h2>Screenshots</h2>
        <div class="screenshots">
          ${screenshotEvidence
            .map((item) => `<figure id="${escapeHtml(item.id ?? "")}"><img src="${escapeHtml(item.artifactPath ?? "")}" alt="Screenshot evidence" /><figcaption>${escapeHtml(item.id ?? "")}</figcaption></figure>`)
            .join("\n")}
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function renderClaim(claim: SpecDocument["claims"][number]): string {
  return `<article class="claim">
  <strong>${escapeHtml(claim.category)}</strong>
  <p>${escapeHtml(claim.text)}</p>
  <p class="meta">${escapeHtml(claim.kind)} / ${escapeHtml(claim.confidence)} · Evidence: ${claim.evidenceIds
    .map((id) => `<a href="#${escapeHtml(id)}">${escapeHtml(id)}</a>`)
    .join(", ")}</p>
</article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
