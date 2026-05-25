// Pure DOM rendering — no innerHTML for any value that originates from the target site.
import { t, categoryText, checkText } from './i18n.js';

const STATUS_LABEL = { pass: '✓', warn: '!', fail: '✕', na: '–', info: 'i' };
const STATUS_TITLE = { pass: 'pass', warn: 'warn', fail: 'fail', na: 'n/a', info: 'info' };

export function renderReport(data, lang = 'en') {
  const root = el('div', 'report-root');

  root.appendChild(renderHero(data, lang));
  root.appendChild(renderVerdict(data, lang));
  root.appendChild(renderCategoryDonuts(data.categories || [], lang));

  (data.warnings || []).forEach((w) => {
    root.appendChild(el('div', 'banner banner-warn', w));
  });

  if (data.runtimeMode === 'unavailable' || data.runtimeMode === 'disabled') {
    const banner = el('div', 'banner banner-warn');
    banner.appendChild(el('strong', null, t(lang, 'runtimeUnavailableTitle') + ' '));
    banner.appendChild(text(t(lang, 'runtimeUnavailableBody')));
    root.appendChild(banner);
  }

  (data.categories || []).forEach((cat) => {
    root.appendChild(renderCategorySection(cat, lang));
  });

  root.appendChild(renderAboutPanel(lang));
  root.appendChild(renderRawSection(data, lang));

  return root;
}

function computeVerdictKind(data) {
  const cats = data.categories || [];
  const findingsByCheck = (id) => {
    for (const c of cats) for (const f of c.findings) if (f.checkId === id) return f;
    return null;
  };
  const apiPresent = findingsByCheck('runtime.api-present');
  const declCount = (data.rawProbe && data.rawProbe.declarative && data.rawProbe.declarative.length) || 0;
  const imperativeCount = (data.rawProbe && data.rawProbe.tools && data.rawProbe.tools.tools && data.rawProbe.tools.tools.length) || 0;

  if (data.runtimeMode === 'unavailable' || data.runtimeMode === 'disabled') {
    return { kind: 'degraded', imp: 0, decl: 0 };
  }
  if (apiPresent && apiPresent.status === 'fail') {
    return { kind: 'noApi', imp: 0, decl: 0 };
  }
  if (imperativeCount === 0 && declCount === 0) {
    return { kind: 'noTools', imp: 0, decl: 0 };
  }
  if (imperativeCount > 0 && declCount === 0) {
    return { kind: 'imperativeOnly', imp: imperativeCount, decl: 0 };
  }
  if (imperativeCount === 0 && declCount > 0) {
    return { kind: 'declarativeOnly', imp: 0, decl: declCount };
  }
  return { kind: 'both', imp: imperativeCount, decl: declCount };
}

function renderVerdict(data, lang) {
  const v = computeVerdictKind(data);
  const headKey = `verdict.${v.kind}Head`;
  const bodyKey = `verdict.${v.kind}Body`;
  const cssKind = v.kind.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  const vars = {
    n: v.imp || v.decl,
    imp: v.imp,
    decl: v.decl,
    s: (lang === 'en') ? ((v.imp + v.decl) === 1 ? '' : 's') : '',
    ed: '' // UK form override slot
  };
  const section = el('section', `verdict verdict-${cssKind}`);
  const icon = el('div', 'verdict-icon');
  icon.textContent = (v.kind === 'both' || v.kind === 'imperativeOnly' || v.kind === 'declarativeOnly') ? '✓'
                   : v.kind === 'noTools' ? 'ⓘ'
                   : v.kind === 'noApi' ? '✕'
                   : '!';
  section.appendChild(icon);
  const body = el('div', 'verdict-body');
  body.appendChild(el('h2', 'verdict-headline', t(lang, headKey, vars)));
  body.appendChild(el('p', 'verdict-text', t(lang, bodyKey, vars)));
  section.appendChild(body);
  return section;
}

function renderAboutPanel(lang) {
  const sec = el('section', 'about-panel');
  const det = el('details');
  det.appendChild(el('summary', null, t(lang, 'aboutSummary')));
  const body = el('div', 'about-body');
  body.appendChild(el('p', null, t(lang, 'aboutP1')));
  body.appendChild(el('p', null, t(lang, 'aboutP2')));
  body.appendChild(el('p', null, t(lang, 'aboutP3')));
  body.appendChild(el('p', null, t(lang, 'aboutP4')));
  det.appendChild(body);
  sec.appendChild(det);
  return sec;
}

function renderHero(data, lang) {
  const hero = el('section', 'hero');
  const left = el('div', 'hero-left');
  left.appendChild(scoreDonut(data.overallScore, 'big'));
  left.appendChild(el('div', 'hero-label', t(lang, 'overallScore')));
  hero.appendChild(left);

  const right = el('div', 'hero-right');
  right.appendChild(metaRow(t(lang, 'metaUrl'), data.finalUrl || data.url));
  right.appendChild(metaRow(t(lang, 'metaStatus'), String(data.httpStatus ?? '—')));
  right.appendChild(metaRow(t(lang, 'metaRuntime'), data.runtimeMode || '—'));
  right.appendChild(metaRow(t(lang, 'metaBrowser'), data.browserVersion || '—'));
  right.appendChild(metaRow(t(lang, 'metaDuration'), (data.durationMs || 0) + ' ms'));
  hero.appendChild(right);

  return hero;
}

