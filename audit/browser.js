import puppeteer from 'puppeteer';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const CHROME_FLAGS = [
  '--enable-features=WebMCPTesting',
  '--enable-blink-features=ModelContext',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check'
];

const MIN_CHROME_MAJOR_FOR_WEBMCP = 149;

let browserPromise = null;
let auditsServed = 0;
let resolvedExecutablePath = undefined;
let resolvedExecutableSource = 'puppeteer-bundled';
const RECYCLE_AFTER = 50;

function puppeteerCacheChromes() {
  // Look for chrome installed by `npx @puppeteer/browsers install chrome@<channel>`.
  // Two known locations: project-local ./chrome/ and ~/.cache/puppeteer/chrome/
  const roots = [
    join(PROJECT_ROOT, 'chrome'),
    process.env['HOME'] ? join(process.env['HOME'], '.cache', 'puppeteer', 'chrome') : null,
    process.env['USERPROFILE'] ? join(process.env['USERPROFILE'], '.cache', 'puppeteer', 'chrome') : null
  ].filter(Boolean);
  const out = [];
  const exe = process.platform === 'win32' ? 'chrome.exe'
            : process.platform === 'darwin' ? 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
            : 'chrome';
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries;
    try { entries = readdirSync(root); } catch { continue; }
    for (const dir of entries) {
      // dir looks like "win64-149.0.7827.22" or "linux-150.0.7860.0"
      const subdirHint = process.platform === 'win32' ? 'chrome-win64'
                       : process.platform === 'darwin' ? 'chrome-mac-x64'
                       : 'chrome-linux64';
      const p = join(root, dir, subdirHint, exe);
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}

function candidateChromePaths() {
  const list = [];
  // Puppeteer-installed chromes first (most likely to be the version we asked for)
  list.push(...puppeteerCacheChromes());
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const lad = process.env['LOCALAPPDATA'] || '';
    list.push(
      `${pf}\\Google\\Chrome SxS\\Application\\chrome.exe`,
      `${lad}\\Google\\Chrome SxS\\Application\\chrome.exe`,
      `${pf}\\Google\\Chrome Beta\\Application\\chrome.exe`,
      `${pf}\\Google\\Chrome Dev\\Application\\chrome.exe`,
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pfx86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${lad}\\Google\\Chrome\\Application\\chrome.exe`
    );
  } else if (process.platform === 'darwin') {
    list.push(
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    );
  } else {
    list.push(
      '/usr/bin/google-chrome-unstable',
      '/usr/bin/google-chrome-beta',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }
  return list.filter(Boolean);
}

function chromeMajorVersion(path) {
  try {
    if (process.platform === 'win32') {
      // ProductVersion via file metadata
      const out = execFileSync('powershell.exe', [
        '-NoProfile', '-Command',
        `(Get-Item -LiteralPath '${path.replace(/'/g, "''")}').VersionInfo.ProductVersion`
      ], { encoding: 'utf8', timeout: 4000 }).trim();
      const m = out.match(/^(\d+)\./);
      return m ? Number(m[1]) : null;
    }
    const out = execFileSync(path, ['--version'], { encoding: 'utf8', timeout: 4000 }).trim();
    const m = out.match(/(\d+)\.\d+\.\d+\.\d+/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function chooseExecutable() {
  // 1) Explicit env always wins
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    resolvedExecutableSource = 'PUPPETEER_EXECUTABLE_PATH';
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // 2) Search system Chrome installs; pick highest version >= 149
  const found = [];
  for (const p of candidateChromePaths()) {
    if (!existsSync(p)) continue;
    try { statSync(p); } catch { continue; }
    const major = chromeMajorVersion(p);
    if (major != null) found.push({ path: p, major });
  }
  const eligible = found.filter((c) => c.major >= MIN_CHROME_MAJOR_FOR_WEBMCP);
  if (eligible.length > 0) {
    eligible.sort((a, b) => b.major - a.major);
    resolvedExecutableSource = `system-chrome-${eligible[0].major}`;
    return eligible[0].path;
  }
  // 3) Fall back to puppeteer-bundled Chromium
  resolvedExecutableSource = found.length > 0
    ? `puppeteer-bundled (system Chrome ${found[0].major} too old; need ${MIN_CHROME_MAJOR_FOR_WEBMCP}+)`
    : 'puppeteer-bundled';
  return undefined;
}

async function launchHeadless() {
  if (resolvedExecutablePath === undefined) resolvedExecutablePath = chooseExecutable();
  return puppeteer.launch({
    headless: 'new',
    args: CHROME_FLAGS,
    executablePath: resolvedExecutablePath
  });
}

async function launchHeaded() {
  if (resolvedExecutablePath === undefined) resolvedExecutablePath = chooseExecutable();
  return puppeteer.launch({
    headless: false,
    args: CHROME_FLAGS,
    executablePath: resolvedExecutablePath
  });
}

async function openBrowserWithFallback() {
  if (process.env.WEBMCP_DISABLE === '1') {
    const browser = await launchHeadless();
    return { browser, runtimeMode: 'disabled' };
  }

  // We used to probe navigator.modelContext on a data: URL at startup to decide
  // the runtime mode. That gave false-negatives in Chrome 149+ because data: URLs
  // are opaque origins where the API is intentionally not exposed. The API IS
  // available on regular http(s) origins. So we now just launch with the flags and
  // let the per-page probe (audit/probe.js) report whether modelContext appeared
  // on the actual URL being audited — which is what users care about.
  const browser = await launchHeadless();
  const ver = await browser.version();
  const major = Number((ver.match(/Chrome\/(\d+)/) || [])[1] || 0);
  if (major === 0 || major >= MIN_CHROME_MAJOR_FOR_WEBMCP) {
    return { browser, runtimeMode: 'headless-new' };
  }
  // Chromium predates the WebMCP origin trial — degraded mode is the honest answer.
  return { browser, runtimeMode: 'unavailable' };
}

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = openBrowserWithFallback();
  }
  const ctx = await browserPromise;
  // Verify still connected
  if (!ctx.browser.connected) {
    browserPromise = openBrowserWithFallback();
    return browserPromise;
  }
  return ctx;
}

export async function recycleIfNeeded() {
  auditsServed += 1;
  if (auditsServed < RECYCLE_AFTER) return;
  auditsServed = 0;
  const old = browserPromise;
  browserPromise = openBrowserWithFallback();
  if (old) {
    try {
      const { browser } = await old;
      await browser.close().catch(() => {});
    } catch {}
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const { browser } = await browserPromise;
    await browser.close().catch(() => {});
  } catch {}
  browserPromise = null;
}

export async function browserVersion() {
  const { browser } = await getBrowser();
  return browser.version();
}

export function executableSource() {
  return resolvedExecutableSource;
}
