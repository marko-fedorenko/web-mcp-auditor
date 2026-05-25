// Mirror of audit/checks-catalog.js — re-exposed to the browser so the
// methodology panel can render the full check list without an extra API roundtrip.
// Keep this in sync with audit/checks-catalog.js when adding/changing checks.

export const CATEGORIES = [
  { id: 'runtime',     title: 'Runtime detection' },
  { id: 'imperative',  title: 'Imperative inventory' },
  { id: 'declarative', title: 'Declarative inventory' },
  { id: 'metadata',    title: 'Metadata quality' },
  { id: 'safety',      title: 'Execution & safety' }
];

export const CHECKS = {
  'runtime.api-present':               { category: 'runtime',     severity: 'fail', weight: 3, title: 'navigator.modelContext is exposed' },
  'runtime.api-shape':                 { category: 'runtime',     severity: 'fail', weight: 2, title: 'registerTool, getTools, executeTool are all functions' },
  'runtime.late-registration':         { category: 'runtime',     severity: 'warn', weight: 1, title: 'Tools register before load + 2s window' },
  'imperative.tool-count':             { category: 'imperative',  severity: 'warn', weight: 2, title: 'At least one tool is registered' },
  'imperative.unique-names':           { category: 'imperative',  severity: 'fail', weight: 2, title: 'Tool names are unique' },
  'imperative.name-convention':        { category: 'imperative',  severity: 'warn', weight: 1, title: 'Tool names follow snake_case (≤64 chars)' },
  'imperative.no-duplicate-registration': { category: 'imperative', severity: 'warn', weight: 1, title: 'registerTool not called twice for the same name without cleanup' },
  'declarative.form-pairing':          { category: 'declarative', severity: 'fail', weight: 2, title: '[toolname] elements are paired with a <form>' },
  'declarative.param-coverage':        { category: 'declarative', severity: 'warn', weight: 1, title: 'Form inputs have toolparamtitle + toolparamdescription' },
  'declarative.has-tooldescription':   { category: 'declarative', severity: 'warn', weight: 1, title: 'Every [toolname] has a tooldescription' },
  'metadata.description-length':       { category: 'metadata',    severity: 'warn', weight: 1, title: 'Description is 20–500 characters' },
  'metadata.inputschema-valid':        { category: 'metadata',    severity: 'fail', weight: 2, title: 'inputSchema validates against JSON Schema 2020-12' },
  'metadata.inputschema-typed':        { category: 'metadata',    severity: 'warn', weight: 1, title: 'inputSchema root is object and every property is typed' },
  'metadata.annotations-present':      { category: 'metadata',    severity: 'warn', weight: 1, title: 'annotations.readOnlyHint is set explicitly' },
  'safety.permissions-policy':         { category: 'safety',      severity: 'warn', weight: 2, title: 'Permissions-Policy: tools= header is set' },
  'safety.execute-smoke':              { category: 'safety',      severity: 'fail', weight: 2, title: 'executeTool resolves without error' }
};

export const SOURCES = [
  {
    title: 'Web MCP — Chrome developer documentation',
    url: 'https://developer.chrome.com/docs/ai/webmcp',
    publisher: 'Google Chrome team',
    kind: 'Primary spec documentation',
    note: 'Origin trial launching in Chrome 149. Available locally via chrome://flags/#enable-webmcp-testing.'
  },
  {
    title: 'Web MCP — Imperative API',
    url: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    publisher: 'Google Chrome team',
    kind: 'API reference',
    note: 'navigator.modelContext.registerTool, getTools, executeTool. Source for the runtime + imperative + metadata checks.'
  },
  {
    title: 'Web MCP — Declarative API',
    url: 'https://developer.chrome.com/docs/ai/webmcp/declarative-api',
    publisher: 'Google Chrome team',
    kind: 'API reference',
    note: 'toolname, tooldescription, toolparamtitle, toolparamdescription, toolautosubmit on HTML forms. Source for the declarative checks.'
  },
  {
    title: 'Web Machine Learning CG — WebMCP draft',
    url: 'https://github.com/webmachinelearning/webmcp',
    publisher: 'W3C Web Machine Learning Community Group',
    kind: 'Standards draft',
    note: 'Specification draft and design discussions.'
  },
  {
    title: 'JSON Schema 2020-12',
    url: 'https://json-schema.org/draft/2020-12/release-notes.html',
    publisher: 'JSON Schema',
    kind: 'External spec',
    note: 'inputSchema fields are validated against this meta-schema (metadata.inputschema-valid check).'
  },
  {
    title: 'Permissions-Policy HTTP header',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
    publisher: 'MDN Web Docs',
    kind: 'External spec',
    note: 'tools= directive controls cross-origin tool exposure (safety.permissions-policy check).'
  }
];