function metaRow(label, value) {
  const row = el('div', 'meta-row');
  row.appendChild(el('span', 'meta-label', label));
  row.appendChild(el('span', 'meta-value', value));
  return row;
}

function renderCategoryDonuts(categories, lang) {
  const grid = el('section', 'category-donuts');
  categories.forEach((cat) => {
    const tx = categoryText(lang, cat.id, cat);
    const card = el('div', 'donut-card');
    card.appendChild(scoreDonut(cat.score, 'small'));
    card.appendChild(el('div', 'donut-label', tx.title));
    const counts = el('div', 'donut-counts');
    if (cat.passCount) counts.appendChild(badge('pass', t(lang, 'badgePass', { n: cat.passCount })));
    if (cat.warnCount) counts.appendChild(badge('warn', t(lang, 'badgeWarn', { n: cat.warnCount })));
    if (cat.failCount) counts.appendChild(badge('fail', t(lang, 'badgeFail', { n: cat.failCount })));
    if (cat.naCount)   counts.appendChild(badge('na',   t(lang, 'badgeNa',   { n: cat.naCount })));
    card.appendChild(counts);
    grid.appendChild(card);
  });
  return grid;
}

function renderCategorySection(cat, lang) {
  const tx = categoryText(lang, cat.id, cat);
  const sec = el('section', 'category-section');
  const header = el('h2', 'category-title');
  header.appendChild(scoreDot(cat.score));
  header.appendChild(text(' ' + tx.title));
  sec.appendChild(header);

  if (tx.description) {
    sec.appendChild(el('p', 'category-description', tx.description));
  }

  if (tx.hint) {
    const hint = el('div', 'category-hint');
    const head = el('div', 'category-hint-head');
    head.appendChild(el('span', 'category-hint-icon', 'ⓘ'));
    head.appendChild(el('span', 'category-hint-label', t(lang, 'hintLabel')));
    hint.appendChild(head);
    hint.appendChild(el('p', 'category-hint-body', tx.hint));
    sec.appendChild(hint);
  }

  const list = el('ul', 'findings');
  cat.findings.forEach((f) => {
    list.appendChild(renderFinding(f, lang));
  });
  sec.appendChild(list);
  return sec;
}

function renderFinding(f, lang) {
  const tx = checkText(lang, f.checkId, f);
  const li = el('li', `finding finding-${f.status}`);
  const head = el('div', 'finding-head');
  head.appendChild(statusChip(f.status));
  head.appendChild(el('span', 'finding-title', tx.title));
  if (f.toolName) {
    head.appendChild(el('span', 'finding-tool', f.toolName));
  }
  li.appendChild(head);
  li.appendChild(el('div', 'finding-message', f.message));

  if (tx.howToFix && (f.status === 'fail' || f.status === 'warn')) {
    const fix = el('details', 'finding-howfix');
    fix.appendChild(el('summary', 'finding-howfix-summary', t(lang, 'howToFix')));
    fix.appendChild(el('p', 'finding-howfix-body', tx.howToFix));
    li.appendChild(fix);
  }

  if (f.details) {
    const det = el('details', 'finding-details');
    det.appendChild(el('summary', null, t(lang, 'techDetails')));
    const pre = el('pre');
    pre.textContent = JSON.stringify(f.details, null, 2);
    det.appendChild(pre);
    li.appendChild(det);
  }

  if (f.docUrl) {
    const a = el('a', 'finding-doclink', t(lang, 'specDocs'));
    a.href = f.docUrl;
    a.target = '_blank';
    a.rel = 'noreferrer';
    li.appendChild(a);
  }

  return li;
}

function renderRawSection(data, lang) {
  const sec = el('section', 'raw-section');
  const details = el('details');
  details.appendChild(el('summary', null, t(lang, 'rawSection')));
  const dl = el('div', 'raw-actions');
  const dlBtn = el('button', 'btn-download', t(lang, 'downloadJson'));
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'webmcp-audit.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  dl.appendChild(dlBtn);
  details.appendChild(dl);
  const pre = el('pre', 'raw-pre');
  pre.textContent = JSON.stringify(data.rawProbe || {}, null, 2);
  details.appendChild(pre);
  sec.appendChild(details);
  return sec;
}

function scoreDonut(score, size) {
  const band = scoreBand(score);
  const wrap = el('div', `donut donut-${size} donut-${band}`);
  const v = el('div', 'donut-value');
  v.textContent = score == null ? '—' : String(score);
  wrap.appendChild(v);
  return wrap;
}

function scoreDot(score) {
  const band = scoreBand(score);
  const dot = el('span', `score-dot score-dot-${band}`);
  dot.title = score == null ? 'no score' : String(score);
  return dot;
}

function scoreBand(score) {
  if (score == null) return 'na';
  if (score >= 90) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function statusChip(status) {
  const s = el('span', `chip chip-${status}`);
  s.textContent = STATUS_LABEL[status] || '?';
  s.title = STATUS_TITLE[status] || status;
  return s;
}

function badge(kind, label) {
  return el('span', `badge badge-${kind}`, label);
}

function el(tag, className, textContent) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (textContent != null) n.textContent = textContent;
  return n;
}

function text(s) { return document.createTextNode(s); }
