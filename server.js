import express from 'express';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runAudit } from './audit/runner.js';
import { getBrowser, closeBrowser, executableSource } from './audit/browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const ALLOW_LOCAL = process.env.ALLOW_LOCAL === '1';

// Normalize BASE_PATH: "" or "/" means root; otherwise ensure leading slash + no trailing.
function normalizeBase(p) {
  if (!p) return '';
  let s = String(p).trim();
  if (s === '/' || s === '') return '';
  if (!s.startsWith('/')) s = '/' + s;
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}
const BASE_PATH = normalizeBase(process.env.BASE_PATH);

// All routes attach to a router mounted at BASE_PATH (or root if unset).
const router = express.Router();

router.use(express.json({ limit: '32kb' }));

// /demo/ — a real-world WebMCP example (task tracker). Set an explicit
// Permissions-Policy: tools=self so the safety check passes.
router.use('/demo', express.static(join(__dirname, 'public', 'demo'), {
  setHeaders: (res) => {
    res.setHeader('Permissions-Policy', 'tools=self');
  }
}));

router.use(express.static(join(__dirname, 'public')));
router.use('/fixtures', express.static(join(__dirname, 'test', 'fixtures'), {
  setHeaders: (res) => {
    // Permit our fixture pages to be embedded so the safety check sees them as embeddable.
    res.setHeader('Permissions-Policy', 'tools=*');
  }
}));

const AuditRequest = z.object({
  url: z.string().url(),
  options: z.object({
    execute: z.boolean().optional(),
    timeoutMs: z.number().int().min(5000).max(30000).optional()
  }).optional()
});

function isAllowedUrl(parsed) {
  if (!/^https?:$/.test(parsed.protocol)) return false;
  if (ALLOW_LOCAL) return true;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return false;
  return true;
}

router.get('/api/health', async (_req, res) => {
  try {
    const { runtimeMode, browser } = await getBrowser();
    res.json({
      ok: true,
      webmcpRuntime: runtimeMode,
      browserVersion: await browser.version(),
      chromeSource: executableSource(),
      basePath: BASE_PATH || '/'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.post('/api/audit', async (req, res) => {
  const parsed = AuditRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues });
  }
  let url;
  try {
    url = new URL(parsed.data.url);
  } catch {
    return res.status(400).json({ error: 'invalid_url' });
  }
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'url_not_allowed', message: 'Only public http/https URLs are accepted. Set ALLOW_LOCAL=1 to audit localhost.' });
  }

  try {
    const result = await runAudit(url.toString(), parsed.data.options || {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'audit_failed', message: String(e.message || e) });
  }
});

// Mount router at BASE_PATH so the entire app moves underneath a subpath when set.
// When BASE_PATH is empty the router mounts at /. Visiting /foo/ when BASE_PATH=/foo
// returns index.html with `<base href="./">` so all relative URLs resolve correctly.
if (BASE_PATH) {
  // Redirect bare BASE_PATH (no trailing slash) so <base href="./"> resolves predictably.
  // Use a regex so it matches ONLY the path without trailing slash — Express's non-strict
  // mode otherwise treats /webmcp and /webmcp/ the same and creates a redirect loop.
  app.get(new RegExp(`^${BASE_PATH.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}$`),
    (_req, res) => res.redirect(301, BASE_PATH + '/'));
  app.use(BASE_PATH, router);
} else {
  app.use(router);
}

const server = app.listen(PORT, () => {
  const where = BASE_PATH ? `http://localhost:${PORT}${BASE_PATH}/` : `http://localhost:${PORT}`;
  console.log(`Web MCP auditor listening on ${where}`);
});

async function shutdown() {
  console.log('Shutting down…');
  await closeBrowser();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
