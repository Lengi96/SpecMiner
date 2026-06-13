export function renderStudioHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SpecMiner Studio</title>
    <style>
      :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f5f7fb;color:#172033}
      body{margin:0}
      header{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;background:#fff;border-bottom:1px solid #dbe3ef}
      main{display:grid;grid-template-columns:300px 1fr;min-height:calc(100vh - 69px)}
      aside{border-right:1px solid #dbe3ef;background:#fff;padding:20px;overflow:auto}
      section{padding:22px 28px;overflow:auto}
      h1{font-size:20px;margin:0}h2{font-size:18px;margin:0 0 12px}h3{font-size:15px;margin:18px 0 8px}
      button{border:1px solid #c8d2e2;border-radius:6px;background:#fff;color:#172033;font:inherit;font-weight:700;padding:8px 10px;cursor:pointer}
      button.primary{background:#0f6b5c;border-color:#0f6b5c;color:#fff}
      .tabs{display:flex;gap:8px;flex-wrap:wrap}.tab[aria-selected=true]{background:#172033;color:#fff;border-color:#172033}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.metric,.panel,.claim{background:#fff;border:1px solid #dbe3ef;border-radius:8px;padding:14px}
      .metric strong{display:block;font-size:24px}.muted{color:#657386;font-size:13px}.claim{margin-bottom:10px;border-left:4px solid #0f6b5c}
      .claim[data-kind=open_question]{border-left-color:#b45309}.claim[data-kind=assumption]{border-left-color:#6d28d9}
      code{background:#eef3f8;border-radius:4px;padding:2px 4px}select,textarea{font:inherit;border:1px solid #c8d2e2;border-radius:6px;padding:8px;width:100%;box-sizing:border-box}
      textarea{min-height:64px}.screens{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.screens img{width:100%;border:1px solid #dbe3ef;border-radius:8px;background:#fff}
      table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dbe3ef;border-radius:8px;overflow:hidden}td,th{border-bottom:1px solid #e6ebf2;padding:8px;text-align:left;font-size:13px}
      .hidden{display:none}
    </style>
  </head>
  <body>
    <header>
      <h1>SpecMiner Studio</h1>
      <div class="tabs" role="tablist">
        <button class="tab" data-view="overview" aria-selected="true">Overview</button>
        <button class="tab" data-view="claims">Claims</button>
        <button class="tab" data-view="evidence">Evidence</button>
        <button class="tab" data-view="review">Review</button>
      </div>
    </header>
    <main>
      <aside>
        <h2 id="runTitle">Loading...</h2>
        <p class="muted" id="runMeta"></p>
        <h3>Artifacts</h3>
        <p><a href="/artifact/spec.md" target="_blank">spec.md</a></p>
        <p><a href="/artifact/spec.json" target="_blank">spec.json</a></p>
        <p><a href="/artifact/report.html" target="_blank">report.html</a></p>
        <p><a href="/artifact/coverage.json" target="_blank">coverage.json</a></p>
        <p><a href="/artifact/review.json" target="_blank">review.json</a></p>
      </aside>
      <section>
        <div id="overview"></div>
        <div id="claims" class="hidden"></div>
        <div id="evidence" class="hidden"></div>
        <div id="review" class="hidden"></div>
      </section>
    </main>
    <script>
      let state;
      const views = ["overview","claims","evidence","review"];
      document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
          views.forEach((view) => {
            document.getElementById(view).classList.toggle("hidden", view !== button.dataset.view);
            document.querySelector('[data-view="' + view + '"]').setAttribute("aria-selected", String(view === button.dataset.view));
          });
        });
      });
      const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
      async function load() {
        state = await fetch("/api/run").then((response) => response.json());
        document.getElementById("runTitle").textContent = state.run.baseUrl;
        document.getElementById("runMeta").textContent = state.run.id + " · " + state.spec.claims.length + " claims";
        renderOverview(); renderClaims(); renderEvidence(); renderReview();
      }
      function renderOverview() {
        const c = state.coverage;
        document.getElementById("overview").innerHTML = '<h2>Overview</h2><div class="grid">' +
          metric("URLs", c.urlCount) + metric("Snapshots", c.pageSnapshotCount) + metric("Actions", c.actionCount) +
          metric("Forms", c.formCount) + metric("Tables", c.tableCount) + metric("Errors", c.errorMessageCount) +
          '</div><div class="panel"><h3>Unclicked controls</h3><p>' + esc(c.unclickedControls.join(", ") || "none") + '</p></div>';
      }
      function metric(label, value) { return '<div class="metric"><strong>' + esc(value) + '</strong><span class="muted">' + esc(label) + '</span></div>'; }
      function renderClaims() {
        document.getElementById("claims").innerHTML = '<h2>Claims</h2>' + state.spec.claims.map((claim) =>
          '<article class="claim" data-kind="' + esc(claim.kind) + '"><strong>' + esc(claim.category) + '</strong><p>' + esc(claim.text) +
          '</p><p class="muted">' + esc(claim.kind) + ' / ' + esc(claim.confidence) + ' · ' + esc(claim.evidenceIds.length) + ' evidence item(s)</p></article>'
        ).join("");
      }
      function renderEvidence() {
        const screenshots = state.evidence.filter((item) => item.kind === "screenshot" && item.artifactPath);
        document.getElementById("evidence").innerHTML = '<h2>Evidence</h2><div class="screens">' + screenshots.map((item) =>
          '<figure><img src="/artifact/' + esc(item.artifactPath) + '" alt="Screenshot"><figcaption class="muted">' + esc(item.id) + '</figcaption></figure>'
        ).join("") + '</div><h3>Recent evidence</h3><table><tbody>' + state.evidence.slice(0, 80).map((item) =>
          '<tr><td><code>' + esc(item.kind) + '</code></td><td>' + esc(item.label || item.textMasked || item.url) + '</td><td class="muted">' + esc(item.id) + '</td></tr>'
        ).join("") + '</tbody></table>';
      }
      function renderReview() {
        const byId = new Map(state.spec.claims.map((claim) => [claim.id, claim]));
        const claims = state.review.claims.map((entry) => ({ entry, claim: byId.get(entry.claimId) })).filter((item) => item.claim);
        document.getElementById("review").innerHTML = '<h2>Review</h2>' + claims.map(({ entry, claim }) =>
          '<article class="claim"><strong>' + esc(claim.category) + '</strong><p>' + esc(claim.text) + '</p>' +
          '<label>Status<select data-status="' + esc(entry.claimId) + '"><option>draft</option><option>accepted</option><option>rejected</option><option>edited</option></select></label>' +
          '<label>Note<textarea data-note="' + esc(entry.claimId) + '">' + esc(entry.reviewerNote) + '</textarea></label></article>'
        ).join("") + '<button class="primary" id="saveReview">Save review</button>';
        state.review.claims.forEach((entry) => {
          const select = document.querySelector('[data-status="' + entry.claimId + '"]');
          if (select) select.value = entry.status;
        });
        document.getElementById("saveReview").addEventListener("click", saveReview);
      }
      async function saveReview() {
        state.review.claims = state.review.claims.map((entry) => ({
          ...entry,
          status: document.querySelector('[data-status="' + entry.claimId + '"]')?.value ?? entry.status,
          reviewerNote: document.querySelector('[data-note="' + entry.claimId + '"]')?.value ?? entry.reviewerNote
        }));
        await fetch("/api/review", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(state.review) });
        alert("Review saved");
      }
      load().catch((error) => { document.body.innerHTML = "<pre>" + esc(error.stack || error.message) + "</pre>"; });
    </script>
  </body>
</html>`;
}
