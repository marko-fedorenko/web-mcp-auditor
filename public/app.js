import { renderReport } from './render.js';
import { detectLang, setLang, t, SUPPORTED_LANGS, categoryText, checkText } from './i18n.js';
import { CATEGORIES, CHECKS, SOURCES } from './catalog.js';

let currentLang = detectLang();

const form = document.getElementById('audit-form');
const urlInput = document.getElementById('url-input');
const execToggle = document.getElementById('execute-toggle');
const auditBtn = document.getElementById('audit-btn');
const statusEl = document.getElementById('status');
const reportEl = document.getElementById('report');

document.querySelectorAll('.example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const rel = btn.dataset.url;
    urlInput.value = new URL(rel, document.baseURI).toString();
    urlInput.focus();
  });
});

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    setLang(lang);
    applyChromeTranslations();
    // Re-render existing report if one is shown
    if (lastReport) {
      reportEl.replaceChildren(renderReport(lastReport, currentLang));
    }
  });
});

let inFlight = false;
let lastReport = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (inFlight) return;
  const url = urlInput.value.trim();
  if (!url) return;

  inFlight = true;
  auditBtn.disabled = true;
  auditBtn.textContent = t(currentLang, 'auditing');
  reportEl.classList.add('hidden');
  reportEl.replaceChildren();
  showStatus(t(currentLang, 'statusAuditing', { url }), 'info');

  try {
    const res = await fetch('api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { execute: execToggle.checked }
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showStatus(t(currentLang, 'statusError', { code: data.error || res.status, msg: data.message || '' }), 'error');
      return;
    }
    hideStatus();
    lastReport = data;
    reportEl.replaceChildren(renderReport(data, currentLang));
    reportEl.classList.remove('hidden');
  } catch (err) {
    showStatus(t(currentLang, 'statusNetwork', { msg: (err && err.message) || String(err) }), 'error');
  } finally {
    inFlight = false;
    auditBtn.disabled = false;
    auditBtn.textContent = t(currentLang, 'runAudit');
  }
});

function showStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (kind === 'error' ? 'status-error' : 'status-info');
}
function hideStatus() {
  statusEl.className = 'status hidden';
  statusEl.textContent = '';
}

function applyChromeTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    node.textContent = t(currentLang, key);
  });
  document.querySelectorAll('[data-i18n-attr-placeholder]').forEach((node) => {
    const key = node.dataset.i18nAttrPlaceholder;
    node.setAttribute('placeholder', t(currentLang, key));
  });
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('lang-btn-active', b.dataset.lang === currentLang);
  });
  document.title = t(currentLang, 'appTitle');
  renderInfoPanels();
}

function renderInfoPanels() {
  renderMethodology();
  renderSources();
  renderPrivacy();
}

function el(tag, className, txt) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (txt != null) n.textContent = txt;
  return n;
}

function renderMethodology() {
  const root = document.getElementById('methodology-body');
  if (!root) return;
  root.replaceChildren();
  root.appendChild(el('p', 'info-intro', t(currentLang, 'methodologyIntro')));
  CATEGORIES.forEach((cat) => {
    const tx = categoryText(currentLang, cat.id, {});
    const section = el('div', 'method-category');
    section.appendChild(el('h4', 'method-category-title', tx.title));
    if (tx.description) section.appendChild(el('p', 'method-category-desc', tx.description));
    const table = el('table', 'method-table');
    const thead = el('thead');
    const trh = el('tr');
    trh.appendChild(el('th', null, t(currentLang, 'methodologyCheck')));
    trh.appendChild(el('th', 'th-narrow', t(currentLang, 'methodologySev')));
    trh.appendChild(el('th', 'th-narrow', t(currentLang, 'methodologyWeight')));
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = el('tbody');
    Object.entries(CHECKS).filter(([, m]) => m.category === cat.id).forEach(([id, meta]) => {
      const ctx = checkText(currentLang, id, { title: meta.title });
      const tr = el('tr');
      const tdName = el('td', 'method-check-cell');
      tdName.appendChild(el('div', 'method-check-id', id));
      tdName.appendChild(el('div', 'method-check-title', ctx.title));
      tr.appendChild(tdName);
      tr.appendChild(el('td', `method-sev sev-${meta.severity}`, meta.severity));
      tr.appendChild(el('td', 'method-weight', String(meta.weight)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    root.appendChild(section);
  });
}

function renderSources() {
  const root = document.getElementById('source-list');
  if (!root) return;
  root.replaceChildren();
  // intro paragraph above the list (placed into parent)
  const parent = root.parentElement;
  if (parent && !parent.querySelector('.info-intro')) {
    parent.insertBefore(el('p', 'info-intro', t(currentLang, 'sourcesIntro')), root);
  } else if (parent) {
    const existing = parent.querySelector('.info-intro');
    if (existing) existing.textContent = t(currentLang, 'sourcesIntro');
  }
  SOURCES.forEach((s) => {
    const li = el('li', 'source-item');
    const a = el('a', 'source-link', s.title);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    li.appendChild(a);
    li.appendChild(el('div', 'source-meta', `${s.publisher} · ${s.kind}`));
    if (s.note) li.appendChild(el('div', 'source-note', s.note));
    root.appendChild(li);
  });
}

function renderPrivacy() {
  const root = document.getElementById('privacy-body');
  if (!root) return;
  root.replaceChildren();
  root.appendChild(el('p', null, t(currentLang, 'privacyP1')));
  root.appendChild(el('p', null, t(currentLang, 'privacyP2')));
  root.appendChild(el('p', null, t(currentLang, 'privacyP3')));
}

applyChromeTranslations();
