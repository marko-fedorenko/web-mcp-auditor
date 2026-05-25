// Static metadata for every audit check.
// Severity and weight feed scoring.js; docUrl is used by the report UI.

export const CATEGORIES = [
  {
    id: 'runtime',
    title: 'Runtime detection',
    description: 'Whether the Web MCP API (navigator.modelContext) is exposed to this page and is callable. If the runtime is missing, no imperative tool can be registered.'
  },
  {
    id: 'imperative',
    title: 'Imperative inventory',
    description: 'Tools registered programmatically via navigator.modelContext.registerTool(). This is the primary surface AI agents interact with.'
  },
  {
    id: 'declarative',
    title: 'Declarative inventory',
    description: 'HTML forms annotated with toolname / tooldescription / toolparam* — an agent can fill and submit them without you writing any JS.'
  },
  {
    id: 'metadata',
    title: 'Metadata quality',
    description: 'For every detected tool: is the description meaningful, is the inputSchema a valid JSON Schema 2020-12, are all properties typed, are safety hints set explicitly?'
  },
  {
    id: 'safety',
    title: 'Execution & safety',
    description: 'Whether the page sets a Permissions-Policy "tools" directive (controls cross-origin embedding), and — optionally — whether each tool actually executes without error.'
  }
];

export const CHECKS = {
  'runtime.api-present': {
    category: 'runtime',
    title: 'navigator.modelContext is exposed',
    severity: 'fail',
    weight: 3,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'The page did not expose navigator.modelContext. If you author this site: serve over HTTPS and avoid opaque origins (data:, blob:, sandboxed iframes). Verify locally with chrome://flags/#enable-webmcp-testing or the Chrome 149+ origin trial.'
  },
  'runtime.api-shape': {
    category: 'runtime',
    title: 'registerTool, getTools, executeTool are all functions',
    severity: 'fail',
    weight: 2,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'A required method is missing. Most likely your Chromium build is too old — update to Chrome ≥149 with WebMCP support, or check whether your code monkey-patched modelContext.'
  },
  'runtime.late-registration': {
    category: 'runtime',
    title: 'Tools register before load + 2s window',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Some agents snapshot getTools() right after load. If you register tools later, they may be invisible. Move registration into a top-level script or run it from a "DOMContentLoaded" handler.'
  },
  'imperative.tool-count': {
    category: 'imperative',
    title: 'At least one tool is registered',
    severity: 'warn',
    weight: 2,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'No imperative tools were registered. Call navigator.modelContext.registerTool({ name, description, inputSchema, execute }) for each action you want agents to perform. Skip this if you intentionally use only the declarative API.'
  },
  'imperative.unique-names': {
    category: 'imperative',
    title: 'Tool names are unique',
    severity: 'fail',
    weight: 2,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Tool names act as identifiers. Duplicates cause ambiguity — agents may pick the wrong implementation. Rename one of the duplicates, or unregister the previous one with an AbortController signal before re-registering.'
  },
  'imperative.name-convention': {
    category: 'imperative',
    title: 'Tool names follow snake_case (≤64 chars)',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Agents often pattern-match on tool names. Use lower snake_case (^[a-z][a-z0-9_]{0,63}$): "add_to_cart", not "AddToCart" or "tool-1".'
  },
  'imperative.no-duplicate-registration': {
    category: 'imperative',
    title: 'registerTool is not called twice for the same name without cleanup',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Re-registering the same name without aborting the previous registration leaks listeners and produces unpredictable behavior. Pass { signal: controller.signal } to registerTool, then controller.abort() before re-registering.'
  },
  'declarative.form-pairing': {
    category: 'declarative',
    title: '[toolname] elements are paired with a <form>',
    severity: 'fail',
    weight: 2,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/declarative-api',
    howToFix: 'The declarative API only works on <form> elements (or elements inside a form). Move toolname/tooldescription onto a <form>, otherwise the agent has nothing to submit.'
  },
  'declarative.param-coverage': {
    category: 'declarative',
    title: 'Form inputs have toolparamtitle + toolparamdescription',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/declarative-api',
    howToFix: 'Without toolparamtitle and toolparamdescription on each input/select/textarea, the agent has to guess what to fill in. Add them — they map directly to JSON Schema property title/description.'
  },
  'declarative.has-tooldescription': {
    category: 'declarative',
    title: 'Every [toolname] has a tooldescription',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/declarative-api',
    howToFix: 'Without a meaningful tooldescription, the agent only sees the name. Add tooldescription="…" explaining what submitting the form will do.'
  },
  'metadata.description-length': {
    category: 'metadata',
    title: 'Description is 20–500 characters',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Aim for 20–500 chars. Too short → agent can\'t pick between similar tools. Too long → eats context. Describe what the tool does and when to use it (not how it\'s implemented).'
  },
  'metadata.inputschema-valid': {
    category: 'metadata',
    title: 'inputSchema validates against JSON Schema 2020-12',
    severity: 'fail',
    weight: 2,
    docUrl: 'https://json-schema.org/draft/2020-12/release-notes.html',
    howToFix: 'Your inputSchema isn\'t a valid JSON Schema. Common mistakes: additionalProperties should be a boolean (not a string), every property needs a type, $ref paths must resolve. Validate with a JSON Schema linter.'
  },
  'metadata.inputschema-typed': {
    category: 'metadata',
    title: 'inputSchema root is object and every property is typed',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://json-schema.org/understanding-json-schema/',
    howToFix: 'Set { "type": "object" } on the root and an explicit type on every property. Untyped schemas accept anything, which confuses agents into sending malformed input.'
  },
  'metadata.annotations-present': {
    category: 'metadata',
    title: 'annotations.readOnlyHint is set explicitly',
    severity: 'warn',
    weight: 1,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'Set annotations: { readOnlyHint: true } for tools that only read data, false for tools that mutate state. Agents use this to gate sensitive actions (e.g. require confirmation for writes).'
  },
  'safety.permissions-policy': {
    category: 'safety',
    title: 'Permissions-Policy: tools= header is set',
    severity: 'warn',
    weight: 2,
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
    howToFix: 'If your page can be iframed cross-origin, set Permissions-Policy: tools=(self "https://trusted.com") to control who can call your tools. Default is self-only, which is safe but invisible — being explicit documents intent.'
  },
  'safety.execute-smoke': {
    category: 'safety',
    title: 'executeTool resolves without error',
    severity: 'fail',
    weight: 2,
    docUrl: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    howToFix: 'The tool threw or timed out when called with a synthesized input. Common causes: requires a user gesture (declarative forms often do), missing required field the schema didn\'t mark as required, or the execute() function awaits something that never resolves in headless mode.'
  }
};

export function checkMeta(id) {
  return CHECKS[id] || null;
}
