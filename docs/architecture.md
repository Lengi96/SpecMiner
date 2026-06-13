# SpecMiner Architecture

SpecMiner uses a local-first evidence pipeline:

```text
CLI -> Session Runner -> Browser Adapter -> Event Recorder -> Page Analyzer
    -> Privacy Filter -> Artifact Store -> Evidence Graph -> Spec Generator -> Exporter
```

The MVP uses Playwright because it provides headed browser automation, screenshots, network events, and ARIA snapshots from Node.js. A browser extension is a strong V1 addition for recording inside a user's real browser profile, especially for enterprise SSO and managed-browser environments.

## Added MVP+ Capabilities

- HTML report with screenshot previews and claim/evidence links.
- Coverage report for URLs, page snapshots, actions, forms, tables, errors, clicked controls, and unclicked controls.
- Review draft file where every claim starts as `draft`.
- Playwright test skeleton export.
- Safe same-origin crawler that follows links only and does not submit forms.
- Local Ollama provider that writes separate draft notes without changing canonical claims.
- Browser overlay for manual capture, notes, and pause/resume.
- Screenshot masking for common form controls unless `--raw` is used.
