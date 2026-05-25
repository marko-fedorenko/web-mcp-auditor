// Direct puppeteer test bypassing the auditor orchestration.
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const EXEC = 'D:\\github-projects\\web-mcp-testing\\chrome\\win64-149.0.7827.22\\chrome-win64\\chrome.exe';
const PROBE = readFileSync('D:\\github-projects\\web-mcp-testing\\audit\\probe.js', 'utf8');

console.log('Launching Chrome 149…');
const t0 = Date.now();
const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check']
});
console.log(`Launched in ${Date.now()-t0}ms; version: ${await browser.version()}`);

const ctx = await browser.createBrowserContext();
console.log('Created browser context');

const page = await ctx.newPage();
console.log('Created page');

await page.evaluateOnNewDocument(PROBE);
console.log('Probe injected');

const t1 = Date.now();
const res = await page.goto('http://localhost:3000/fixtures/imperative-only.html', { waitUntil: 'load', timeout: 10000 });
console.log(`Navigated in ${Date.now()-t1}ms; status: ${res.status()}`);

await new Promise(r => setTimeout(r, 2000));

const data = await page.evaluate(async () => {
  if (!window.__webmcpAudit) return { error: 'probe not installed' };
  return await window.__webmcpAudit.collect();
});
console.log('Collected probe data:');
console.log(JSON.stringify({
  modelContextPresent: data.runtime?.modelContextPresent,
  toolsCount: data.tools?.tools?.length,
  registrations: data.registrations?.length,
  declarative: data.declarative?.length,
  firstToolName: data.tools?.tools?.[0]?.name,
  firstToolSchemaType: typeof data.tools?.tools?.[0]?.inputSchema
}, null, 2));

await browser.close();
console.log('Done');
