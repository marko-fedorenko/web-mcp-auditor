// Probe Chrome 149 with various flag combinations to find which one exposes navigator.modelContext.
// Run with: node scripts/flag-probe.js
import puppeteer from 'puppeteer';

const EXEC = 'D:\\github-projects\\web-mcp-testing\\chrome\\win64-149.0.7827.22\\chrome-win64\\chrome.exe';
const PROBE_URL = 'http://localhost:3000/fixtures/imperative-only.html';

const variants = [
  ['baseline (no flags)', []],
  ['WebMCPTesting only', ['--enable-features=WebMCPTesting']],
  ['WebMCP only', ['--enable-features=WebMCP']],
  ['ModelContext blink feature', ['--enable-blink-features=ModelContext']],
  ['both WebMCPTesting + blink ModelContext', ['--enable-features=WebMCPTesting', '--enable-blink-features=ModelContext']],
  ['experimental web platform', ['--enable-experimental-web-platform-features']],
  ['experimental + WebMCPTesting', ['--enable-experimental-web-platform-features', '--enable-features=WebMCPTesting']],
  ['AIModelContext feature', ['--enable-features=AIModelContext']]
];

for (const [label, extra] of variants) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EXEC,
      headless: 'new',
      args: [...extra, '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check']
    });
    const page = await browser.newPage();
    let result;
    try {
      await page.goto(PROBE_URL, { waitUntil: 'load', timeout: 8000 });
    } catch (e) {
      console.log(`[SKIP ${label}] navigation failed: ${e.message}`);
      await browser.close();
      continue;
    }
    result = await page.evaluate(() => ({
      hasModelContext: typeof navigator !== 'undefined' && !!navigator.modelContext,
      apiShape: navigator.modelContext ? {
        register: typeof navigator.modelContext.registerTool,
        get: typeof navigator.modelContext.getTools,
        exec: typeof navigator.modelContext.executeTool
      } : null,
      ua: navigator.userAgent
    }));
    console.log(`[${label}]`, JSON.stringify(result));
  } catch (e) {
    console.log(`[ERR ${label}]`, e.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
