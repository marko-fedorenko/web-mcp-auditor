import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pTimeout from 'p-timeout';
import { getBrowser, recycleIfNeeded, executableSource } from './browser.js';
import { evaluateChecks } from './checks.js';
import { computeScores } from './scoring.js';
import { runExecutionTests } from './schema-tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBE_SRC = readFileSync(join(__dirname, 'probe.js'), 'utf8');

const NAV_TIMEOUT_MS = 15000;
const LATE_REG_WAIT_MS = 2000;

let activeAudits = 0;
const MAX_CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY || 2);
const waitQueue = [];

async function acquireSlot() {
  if (activeAudits < MAX_CONCURRENCY) {
    activeAudits += 1;
    return;
  }
  await new Promise((resolve) => waitQueue.push(resolve));
  activeAudits += 1;
}

function releaseSlot() {
  activeAudits -= 1;
  const next = waitQueue.shift();
  if (next) next();
}

async function runAuditInternal(url, options) {
  const startedAt = Date.now();
  const { browser, runtimeMode } = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const responseHeaders = {};
  let httpStatus = null;
  let finalUrl = url;
  const consoleMessages = [];

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'media' || type === 'font') return req.abort().catch(() => {});
      if (type === 'image' && (req.url().length > 256 || /\.(mp4|webm|gif)$/i.test(req.url()))) {
        return req.abort().catch(() => {});
      }
      req.continue().catch(() => {});
    });
    page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
    page.on('console', (msg) => {
      if (consoleMessages.length < 30) {
        consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 500) });
      }
    });

    await page.evaluateOnNewDocument(PROBE_SRC);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    } catch (navErr) {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    }

    await new Promise((r) => setTimeout(r, LATE_REG_WAIT_MS));

    const rawProbe = await page.evaluate(async () => {
      if (!window.__webmcpAudit) return { error: 'probe not installed' };
      return await window.__webmcpAudit.collect();
    });

    let executeResults = null;
    if (options && options.execute && rawProbe && rawProbe.tools && rawProbe.tools.available && Array.isArray(rawProbe.tools.tools)) {
      executeResults = await runExecutionTests(page, rawProbe.tools.tools);
    }
    if (response) {
      httpStatus = response.status();
      const headers = response.headers();
      for (const [k, v] of Object.entries(headers)) responseHeaders[k.toLowerCase()] = v;
      finalUrl = response.url();
    }

    const findings = evaluateChecks({
      rawProbe,
      responseHeaders,
      httpStatus,
      finalUrl,
      requestedUrl: url,
      runtimeMode,
      executeResults
    });

    const { overallScore, categories } = computeScores(findings);

    return {
      url,
      finalUrl,
      httpStatus,
      runtimeMode,
      browserVersion: await browser.version(),
      chromeSource: executableSource(),
      overallScore,
      categories,
      consoleMessages,
      rawProbe,
      executeResults,
      warnings: [],
      durationMs: Date.now() - startedAt
    };
  } finally {
    // Don't let a stuck Chrome block the response. If close() hangs, give up after 2s.
    const closeQuick = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    await closeQuick(page.close().catch(() => {}), 2000);
    await closeQuick(context.close().catch(() => {}), 2000);
  }
}

export async function runAudit(url, options = {}) {
  const timeoutMs = Math.min(Math.max(Number(options.timeoutMs) || 30000, 5000), 30000);
  await acquireSlot();
  try {
    const result = await pTimeout(runAuditInternal(url, options), {
      milliseconds: timeoutMs,
      message: `audit timed out after ${timeoutMs}ms`
    });
    return result;
  } catch (err) {
    if (err && err.name === 'TimeoutError') {
      return {
        url,
        runtimeMode: 'unknown',
        overallScore: 0,
        categories: [],
        warnings: [err.message],
        error: 'timeout',
        durationMs: timeoutMs
      };
    }
    return {
      url,
      runtimeMode: 'unknown',
      overallScore: 0,
      categories: [],
      warnings: [`audit error: ${err.message || err}`],
      error: 'audit_failed',
      durationMs: 0
    };
  } finally {
    releaseSlot();
    await recycleIfNeeded();
  }
}
