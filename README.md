# SpecMiner

SpecMiner reconstructs requirements from existing web applications by recording observable UI evidence and generating traceable Markdown and JSON specifications.

The MVP is Playwright-first and local by default:

```bash
npm install
npm run build
npx specminer record https://example.com --out ./runs/example
npx specminer generate ./runs/example --format markdown,json --gherkin
```

Every generated claim is classified as `observation`, `derived`, `assumption`, or `open_question` and links back to evidence IDs.

## Commands

```bash
specminer record <url> --out ./runs/run-001
specminer crawl <url> --out ./runs/crawl --max-pages 5
specminer analyze ./runs/run-001
specminer generate ./runs/run-001 --format markdown,json,html --gherkin --review --playwright
specminer serve ./runs/run-001
specminer export-tests ./runs/run-001
specminer redact ./runs/run-001 --profile ./privacy.json
specminer validate ./runs/run-001
specminer providers list
specminer config init
```

## Privacy

SpecMiner masks common sensitive values before writing JSON/Markdown/HTML artifacts. Screenshot capture masks common form controls by default; `--raw` disables that behavior. Use non-production data where possible and keep `runs/` out of version control.

## LLM Providers

SpecMiner is deterministic by default. Optional LLM output is kept separate:

```bash
specminer generate ./runs/run-001 --provider local-ollama
```

This writes `llm-draft.md` and does not merge LLM text into `spec.json`.

## Architecture

```text
CLI -> Session Runner -> Browser Adapter -> Event Recorder -> Page Analyzer
    -> Privacy Filter -> Artifact Store -> Evidence Graph -> Spec Generator -> Exporter
```

## Review And Coverage

`generate` always writes `coverage.json`. Use `--review` to create `review.json` with draft claim statuses, `--format html` to create `report.html`, and `--playwright` to create `tests/generated.spec.ts`.

## SpecMiner Studio

Start the local web UI for a recorded run:

```bash
specminer serve ./runs/run-001
```

Studio is the recommended entry point for non-technical users. It shows coverage, claims, screenshots, recent evidence, and lets reviewers update `review.json` from the browser.

Guided workflow:

1. Open Studio.
2. Enter a website URL in **Neue Website analysieren**.
3. Choose **Manuell durchklicken** to open a browser and record user clicks, or **Schneller Überblick** for a background crawl.
4. Click **Start**.
5. For manual recording, explore the opened browser and click **Fertig** in Studio when done.
6. Studio generates Markdown, JSON, HTML, Gherkin, review data, and a Playwright skeleton automatically.
7. Use **Letzte Analysen** to reopen previous runs without terminal commands.

## Browser Overlay

During headed recording, SpecMiner injects a small overlay with `Capture`, `Note`, and `Pause` controls. Notes are stored as evidence-backed user actions.

## Hybrid Extension

The `extension/` folder contains a Chrome/Edge Manifest V3 skeleton for a future real-profile recorder. It passively records click/change events into local extension storage; CLI import is intentionally left as the next integration step.
