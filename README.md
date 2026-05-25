# Web MCP Auditor

A Lighthouse-style web app that audits any URL for [Web MCP](https://developer.chrome.com/docs/ai/webmcp) support — the proposed Chrome standard that lets sites expose structured tools (`navigator.modelContext.registerTool`) and HTML form annotations (`toolname`, `tooldescription`, …) to AI agents.

Paste a URL, get a report grouped by category: runtime detection, imperative inventory, declarative inventory, metadata quality, execution & safety.

## What it checks (16 checks, 5 categories)

| Category | Checks |
|---|---|
| Runtime detection | `navigator.modelContext` present; API shape (`registerTool` / `getTools` / `executeTool` all functions); registrations land within 2 s of load |
| Imperative inventory | ≥1 tool registered; unique names; snake_case name convention; no duplicate registrations |
| Declarative inventory | `[toolname]` paired with a `<form>`; every input has `toolparamtitle` + `toolparamdescription`; non-trivial `tooldescription` |
| Metadata quality | Description length 20–500 chars; `inputSchema` validates against JSON Schema 2020-12; every property is typed; `annotations.readOnlyHint` set explicitly |
| Execution & safety | `Permissions-Policy: tools=…` header present on cross-origin-embeddable pages; (opt-in) `executeTool` smoke-runs each tool with a synthesized input |

Tool execution is **opt-in** (`options.execute: true`). The default audit is read-only.

## Run locally (Windows / macOS)

```
npm install
npm start
```

Open `http://localhost:3000`. Three built-in fixtures live under `/fixtures/`:
- `imperative-only.html` — registers three well-formed tools
- `declarative-only.html` — two annotated forms
- `mixed-bad.html` — intentionally violates several checks

`npm install` downloads a bundled Chromium via Puppeteer. WebMCP needs the `--enable-features=WebMCPTesting` Chrome flag, which the auditor passes automatically; if `navigator.modelContext` still isn't exposed (older Chromium), the server runs in **degraded mode** — declarative-DOM and Permissions-Policy checks still run, runtime/imperative/execution checks are marked `n/a`.

To audit localhost URLs, set `ALLOW_LOCAL=1`.

## Run tests

```
npm test
```

Unit tests cover `audit/checks.js` against canned `rawProbe` blobs (no browser needed).

## API

```
POST /api/audit
Content-Type: application/json

{ "url": "https://example.com", "options": { "execute": false, "timeoutMs": 30000 } }
```

Response shape:
```jsonc
{
  "url": "...",
  "finalUrl": "...",
  "httpStatus": 200,
  "runtimeMode": "headless-new" | "headed-xvfb" | "unavailable" | "disabled",
  "browserVersion": "HeadlessChrome/…",
  "overallScore": 72,
  "categories": [
    { "id": "runtime", "title": "Runtime detection", "score": 100, "findings": [ ... ] },
    ...
  ],
  "rawProbe": { ... },
  "executeResults": null | [ ... ],
  "warnings": [],
  "durationMs": 18432
}
```

`GET /api/health` returns `{ ok, webmcpRuntime }`.

## Deploy with Docker

```
docker build -t webmcp-auditor .
docker run --rm -p 3000:3000 --shm-size=1g webmcp-auditor
```

The image is Debian + system `chromium` + `xvfb`. `xvfb-run` wraps `node server.js` so the headed-fallback path works inside the container. Memory: ~1 GB recommended (per-page Chromium is ~250 MB peak). Trade-off: Debian's chromium may lag the WebMCP origin trial. If the runtime stays `unavailable`, swap the base image for `ghcr.io/puppeteer/puppeteer:23` (bundled matched Chromium, ~3× larger).

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `AUDIT_CONCURRENCY` | `2` | Max simultaneous audits |
| `ALLOW_LOCAL` | unset | If `1`, allow `localhost`/RFC1918 URLs |
| `XVFB_AVAILABLE` | unset | If `1`, headed-Xvfb fallback is allowed on Linux |
| `WEBMCP_DISABLE` | unset | If `1`, force degraded mode (debugging) |
| `PUPPETEER_EXECUTABLE_PATH` | unset | Override Chromium binary (e.g. `/usr/bin/chromium`) |

## File layout

```
audit/
  browser.js        # Puppeteer launch + fallback ladder
  probe.js          # injected in-page collector
  runner.js         # orchestrator (queue, timeout, page lifecycle)
  checks-catalog.js # static metadata for every check
  checks.js         # pure rawProbe → findings[]
  scoring.js        # findings → per-category scores + overall
  schema-tools.js   # ajv + json-schema-faker, executeTool harness
public/             # static frontend (no framework)
test/
  checks.test.js    # vitest
  fixtures/         # 3 HTML fixtures served at /fixtures/
server.js
Dockerfile
```

## Known limits

- WebMCP is an origin trial / flagged feature; APIs may shift. The probe checks shape (function existence) rather than presence alone, so a renamed method shows up as a clear `runtime.api-shape` failure rather than a silent pass.
- Tools registered behind a user gesture (button click) won't be picked up — v1 does not synthesize gestures.
- The auditor visits public URLs; origin trial tokens belong to those sites, not to us — only the local `--enable-features=WebMCPTesting` flag matters here.
