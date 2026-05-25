// Injected via page.evaluateOnNewDocument before any page script runs.
// Wraps navigator.modelContext.registerTool so we capture registrations
// even if the page registers and immediately unregisters tools.
// Exposes window.__webmcpAudit.collect() returning a single JSON-safe blob.
(() => {
  if (window.__webmcpAudit) return;

  const events = [];
  const registrations = [];
  let firstSeenAt = null;
  let getToolsAvailable = false;
  let executeToolAvailable = false;
  let registerToolAvailable = false;
  let originalRegisterTool = null;

  function now() {
    return Math.round(performance.now());
  }

  function snapshotApi() {
    const mc = navigator && navigator.modelContext;
    if (!mc) return false;
    if (firstSeenAt == null) firstSeenAt = now();
    registerToolAvailable = typeof mc.registerTool === 'function';
    getToolsAvailable = typeof mc.getTools === 'function';
    executeToolAvailable = typeof mc.executeTool === 'function';
    if (registerToolAvailable && !originalRegisterTool) {
      originalRegisterTool = mc.registerTool.bind(mc);
      mc.registerTool = function patchedRegisterTool(tool, options) {
        try {
          registrations.push({
            at: now(),
            stack: (new Error()).stack?.split('\n').slice(1, 4).join(' | ') || null,
            name: tool && tool.name,
            description: tool && tool.description,
            inputSchema: tool && tool.inputSchema,
            annotations: tool && tool.annotations,
            hasExecute: !!(tool && typeof tool.execute === 'function'),
            options: options ? {
              hasSignal: !!options.signal,
              exposedTo: options.exposedTo || null
            } : null
          });
        } catch (e) {
          registrations.push({ at: now(), error: String(e) });
        }
        return originalRegisterTool(tool, options);
      };
    }
    return true;
  }

  // Initial snapshot now (in case modelContext already exists at injection time)
  snapshotApi();

  // Re-snapshot at key lifecycle moments — picks up late polyfills.
  const reSnapshot = () => snapshotApi();
  document.addEventListener('DOMContentLoaded', reSnapshot, { once: true });
  window.addEventListener('load', reSnapshot, { once: true });

  // Tool lifecycle events
  ['toolactivated', 'toolcancel'].forEach((name) => {
    const handler = (e) => {
      events.push({ at: now(), type: e.type, toolName: e.toolName || (e.detail && e.detail.name) || null });
    };
    document.addEventListener(name, handler, true);
    window.addEventListener(name, handler, true);
  });

  function scanDeclarative() {
    const out = [];
    const toolElements = document.querySelectorAll('[toolname]');
    toolElements.forEach((el) => {
      const form = el.tagName === 'FORM' ? el : el.closest('form');
      const params = [];
      const scope = form || el;
      scope.querySelectorAll('input, select, textarea').forEach((field) => {
        params.push({
          tag: field.tagName.toLowerCase(),
          name: field.getAttribute('name') || null,
          type: field.getAttribute('type') || null,
          required: field.hasAttribute('required'),
          toolparamtitle: field.getAttribute('toolparamtitle'),
          toolparamdescription: field.getAttribute('toolparamdescription')
        });
      });
      out.push({
        tag: el.tagName.toLowerCase(),
        toolname: el.getAttribute('toolname'),
        tooldescription: el.getAttribute('tooldescription'),
        toolautosubmit: el.hasAttribute('toolautosubmit'),
        attachedToForm: !!form,
        formId: form ? (form.id || null) : null,
        formAction: form ? (form.getAttribute('action') || null) : null,
        params
      });
    });
    return out;
  }

  function scanCssPseudos() {
    const hits = { toolFormActive: false, toolSubmitActive: false, samples: [] };
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          const text = rule.cssText || '';
          if (text.includes(':tool-form-active')) {
            hits.toolFormActive = true;
            if (hits.samples.length < 3) hits.samples.push(text.slice(0, 160));
          }
          if (text.includes(':tool-submit-active')) {
            hits.toolSubmitActive = true;
            if (hits.samples.length < 3) hits.samples.push(text.slice(0, 160));
          }
        }
      }
    } catch (e) {
      hits.error = String(e);
    }
    return hits;
  }

  function parseSchemaIfString(s) {
    // Chrome's getTools() serializes inputSchema as a JSON string. Parse it back.
    if (s && typeof s === 'string') {
      try { return JSON.parse(s); } catch { return { __unparseable: true, raw: s.slice(0, 200) }; }
    }
    return s;
  }

  async function serializeRegisteredTools() {
    const mc = navigator && navigator.modelContext;
    if (!mc || typeof mc.getTools !== 'function') return { available: false, tools: [], error: null };
    try {
      const tools = await mc.getTools();
      const serial = (Array.isArray(tools) ? tools : []).map((t) => ({
        name: t && t.name,
        description: t && t.description,
        inputSchema: parseSchemaIfString(t && t.inputSchema),
        annotations: t && t.annotations || null,
        // executeTool(tool, json) is callable from modelContext even when the
        // sentinel tool object doesn't carry its own `execute` function reference.
        canExecute: typeof mc.executeTool === 'function'
      }));
      return { available: true, tools: serial, error: null };
    } catch (e) {
      return { available: true, tools: [], error: String(e) };
    }
  }

  function featurePolicy() {
    try {
      const fp = document.featurePolicy;
      if (!fp) return { available: false };
      const allows = typeof fp.allowsFeature === 'function' ? fp.allowsFeature('tools') : null;
      let allowedFeatures = null;
      try { allowedFeatures = fp.allowedFeatures().filter((n) => n === 'tools'); } catch {}
      return { available: true, allowsTools: allows, allowedFeaturesIncludesTools: allowedFeatures };
    } catch (e) {
      return { available: false, error: String(e) };
    }
  }

  async function collect() {
    snapshotApi();
    const tools = await serializeRegisteredTools();
    return {
      collectedAt: now(),
      runtime: {
        modelContextPresent: !!(navigator && navigator.modelContext),
        firstSeenAt,
        registerToolAvailable,
        getToolsAvailable,
        executeToolAvailable,
        userAgent: navigator.userAgent
      },
      registrations,
      tools,
      declarative: scanDeclarative(),
      cssPseudos: scanCssPseudos(),
      featurePolicy: featurePolicy(),
      events
    };
  }

  window.__webmcpAudit = { collect };
})();
