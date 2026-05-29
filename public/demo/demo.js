// Web MCP demo — task tracker.
//
// Registers 6 tools via navigator.modelContext.registerTool() and renders
// a real UI that updates when the agent (or a human) interacts. Also wires up
// listeners for toolactivated/toolcancel so we can show what the agent is doing.

const STORAGE_KEY = 'webmcp-demo-tasks';

const SAMPLE_TASKS = [
  { id: 1, title: 'Review the Web MCP spec',         priority: 'high',   tag: 'spec',  completed: true,  createdAt: '2026-05-22T09:00:00Z' },
  { id: 2, title: 'Audit example.com with WebMCP',   priority: 'medium', tag: 'audit', completed: false, createdAt: '2026-05-22T09:05:00Z' },
  { id: 3, title: 'Wire up declarative form tools',  priority: 'medium', tag: 'demo',  completed: true,  createdAt: '2026-05-22T09:10:00Z' },
  { id: 4, title: 'Write blog post about Web MCP',   priority: 'low',    tag: 'blog',  completed: false, createdAt: '2026-05-22T09:15:00Z' }
];

let tasks = loadTasks();
let nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return structuredClone(SAMPLE_TASKS);
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
}

// ---- UI rendering -----------------------------------------------------------
function render() {
  const list = document.getElementById('task-list');
  list.replaceChildren();
  if (tasks.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
  } else {
    document.getElementById('empty-state').classList.add('hidden');
  }
  for (const t of [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || b.id - a.id)) {
    const li = el('li', `task task-${t.priority}` + (t.completed ? ' done' : ''));
    li.dataset.id = String(t.id);
    const check = el('input', null); check.type = 'checkbox'; check.checked = t.completed;
    check.addEventListener('change', () => {
      t.completed = check.checked;
      saveTasks(); render(); logEvent(`UI: toggled #${t.id} → ${t.completed ? 'done' : 'pending'}`);
    });
    li.appendChild(check);
    const body = el('div', 'task-body');
    body.appendChild(el('div', 'task-title', t.title));
    const meta = el('div', 'task-meta');
    meta.appendChild(el('span', `chip chip-priority-${t.priority}`, t.priority));
    if (t.tag) meta.appendChild(el('span', 'chip chip-tag', '#' + t.tag));
    meta.appendChild(el('span', 'chip chip-id', '#' + t.id));
    body.appendChild(meta);
    li.appendChild(body);
    const del = el('button', 'task-del', '×'); del.title = 'Delete';
    del.addEventListener('click', () => {
      tasks = tasks.filter((x) => x.id !== t.id);
      saveTasks(); render(); logEvent(`UI: deleted #${t.id}`);
    });
    li.appendChild(del);
    list.appendChild(li);
  }
  renderStats();
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = total - done;
  const high = tasks.filter((t) => t.priority === 'high').length;
  const medium = tasks.filter((t) => t.priority === 'medium').length;
  const low = tasks.filter((t) => t.priority === 'low').length;
  document.getElementById('stat-total').textContent = String(total);
  document.getElementById('stat-done').textContent = String(done);
  document.getElementById('stat-pending').textContent = String(pending);
  document.getElementById('stat-pct').textContent = total === 0 ? '0%' : Math.round((done / total) * 100) + '%';
  document.getElementById('stat-high').textContent = String(high);
  document.getElementById('stat-medium').textContent = String(medium);
  document.getElementById('stat-low').textContent = String(low);
}

function logEvent(text) {
  const log = document.getElementById('event-log');
  const li = el('li');
  const time = new Date().toLocaleTimeString();
  li.appendChild(el('span', 'log-time', time));
  li.appendChild(el('span', 'log-text', text));
  log.insertBefore(li, log.firstChild);
  while (log.children.length > 20) log.removeChild(log.lastChild);
}

function renderToolList(toolNames) {
  const ol = document.getElementById('tool-list');
  ol.replaceChildren();
  for (const name of toolNames) {
    const li = el('li');
    li.appendChild(el('code', null, name));
    ol.appendChild(li);
  }
}

function el(tag, className, textContent) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (textContent != null) n.textContent = textContent;
  return n;
}

// ---- Web MCP tools ----------------------------------------------------------
const mc = navigator && navigator.modelContext;
const REGISTERED = [];

