export function renderStudioHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SpecMiner Studio</title>
    <style>
      :root {
        --bg: #f7f8fb;
        --surface: #ffffff;
        --surface-muted: #f1f5f8;
        --surface-strong: #e7eef3;
        --text: #14202b;
        --muted: #657383;
        --border: #d8e1e8;
        --accent: #0c817c;
        --accent-weak: #e3f5f3;
        --accent-strong: #075c58;
        --warn: #b56a00;
        --warn-weak: #fff4df;
        --danger: #bd2b2b;
        --success: #138a4f;
        --radius: 8px;
        --shadow: 0 18px 50px rgba(31, 44, 58, 0.08);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background: var(--bg);
      }

      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--bg); }
      button, input, select, textarea { font: inherit; }
      button { cursor: pointer; }
      a { color: var(--accent-strong); text-decoration: none; }
      a:hover { text-decoration: underline; }

      .studio {
        display: grid;
        grid-template-columns: 236px minmax(0, 1fr);
        min-height: 100vh;
      }

      .rail {
        background: var(--surface);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .brand {
        align-items: center;
        border-bottom: 1px solid var(--border);
        display: flex;
        gap: 12px;
        min-height: 76px;
        padding: 18px 18px;
      }

      .brand-mark {
        align-items: center;
        background: var(--text);
        border-radius: 8px;
        color: #fff;
        display: grid;
        flex: 0 0 auto;
        height: 36px;
        place-items: center;
        width: 36px;
      }

      .brand h1 { font-size: 16px; line-height: 1.1; margin: 0; }
      .brand span { color: var(--muted); display: block; font-size: 12px; margin-top: 3px; }

      .nav {
        display: grid;
        gap: 4px;
        padding: 14px 10px;
      }

      .nav button {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: var(--radius);
        color: #304050;
        display: flex;
        gap: 10px;
        min-height: 42px;
        padding: 10px 12px;
        text-align: left;
        width: 100%;
      }

      .nav button[aria-selected="true"] {
        background: var(--accent-weak);
        color: var(--accent-strong);
        font-weight: 700;
      }

      .rail-footer {
        border-top: 1px solid var(--border);
        margin-top: auto;
        padding: 16px 18px;
      }

      .server-dot {
        background: var(--success);
        border-radius: 999px;
        display: inline-block;
        height: 8px;
        margin-right: 8px;
        width: 8px;
      }

      .workspace { min-width: 0; }

      .topbar {
        align-items: center;
        background: rgba(255, 255, 255, 0.92);
        border-bottom: 1px solid var(--border);
        display: grid;
        gap: 14px;
        grid-template-columns: minmax(220px, 1fr) auto;
        min-height: 76px;
        padding: 14px 24px;
        position: sticky;
        top: 0;
        z-index: 5;
      }

      .run-title {
        align-items: center;
        display: flex;
        gap: 12px;
        min-width: 0;
      }

      .run-title strong {
        display: block;
        font-size: 15px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .run-title span { color: var(--muted); display: block; font-size: 12px; margin-top: 3px; }

      .status-chip, .kind-chip {
        align-items: center;
        border-radius: 999px;
        display: inline-flex;
        font-size: 12px;
        font-weight: 700;
        gap: 6px;
        line-height: 1;
        min-height: 26px;
        padding: 6px 9px;
      }

      .status-chip { background: #e7f7ee; color: var(--success); }
      .kind-chip { background: var(--surface-muted); color: #455667; border: 1px solid var(--border); }
      .kind-chip.observation { background: #e8f6f3; color: var(--accent-strong); border-color: #bde0da; }
      .kind-chip.derived { background: #eaf2ff; color: #265a99; border-color: #c8dcf7; }
      .kind-chip.open_question { background: var(--warn-weak); color: var(--warn); border-color: #f1d6a8; }
      .kind-chip.assumption { background: #f0ecff; color: #5b3bb6; border-color: #d8cdfc; }

      .top-actions {
        align-items: center;
        display: flex;
        gap: 10px;
      }

      .action {
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        display: inline-flex;
        gap: 8px;
        min-height: 38px;
        padding: 9px 12px;
      }

      .action.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .content {
        display: grid;
        gap: 18px;
        padding: 22px 24px 28px;
      }

      .metrics {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(5, minmax(150px, 1fr));
      }

      .metric {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        min-height: 116px;
        padding: 16px;
      }

      .metric-top {
        align-items: center;
        color: var(--muted);
        display: flex;
        font-size: 13px;
        justify-content: space-between;
      }

      .metric strong {
        display: block;
        font-size: 32px;
        letter-spacing: 0;
        line-height: 1;
        margin-top: 18px;
      }

      .metric small { color: var(--muted); display: block; margin-top: 7px; }
      .metric.warn small { color: var(--warn); }

      .main-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
      }

      .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .panel-head {
        align-items: center;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        min-height: 58px;
        padding: 14px 16px;
      }

      .panel-head h2 { font-size: 16px; margin: 0; }
      .panel-body { padding: 16px; }

      .coverage-layout {
        display: grid;
        gap: 18px;
        grid-template-columns: 180px minmax(0, 1fr);
      }

      .donut {
        align-items: center;
        background: conic-gradient(var(--accent) var(--coverage), var(--surface-strong) 0);
        border-radius: 999px;
        display: grid;
        height: 150px;
        justify-self: center;
        place-items: center;
        position: relative;
        width: 150px;
      }

      .donut::after {
        background: var(--surface);
        border-radius: 999px;
        content: "";
        height: 104px;
        position: absolute;
        width: 104px;
      }

      .donut strong, .donut span { position: relative; z-index: 1; }
      .donut strong { font-size: 32px; }
      .donut span { color: var(--muted); font-size: 12px; margin-top: 34px; position: absolute; }

      .bars { display: grid; gap: 13px; }
      .bar-row { display: grid; gap: 7px; }
      .bar-meta { display: flex; font-size: 13px; justify-content: space-between; }
      .bar-track { background: var(--surface-strong); border-radius: 999px; height: 8px; overflow: hidden; }
      .bar-fill { background: var(--accent); border-radius: 999px; height: 100%; width: var(--value); }

      .claim-list {
        display: grid;
        gap: 10px;
      }

      .claim {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
        padding: 12px;
      }

      .claim p { margin: 0; }
      .claim-title { font-weight: 700; margin-bottom: 6px; }
      .claim-text { color: #334456; font-size: 13px; line-height: 1.45; }
      .claim-meta { align-items: center; display: flex; flex-wrap: wrap; gap: 7px; }

      .evidence-preview {
        display: grid;
        gap: 14px;
      }

      .screenshot-frame {
        background: #f0f3f6;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        min-height: 250px;
        overflow: hidden;
        padding: 10px;
      }

      .screenshot-frame img {
        border: 1px solid var(--border);
        border-radius: 4px;
        display: block;
        max-height: 320px;
        object-fit: contain;
        width: 100%;
      }

      .table-wrap { overflow: auto; }
      table { border-collapse: collapse; table-layout: fixed; width: 100%; }
      th, td {
        border-bottom: 1px solid #e9eef3;
        font-size: 13px;
        overflow-wrap: anywhere;
        padding: 10px 8px;
        text-align: left;
        vertical-align: top;
      }
      th { color: var(--muted); font-size: 12px; text-transform: uppercase; }
      th:first-child, td:first-child { width: 92px; }
      th:last-child, td:last-child { width: 150px; }

      .truncate {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        max-height: 58px;
        overflow: hidden;
      }

      .evidence-id {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .view { display: none; }
      .view.active { display: block; }

      .toolbar {
        align-items: center;
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
      }

      .search {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        min-height: 40px;
        padding: 8px 11px;
        width: min(420px, 100%);
      }

      .review-card {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        display: grid;
        gap: 12px;
        margin-bottom: 12px;
        padding: 14px;
      }

      label { color: var(--muted); display: grid; font-size: 12px; gap: 6px; }
      select, textarea {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        padding: 9px 10px;
        width: 100%;
      }
      textarea { min-height: 76px; resize: vertical; }

      .hidden { display: none !important; }

      @media (max-width: 1100px) {
        .studio { grid-template-columns: 1fr; }
        .rail { display: none; }
        .main-grid { grid-template-columns: 1fr; }
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 680px) {
        .topbar { grid-template-columns: 1fr; }
        .top-actions { flex-wrap: wrap; }
        .metrics { grid-template-columns: 1fr; }
        .coverage-layout { grid-template-columns: 1fr; }
        .content { padding: 14px; }
      }
    </style>
  </head>
  <body>
    <div class="studio">
      <aside class="rail">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">${icon("layers")}</div>
          <div>
            <h1>SpecMiner Studio</h1>
            <span>Evidence review workspace</span>
          </div>
        </div>
        <nav class="nav" aria-label="Studio navigation">
          <button data-view-button="overview" aria-selected="true">${icon("home")}Overview</button>
          <button data-view-button="claims">${icon("file")}Claims</button>
          <button data-view-button="evidence">${icon("folder")}Evidence</button>
          <button data-view-button="review">${icon("check")}Review</button>
        </nav>
        <div class="rail-footer">
          <p><span class="server-dot"></span><strong>Studio server</strong></p>
          <p class="muted" id="railRun">Loading run...</p>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="run-title">
            <span class="status-chip">${icon("check")}Loaded</span>
            <div>
              <strong id="runTitle">Loading...</strong>
              <span id="runMeta">Fetching run artifacts</span>
            </div>
          </div>
          <div class="top-actions">
            <button class="action" id="refreshButton">${icon("refresh")}Refresh</button>
            <a class="action" href="/artifact/report.html" target="_blank">${icon("external")}HTML Report</a>
            <a class="action primary" href="/artifact/spec.md" target="_blank">${icon("download")}Spec</a>
          </div>
        </header>

        <main class="content">
          <section id="overview" class="view active">
            <div class="metrics" id="metrics"></div>
            <div class="main-grid">
              <div>
                <article class="panel">
                  <div class="panel-head">
                    <h2>Coverage Overview</h2>
                    <span class="kind-chip" id="coverageLabel">Calculated from evidence</span>
                  </div>
                  <div class="panel-body">
                    <div class="coverage-layout">
                      <div class="donut" id="coverageDonut" style="--coverage:0%">
                        <strong id="coveragePercent">0%</strong>
                        <span>Overall</span>
                      </div>
                      <div class="bars" id="coverageBars"></div>
                    </div>
                  </div>
                </article>

                <article class="panel" style="margin-top:18px">
                  <div class="panel-head">
                    <h2>Claims Review Queue</h2>
                    <button class="action" data-jump="claims">View all</button>
                  </div>
                  <div class="panel-body">
                    <div class="claim-list" id="claimQueue"></div>
                  </div>
                </article>
              </div>

              <div>
                <article class="panel">
                  <div class="panel-head">
                    <h2>Evidence Preview</h2>
                    <span class="kind-chip" id="previewCounter">0 screenshots</span>
                  </div>
                  <div class="panel-body evidence-preview" id="evidencePreview"></div>
                </article>

                <article class="panel" style="margin-top:18px">
                  <div class="panel-head">
                    <h2>Recent Evidence</h2>
                    <button class="action" data-jump="evidence">View all</button>
                  </div>
                  <div class="table-wrap">
                    <table>
                      <thead><tr><th>Type</th><th>Description</th><th>Evidence</th></tr></thead>
                      <tbody id="recentEvidence"></tbody>
                    </table>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section id="claims" class="view">
            <div class="toolbar">
              <input class="search" id="claimSearch" placeholder="Search claims, categories, confidence..." />
              <span class="kind-chip" id="claimCount">0 claims</span>
            </div>
            <div class="claim-list" id="claimsList"></div>
          </section>

          <section id="evidence" class="view">
            <div class="toolbar">
              <input class="search" id="evidenceSearch" placeholder="Search evidence, labels, selectors, URLs..." />
              <span class="kind-chip" id="evidenceCount">0 evidence</span>
            </div>
            <article class="panel">
              <div class="panel-head"><h2>Screenshots</h2><span class="kind-chip" id="screenshotCount">0</span></div>
              <div class="panel-body evidence-preview" id="screenshots"></div>
            </article>
            <article class="panel" style="margin-top:18px">
              <div class="panel-head"><h2>Evidence Table</h2></div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Kind</th><th>Label/Text</th><th>URL</th><th>ID</th></tr></thead>
                  <tbody id="evidenceRows"></tbody>
                </table>
              </div>
            </article>
          </section>

          <section id="review" class="view">
            <div class="toolbar">
              <button class="action primary" id="saveReview">${icon("check")}Save review</button>
              <span class="kind-chip" id="reviewCount">0 draft</span>
            </div>
            <div id="reviewList"></div>
          </section>
        </main>
      </div>
    </div>

    <script>
      let state;
      const views = ["overview", "claims", "evidence", "review"];
      const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
      const byId = (id) => document.getElementById(id);

      document.querySelectorAll("[data-view-button]").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.viewButton));
      });
      document.querySelectorAll("[data-jump]").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.jump));
      });
      byId("refreshButton").addEventListener("click", load);
      byId("claimSearch").addEventListener("input", renderClaims);
      byId("evidenceSearch").addEventListener("input", renderEvidence);

      function showView(viewName) {
        views.forEach((view) => {
          byId(view).classList.toggle("active", view === viewName);
          const button = document.querySelector('[data-view-button="' + view + '"]');
          if (button) button.setAttribute("aria-selected", String(view === viewName));
        });
      }

      async function load() {
        state = await fetch("/api/run").then((response) => response.json());
        byId("runTitle").textContent = state.run.baseUrl;
        byId("runMeta").textContent = state.run.id + " - " + state.spec.claims.length + " claims - " + state.evidence.length + " evidence";
        byId("railRun").textContent = state.run.privacyProfile + " profile - " + state.run.toolVersion;
        renderOverview();
        renderClaims();
        renderEvidence();
        renderReview();
      }

      function renderOverview() {
        const c = state.coverage;
        const totalControls = c.clickedControls.length + c.unclickedControls.length;
        const exploredControls = totalControls ? Math.round((c.clickedControls.length / totalControls) * 100) : 100;
        const overall = Math.round((Math.min(c.pageSnapshotCount, 6) / 6 * 35) + (Math.min(c.formCount, 4) / 4 * 20) + (Math.min(c.tableCount, 2) / 2 * 15) + (Math.min(c.errorMessageCount, 2) / 2 * 15) + (exploredControls / 100 * 15));
        byId("coverageDonut").style.setProperty("--coverage", overall + "%");
        byId("coveragePercent").textContent = overall + "%";
        byId("coverageLabel").textContent = c.pageSnapshotCount + " snapshots analyzed";
        byId("metrics").innerHTML = [
          metric("Claims", state.spec.claims.length, "Reviewable requirements", "file"),
          metric("Evidence", state.evidence.length, "Recorded observations", "folder"),
          metric("Screenshots", screenshots().length, "Masked visual states", "image"),
          metric("Open controls", c.unclickedControls.length, "Need exploration", "cursor", true),
          metric("Review", state.review.claims.filter((item) => item.status === "draft").length, "Draft claims", "check")
        ].join("");
        byId("coverageBars").innerHTML = [
          bar("Pages", c.pageSnapshotCount, 6),
          bar("Forms", c.formCount, 4),
          bar("Tables", c.tableCount, 2),
          bar("Errors", c.errorMessageCount, 2),
          bar("Clicked controls", c.clickedControls.length, Math.max(totalControls, 1))
        ].join("");
        byId("claimQueue").innerHTML = state.spec.claims.slice(0, 6).map(renderClaim).join("");
        renderPreview();
        renderRecentEvidence();
      }

      function metric(label, value, detail, iconName, warn) {
        return '<article class="metric ' + (warn ? "warn" : "") + '"><div class="metric-top"><span>' + esc(label) + '</span><span>' + iconSvg(iconName) + '</span></div><strong>' + esc(value) + '</strong><small>' + esc(detail) + '</small></article>';
      }

      function bar(label, value, max) {
        const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
        return '<div class="bar-row"><div class="bar-meta"><span>' + esc(label) + '</span><span>' + esc(value) + ' / ' + esc(max) + '</span></div><div class="bar-track"><div class="bar-fill" style="--value:' + percent + '%"></div></div></div>';
      }

      function renderPreview() {
        const shot = screenshots()[0];
        byId("previewCounter").textContent = screenshots().length + " screenshots";
        byId("evidencePreview").innerHTML = shot
          ? '<div class="screenshot-frame"><img src="/artifact/' + esc(shot.artifactPath) + '" alt="Screenshot evidence"></div><div><span class="kind-chip observation">screenshot</span> <span class="kind-chip">' + esc(shot.id) + '</span></div>'
          : '<p class="muted">No screenshot evidence found.</p>';
      }

      function renderRecentEvidence() {
        byId("recentEvidence").innerHTML = state.evidence.slice(0, 8).map((item) =>
          '<tr><td><span class="kind-chip">' + esc(item.kind) + '</span></td><td><div class="truncate">' + esc(labelForEvidence(item)) + '</div></td><td class="evidence-id">' + esc(shortId(item.id)) + '</td></tr>'
        ).join("");
      }

      function renderClaims() {
        const query = byId("claimSearch").value.toLowerCase();
        const claims = state.spec.claims.filter((claim) => JSON.stringify(claim).toLowerCase().includes(query));
        byId("claimCount").textContent = claims.length + " claims";
        byId("claimsList").innerHTML = claims.map(renderClaim).join("");
      }

      function renderClaim(claim) {
        return '<article class="claim"><div><div class="claim-meta"><span class="kind-chip ' + esc(claim.kind) + '">' + esc(claim.kind.replace("_", " ")) + '</span><span class="kind-chip">' + esc(claim.category) + '</span><span class="kind-chip">' + esc(claim.confidence) + '</span></div><p class="claim-text" style="margin-top:8px">' + esc(claim.text) + '</p></div><div class="muted">' + esc(claim.evidenceIds.length) + ' ev</div></article>';
      }

      function renderEvidence() {
        const query = byId("evidenceSearch").value.toLowerCase();
        const evidence = state.evidence.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
        const shots = screenshots();
        byId("evidenceCount").textContent = evidence.length + " evidence";
        byId("screenshotCount").textContent = shots.length + " files";
        byId("screenshots").innerHTML = shots.map((item) =>
          '<figure class="screenshot-frame"><img src="/artifact/' + esc(item.artifactPath) + '" alt="Screenshot evidence"><figcaption class="muted" style="padding:10px">' + esc(item.id) + '</figcaption></figure>'
        ).join("");
        byId("evidenceRows").innerHTML = evidence.slice(0, 200).map((item) =>
          '<tr><td><span class="kind-chip">' + esc(item.kind) + '</span></td><td><div class="truncate">' + esc(labelForEvidence(item)) + '</div></td><td class="muted"><div class="truncate">' + esc(item.url) + '</div></td><td class="evidence-id">' + esc(shortId(item.id)) + '</td></tr>'
        ).join("");
      }

      function renderReview() {
        const claims = new Map(state.spec.claims.map((claim) => [claim.id, claim]));
        byId("reviewCount").textContent = state.review.claims.filter((item) => item.status === "draft").length + " draft";
        byId("reviewList").innerHTML = state.review.claims.map((entry) => {
          const claim = claims.get(entry.claimId);
          if (!claim) return "";
          return '<article class="review-card"><div class="claim-meta"><span class="kind-chip ' + esc(claim.kind) + '">' + esc(claim.kind.replace("_", " ")) + '</span><span class="kind-chip">' + esc(claim.category) + '</span></div><p class="claim-text">' + esc(claim.text) + '</p><label>Status<select data-status="' + esc(entry.claimId) + '"><option>draft</option><option>accepted</option><option>rejected</option><option>edited</option></select></label><label>Reviewer note<textarea data-note="' + esc(entry.claimId) + '">' + esc(entry.reviewerNote) + '</textarea></label></article>';
        }).join("");
        state.review.claims.forEach((entry) => {
          const select = document.querySelector('[data-status="' + entry.claimId + '"]');
          if (select) select.value = entry.status;
        });
      }

      byId("saveReview").addEventListener("click", async () => {
        state.review.claims = state.review.claims.map((entry) => ({
          ...entry,
          status: document.querySelector('[data-status="' + entry.claimId + '"]')?.value ?? entry.status,
          reviewerNote: document.querySelector('[data-note="' + entry.claimId + '"]')?.value ?? entry.reviewerNote
        }));
        await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state.review, null, 2) });
        byId("saveReview").textContent = "Saved";
        setTimeout(() => { byId("saveReview").innerHTML = '${icon("check")}Save review'; }, 1200);
      });

      function screenshots() {
        return state.evidence.filter((item) => item.kind === "screenshot" && item.artifactPath);
      }

      function labelForEvidence(item) {
        return item.label || item.textMasked || item.selector || item.artifactPath || item.url || "";
      }

      function shortId(id) {
        return String(id || "").replace(/^(.{8}).*(.{6})$/, "$1...$2");
      }

      function iconSvg(name) {
        const icons = {
          file: '${icon("file")}',
          folder: '${icon("folder")}',
          image: '${icon("image")}',
          cursor: '${icon("cursor")}',
          check: '${icon("check")}'
        };
        return icons[name] || "";
      }

      load().catch((error) => {
        document.body.innerHTML = "<pre style='padding:24px'>" + esc(error.stack || error.message) + "</pre>";
      });
    </script>
  </body>
</html>`;
}

function icon(name: string): string {
  const attrs = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths: Record<string, string> = {
    layers: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h4"/><path d="M6 22v-4H2"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    image: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14H4Z"/><path d="m4 16 4-4 4 4 3-3 5 5"/><circle cx="15" cy="8" r="1"/>',
    cursor: '<path d="m4 3 7 17 2-7 7-2Z"/>'
  };
  return '<svg ' + attrs + '>' + (paths[name] ?? "") + '</svg>';
}
