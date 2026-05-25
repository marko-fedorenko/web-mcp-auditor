import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { CHECKS } from './checks-catalog.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

function finding(checkId, status, message, extra = {}) {
  const meta = CHECKS[checkId];
  return {
    checkId,
    category: meta ? meta.category : 'unknown',
    title: meta ? meta.title : checkId,
    severity: meta ? meta.severity : 'info',
    status,
    message,
    docUrl: meta ? meta.docUrl : null,
    howToFix: meta && (status === 'fail' || status === 'warn') ? meta.howToFix : null,
    ...extra
  };
}

function looksValidJsonSchema(schema) {
  if (!schema || typeof schema !== 'object') return { ok: false, errors: ['inputSchema missing or not an object'] };
  try {
    ajv.compile(schema);
    return { ok: true, errors: [] };
  } catch (e) {
    return { ok: false, errors: [String(e.message || e)] };
  }
}

function rootIsTypedObject(schema) {
  if (!schema || typeof schema !== 'object') return false;
  if (schema.type && schema.type !== 'object') return false;
  if (!schema.type && !schema.properties) return false;
  return true;
}

function everyPropertyTyped(schema) {
  if (!schema || typeof schema !== 'object' || !schema.properties) return { ok: true, missing: [] };
  const missing = [];
  for (const [name, prop] of Object.entries(schema.properties)) {
    if (!prop || (typeof prop !== 'object')) { missing.push(name); continue; }
    if (!prop.type && !prop.enum && !prop.oneOf && !prop.anyOf && !prop.$ref) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}

function isCrossOriginEmbeddable(headers) {
  const xfo = (headers && headers['x-frame-options'] || '').toLowerCase();
  if (xfo === 'deny' || xfo === 'sameorigin') return false;
  const csp = (headers && headers['content-security-policy'] || '').toLowerCase();
  if (csp.includes("frame-ancestors 'none'") || csp.includes("frame-ancestors 'self'")) return false;
  return true;
}

function parsePermissionsPolicyTools(value) {
  if (!value) return null;
  const m = value.match(/(?:^|,\s*)tools\s*=\s*([^,]+)/i);
  if (!m) return null;
  return m[1].trim();
}

export function evaluateChecks({ rawProbe, responseHeaders, httpStatus, runtimeMode, executeResults }) {
  const out = [];
  const runtimeUnavailable = runtimeMode === 'unavailable' || runtimeMode === 'disabled';

  // A. Runtime detection
  if (runtimeUnavailable) {
    out.push(finding('runtime.api-present', 'na', `Runtime mode "${runtimeMode}" — browser cannot expose navigator.modelContext.`));
    out.push(finding('runtime.api-shape', 'na', 'Skipped because runtime is unavailable.'));
    out.push(finding('runtime.late-registration', 'na', 'Skipped because runtime is unavailable.'));
  } else {
    const present = !!(rawProbe && rawProbe.runtime && rawProbe.runtime.modelContextPresent);
    out.push(finding('runtime.api-present', present ? 'pass' : 'fail',
      present ? 'navigator.modelContext is present.' : 'navigator.modelContext was not exposed by the page.'));

    if (present) {
      const r = rawProbe.runtime;
      const allFns = r.registerToolAvailable && r.getToolsAvailable && r.executeToolAvailable;
      out.push(finding('runtime.api-shape', allFns ? 'pass' : 'fail',
        allFns
          ? 'registerTool, getTools and executeTool are all callable.'
          : `Missing API methods. registerTool: ${r.registerToolAvailable}, getTools: ${r.getToolsAvailable}, executeTool: ${r.executeToolAvailable}.`));

      const regs = rawProbe.registrations || [];
      const late = regs.filter((r) => typeof r.at === 'number' && r.at > 2000);
      if (regs.length === 0) {
        out.push(finding('runtime.late-registration', 'na', 'No registerTool calls observed.'));
      } else if (late.length > 0) {
        out.push(finding('runtime.late-registration', 'warn',
          `${late.length} of ${regs.length} registrations happened after the 2s window.`,
          { details: { lateNames: late.map((l) => l.name).filter(Boolean) } }));
      } else {
        out.push(finding('runtime.late-registration', 'pass', `All ${regs.length} registrations completed within 2s of load.`));
      }
    } else {
      out.push(finding('runtime.api-shape', 'na', 'Skipped: API not present.'));
      out.push(finding('runtime.late-registration', 'na', 'Skipped: API not present.'));
    }
  }

  // B. Imperative inventory
  const tools = (rawProbe && rawProbe.tools && rawProbe.tools.available && rawProbe.tools.tools) || [];
  const registrations = (rawProbe && rawProbe.registrations) || [];

  if (runtimeUnavailable) {
    out.push(finding('imperative.tool-count', 'na', 'Skipped: runtime unavailable.'));
    out.push(finding('imperative.unique-names', 'na', 'Skipped: runtime unavailable.'));
    out.push(finding('imperative.name-convention', 'na', 'Skipped: runtime unavailable.'));
    out.push(finding('imperative.no-duplicate-registration', 'na', 'Skipped: runtime unavailable.'));
  } else {
    out.push(finding('imperative.tool-count',
      tools.length > 0 ? 'pass' : 'warn',
      tools.length > 0 ? `${tools.length} tool(s) registered.` : 'No tools registered via the imperative API.'));

    const names = tools.map((t) => t.name).filter(Boolean);
    const dups = names.filter((n, i) => names.indexOf(n) !== i);
    if (names.length === 0) {
      out.push(finding('imperative.unique-names', 'na', 'No named tools to check.'));
    } else {
      const unique = dups.length === 0;
      out.push(finding('imperative.unique-names', unique ? 'pass' : 'fail',
        unique ? 'All tool names are unique.' : `Duplicate names: ${[...new Set(dups)].join(', ')}.`));
    }

    if (names.length === 0) {
      out.push(finding('imperative.name-convention', 'na', 'No tools to check.'));
    } else {
      const bad = names.filter((n) => !NAME_RE.test(n));
      out.push(finding('imperative.name-convention',
        bad.length === 0 ? 'pass' : 'warn',
        bad.length === 0
          ? 'All tool names match snake_case convention.'
          : `Non-conforming names: ${bad.join(', ')}.`));
    }

    const regNameCounts = new Map();
    registrations.forEach((r) => {
      if (r.name) regNameCounts.set(r.name, (regNameCounts.get(r.name) || 0) + 1);
    });
    const dupRegs = [...regNameCounts.entries()].filter(([, c]) => c > 1);
    if (registrations.length === 0) {
      out.push(finding('imperative.no-duplicate-registration', 'na', 'No registerTool calls observed.'));
    } else {
      out.push(finding('imperative.no-duplicate-registration',
        dupRegs.length === 0 ? 'pass' : 'warn',
        dupRegs.length === 0
          ? 'No tool name was registered more than once.'
          : `Re-registered without cleanup: ${dupRegs.map(([n, c]) => `${n} (×${c})`).join(', ')}.`));
    }
  }

  // C. Declarative inventory
  const decls = (rawProbe && rawProbe.declarative) || [];
  if (decls.length === 0) {
    out.push(finding('declarative.form-pairing', 'na', 'No declarative [toolname] elements found.'));
    out.push(finding('declarative.param-coverage', 'na', 'No declarative tools to inspect.'));
    out.push(finding('declarative.has-tooldescription', 'na', 'No declarative tools to inspect.'));
  } else {
    const unpaired = decls.filter((d) => !d.attachedToForm);
    out.push(finding('declarative.form-pairing',
      unpaired.length === 0 ? 'pass' : 'fail',
      unpaired.length === 0
        ? `All ${decls.length} declarative tool(s) attached to a <form>.`
        : `${unpaired.length} of ${decls.length} declarative tool(s) not inside a form.`,
      { details: { unpaired: unpaired.map((d) => d.toolname) } }));

    let totalParams = 0;
    let incompleteParams = 0;
    const incompleteByTool = [];
    decls.forEach((d) => {
      const missing = [];
      d.params.forEach((p) => {
        totalParams += 1;
        if (!p.toolparamtitle || !p.toolparamdescription) {
          incompleteParams += 1;
          missing.push(p.name || p.tag);
        }
      });
      if (missing.length) incompleteByTool.push({ tool: d.toolname, missing });
    });
    if (totalParams === 0) {
      out.push(finding('declarative.param-coverage', 'na', 'No form inputs to inspect.'));
    } else {
      out.push(finding('declarative.param-coverage',
        incompleteParams === 0 ? 'pass' : 'warn',
        incompleteParams === 0
          ? `All ${totalParams} parameter(s) have title + description.`
          : `${incompleteParams} of ${totalParams} parameter(s) are missing toolparamtitle or toolparamdescription.`,
        { details: incompleteByTool }));
    }

    const noDesc = decls.filter((d) => !d.tooldescription || d.tooldescription.trim().length < 5);
    out.push(finding('declarative.has-tooldescription',
      noDesc.length === 0 ? 'pass' : 'warn',
      noDesc.length === 0
        ? 'All declarative tools have a non-trivial tooldescription.'
        : `${noDesc.length} tool(s) lack a meaningful tooldescription.`,
      { details: noDesc.map((d) => d.toolname) }));
  }

  // D. Metadata quality — runs over imperative tools AND declarative tools
  const allTools = [
    ...tools.map((t) => ({
      source: 'imperative',
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations
    })),
    ...decls.map((d) => ({
      source: 'declarative',
      name: d.toolname,
      description: d.tooldescription,
      inputSchema: declarativeInputSchema(d),
      annotations: null
    }))
  ];

  if (allTools.length === 0) {
    out.push(finding('metadata.description-length', 'na', 'No tools to inspect.'));
    out.push(finding('metadata.inputschema-valid', 'na', 'No tools to inspect.'));
    out.push(finding('metadata.inputschema-typed', 'na', 'No tools to inspect.'));
    out.push(finding('metadata.annotations-present', 'na', 'No tools to inspect.'));
  } else {
    allTools.forEach((t) => {
      const len = (t.description || '').length;
      const ok = len >= 20 && len <= 500;
      out.push(finding('metadata.description-length',
        ok ? 'pass' : 'warn',
        ok
          ? `"${t.name}": description length ${len} chars.`
          : `"${t.name}": description length ${len} chars (recommended 20–500).`,
        { toolName: t.name }));

      const v = looksValidJsonSchema(t.inputSchema);
      out.push(finding('metadata.inputschema-valid',
        v.ok ? 'pass' : 'fail',
        v.ok
          ? `"${t.name}": inputSchema is a valid JSON Schema.`
          : `"${t.name}": inputSchema invalid — ${v.errors.join('; ')}`,
        { toolName: t.name }));

      const typed = rootIsTypedObject(t.inputSchema) && everyPropertyTyped(t.inputSchema).ok;
      const missing = everyPropertyTyped(t.inputSchema).missing;
      out.push(finding('metadata.inputschema-typed',
        typed ? 'pass' : 'warn',
        typed
          ? `"${t.name}": every property is typed.`
          : `"${t.name}": untyped or non-object root. Missing types: ${missing.join(', ') || '(root)'}.`,
        { toolName: t.name }));

      if (t.source === 'declarative') {
        out.push(finding('metadata.annotations-present', 'na',
          `"${t.name}": declarative tool — annotations not applicable.`,
          { toolName: t.name }));
      } else {
        const ann = t.annotations || {};
        const explicit = typeof ann.readOnlyHint === 'boolean';
        out.push(finding('metadata.annotations-present',
          explicit ? 'pass' : 'warn',
          explicit
            ? `"${t.name}": annotations.readOnlyHint = ${ann.readOnlyHint}.`
            : `"${t.name}": annotations.readOnlyHint not set explicitly.`,
          { toolName: t.name }));
      }
    });
  }

  // E. Execution & safety
  const ppValue = responseHeaders && (responseHeaders['permissions-policy'] || responseHeaders['permission-policy']);
  const toolsDirective = parsePermissionsPolicyTools(ppValue);
  const embeddable = isCrossOriginEmbeddable(responseHeaders || {});
  if (!embeddable) {
    out.push(finding('safety.permissions-policy', 'na',
      'Page is not cross-origin embeddable (X-Frame-Options or CSP frame-ancestors block it). Tools directive not required.'));
  } else if (toolsDirective != null) {
    out.push(finding('safety.permissions-policy', 'pass',
      `Permissions-Policy tools directive present: tools=${toolsDirective}.`));
  } else {
    out.push(finding('safety.permissions-policy', 'warn',
      'Page is cross-origin embeddable but does not set a Permissions-Policy tools= directive (defaults to self).'));
  }

  if (executeResults && Array.isArray(executeResults)) {
    if (executeResults.length === 0) {
      out.push(finding('safety.execute-smoke', 'na', 'No executable tools.'));
    } else {
      executeResults.forEach((r) => {
        if (r.skipped) {
          out.push(finding('safety.execute-smoke', 'na',
            `"${r.name}": skipped — ${r.skipReason}.`,
            { toolName: r.name }));
        } else if (r.success) {
          out.push(finding('safety.execute-smoke', 'pass',
            `"${r.name}": executed in ${r.durationMs}ms.`,
            { toolName: r.name, details: { resultPreview: r.resultPreview } }));
        } else {
          out.push(finding('safety.execute-smoke', 'fail',
            `"${r.name}": ${r.error}`,
            { toolName: r.name, details: { input: r.input } }));
        }
      });
    }
  } else {
    out.push(finding('safety.execute-smoke', 'na', 'Execution tests not requested (pass options.execute=true).'));
  }

  return out;
}

function declarativeInputSchema(decl) {
  const props = {};
  const required = [];
  (decl.params || []).forEach((p) => {
    if (!p.name) return;
    props[p.name] = { type: stringTypeForInput(p.type) };
    if (p.toolparamdescription) props[p.name].description = p.toolparamdescription;
    if (p.toolparamtitle) props[p.name].title = p.toolparamtitle;
    if (p.required) required.push(p.name);
  });
  const schema = { type: 'object', properties: props };
  if (required.length) schema.required = required;
  return schema;
}

function stringTypeForInput(t) {
  if (!t) return 'string';
  if (t === 'number' || t === 'range') return 'number';
  if (t === 'checkbox') return 'boolean';
  return 'string';
}