if (!mc || typeof mc.registerTool !== 'function') {
  document.querySelector('.demo-header .container').insertAdjacentHTML('beforeend',
    '<div class="banner banner-warn">navigator.modelContext is not available in this browser. Use Chrome 149+ for full demo. The UI still works — the page just isn\'t exposing tools to agents.</div>');
} else {
  // 1. list_tasks (read-only)
  mc.registerTool({
    name: 'list_tasks',
    description: 'List tasks in the tracker. Returns an array of {id, title, priority, tag, completed}. Use the filters to narrow the result.',
    inputSchema: {
      type: 'object',
      properties: {
        status:   { type: 'string', enum: ['pending', 'done', 'all'], description: 'Filter by completion status. Default: all.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority. Omit to include all.' },
        tag:      { type: 'string', description: 'Filter by tag (exact match, case-insensitive).' }
      }
    },
    annotations: { readOnlyHint: true },
    execute: async ({ status = 'all', priority, tag }) => {
      logEvent(`Tool: list_tasks(status=${status}${priority ? `, priority=${priority}` : ''}${tag ? `, tag=${tag}` : ''})`);
      let out = tasks;
      if (status === 'pending') out = out.filter((t) => !t.completed);
      else if (status === 'done') out = out.filter((t) => t.completed);
      if (priority) out = out.filter((t) => t.priority === priority);
      if (tag) out = out.filter((t) => (t.tag || '').toLowerCase() === tag.toLowerCase());
      return out.map(({ id, title, priority, tag, completed }) => ({ id, title, priority, tag, completed }));
    }
  });
  REGISTERED.push('list_tasks');

  // 2. add_task
  mc.registerTool({
    name: 'add_task',
    description: 'Add a new task to the tracker. Returns the created task with its assigned id.',
    inputSchema: {
      type: 'object',
      properties: {
        title:    { type: 'string', minLength: 3, maxLength: 200, description: 'Short task description.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', description: 'Importance.' },
        tag:      { type: 'string', maxLength: 32, description: 'Optional tag for grouping. e.g. "design", "blog".' }
      },
      required: ['title']
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async ({ title, priority = 'medium', tag }) => {
      const task = {
        id: nextId++, title: title.trim(), priority,
        tag: tag ? tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : null,
        completed: false, createdAt: new Date().toISOString()
      };
      tasks.push(task);
      saveTasks(); render();
      logEvent(`Tool: add_task → created #${task.id} "${task.title}"`);
      return { id: task.id, title: task.title, priority: task.priority, tag: task.tag };
    }
  });
  REGISTERED.push('add_task');

  // 3. complete_task
  mc.registerTool({
    name: 'complete_task',
    description: 'Mark a task as done by id. Returns the updated task, or an error string if the id was not found.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', minimum: 1, description: 'Task id from list_tasks.' } },
      required: ['id']
    },
    annotations: { readOnlyHint: false },
    execute: async ({ id }) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) { logEvent(`Tool: complete_task(${id}) → not found`); return `task #${id} not found`; }
      t.completed = true; saveTasks(); render();
      logEvent(`Tool: complete_task(${id}) → marked done`);
      return { id: t.id, title: t.title, completed: true };
    }
  });
  REGISTERED.push('complete_task');

  // 4. delete_task
  mc.registerTool({
    name: 'delete_task',
    description: 'Delete a task by id. Returns {deleted: true} on success, or an error string if not found.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', minimum: 1, description: 'Task id.' } },
      required: ['id']
    },
    annotations: { readOnlyHint: false },
    execute: async ({ id }) => {
      const before = tasks.length;
      tasks = tasks.filter((t) => t.id !== id);
      const removed = before !== tasks.length;
      saveTasks(); render();
      logEvent(`Tool: delete_task(${id}) → ${removed ? 'removed' : 'not found'}`);
      return removed ? { deleted: true, id } : `task #${id} not found`;
    }
  });
  REGISTERED.push('delete_task');

  // 5. clear_completed
  mc.registerTool({
    name: 'clear_completed',
    description: 'Remove every task that is currently marked done. Requires explicit confirm=true (acts as a guard against accidental bulk deletion).',
    inputSchema: {
      type: 'object',
      properties: { confirm: { type: 'boolean', const: true, description: 'Must be true to perform the deletion.' } },
      required: ['confirm']
    },
    annotations: { readOnlyHint: false },
    execute: async ({ confirm }) => {
      if (!confirm) return 'confirm=true is required';
      const before = tasks.length;
      tasks = tasks.filter((t) => !t.completed);
      const removed = before - tasks.length;
      saveTasks(); render();
      logEvent(`Tool: clear_completed → removed ${removed}`);
      return { removed };
    }
  });
  REGISTERED.push('clear_completed');

  // 6. get_stats (read-only)
  mc.registerTool({
    name: 'get_stats',
    description: 'Return aggregate statistics for the tracker: total, completed, pending, and counts grouped by priority.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      logEvent('Tool: get_stats');
      const total = tasks.length;
      const done = tasks.filter((t) => t.completed).length;
      return {
        total, completed: done, pending: total - done,
        byPriority: {
          high:   tasks.filter((t) => t.priority === 'high').length,
          medium: tasks.filter((t) => t.priority === 'medium').length,
          low:    tasks.filter((t) => t.priority === 'low').length
        }
      };
    }
  });
  REGISTERED.push('get_stats');
}

// ---- Declarative form wiring -----------------------------------------------
const quickForm = document.getElementById('quick-add-form');
quickForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('quick-title');
  const title = titleInput.value.trim();
  if (title.length < 3) return;
  tasks.push({
    id: nextId++, title, priority: 'medium', tag: null,
    completed: false, createdAt: new Date().toISOString()
  });
  saveTasks(); render();
  logEvent(`Form: quick_add_task → created #${tasks[tasks.length - 1].id} "${title}"`);
  titleInput.value = '';
});

// Listen for the events the declarative API fires so we can show "agent is filling
// the form right now" feedback. Both window and document — spec is in flux.
['toolactivated', 'toolcancel'].forEach((name) => {
  document.addEventListener(name, (e) => {
    logEvent(`Event: ${name} ${e.toolName || (e.detail && e.detail.name) || ''}`);
  }, true);
});

// ---- Boot -------------------------------------------------------------------
renderToolList(REGISTERED);
render();
logEvent(`Page loaded · ${REGISTERED.length} tools registered`);
