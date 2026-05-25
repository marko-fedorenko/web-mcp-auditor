import { describe, it, expect } from 'vitest';
import { evaluateChecks } from '../audit/checks.js';
import { computeScores } from '../audit/scoring.js';

function findingsByCheck(findings, checkId) {
  return findings.filter((f) => f.checkId === checkId);
}

describe('evaluateChecks — imperative-only', () => {
  const rawProbe = {
    runtime: {
      modelContextPresent: true,
      firstSeenAt: 0,
      registerToolAvailable: true,
      getToolsAvailable: true,
      executeToolAvailable: true,
      userAgent: 'test'
    },
    registrations: [
      { at: 100, name: 'add_to_cart' },
      { at: 110, name: 'get_cart_total' },
      { at: 120, name: 'apply_promo' }
    ],
    tools: {
      available: true,
      tools: [
        {
          name: 'add_to_cart',
          description: 'Adds an item to the shopping cart by SKU. Quantity defaults to 1.',
          inputSchema: { type: 'object', properties: { sku: { type: 'string' }, quantity: { type: 'integer' } }, required: ['sku'] },
          annotations: { readOnlyHint: false }
        },
        {
          name: 'get_cart_total',
          description: 'Returns the current cart total in the page currency.',
          inputSchema: { type: 'object', properties: {} },
          annotations: { readOnlyHint: true }
        }
      ]
    },
    declarative: [],
    cssPseudos: { toolFormActive: false, toolSubmitActive: false }
  };

  const findings = evaluateChecks({
    rawProbe, responseHeaders: {}, httpStatus: 200, runtimeMode: 'headless-new', executeResults: null
  });

  it('detects modelContext', () => {
    expect(findingsByCheck(findings, 'runtime.api-present')[0].status).toBe('pass');
  });
  it('counts tools', () => {
    expect(findingsByCheck(findings, 'imperative.tool-count')[0].status).toBe('pass');
  });
  it('names are unique', () => {
    expect(findingsByCheck(findings, 'imperative.unique-names')[0].status).toBe('pass');
  });
  it('all snake_case names pass convention', () => {
    expect(findingsByCheck(findings, 'imperative.name-convention')[0].status).toBe('pass');
  });
  it('inputSchema valid for all tools', () => {
    const fails = findingsByCheck(findings, 'metadata.inputschema-valid').filter((f) => f.status === 'fail');
    expect(fails).toEqual([]);
  });
});

describe('evaluateChecks — mixed-bad', () => {
  const rawProbe = {
    runtime: {
      modelContextPresent: true,
      firstSeenAt: 0,
      registerToolAvailable: true,
      getToolsAvailable: true,
      executeToolAvailable: true,
      userAgent: 'test'
    },
    registrations: [
      { at: 100, name: 'X' },
      { at: 110, name: 'bad_schema' },
      { at: 120, name: 'bad_schema' }, // duplicate
      { at: 2600, name: 'late_tool' }   // late
    ],
    tools: {
      available: true,
      tools: [
        { name: 'X', description: 'too short', inputSchema: { type: 'object', properties: { q: {} } } },
        { name: 'bad_schema', description: 'This tool has an invalid JSON Schema as inputSchema.', inputSchema: { type: 'object', additionalProperties: 'yes' } },
        { name: 'late_tool', description: 'Registered after the 2 second window.', inputSchema: { type: 'object' } }
      ]
    },
    declarative: [
      { tag: 'div', toolname: 'orphan_tool', tooldescription: 'bad', attachedToForm: false, params: [{ tag: 'input', name: 'foo', type: 'text', toolparamtitle: null, toolparamdescription: null }] },
      { tag: 'form', toolname: 'incomplete_form', tooldescription: 'Form that lacks param annotations.', attachedToForm: true, params: [
        { tag: 'input', name: 'a', type: 'text', toolparamtitle: null, toolparamdescription: null },
        { tag: 'input', name: 'b', type: 'text', toolparamtitle: null, toolparamdescription: null }
      ] }
    ],
    cssPseudos: { toolFormActive: false, toolSubmitActive: false }
  };

  const findings = evaluateChecks({
    rawProbe, responseHeaders: {}, httpStatus: 200, runtimeMode: 'headless-new', executeResults: null
  });

  it('flags late registration', () => {
    expect(findingsByCheck(findings, 'runtime.late-registration')[0].status).toBe('warn');
  });
  it('flags duplicate registerTool calls', () => {
    // getTools() may dedupe; the authoritative duplicate signal is in registrations
    expect(findingsByCheck(findings, 'imperative.no-duplicate-registration')[0].status).toBe('warn');
  });
  it('flags bad name convention (X)', () => {
    expect(findingsByCheck(findings, 'imperative.name-convention')[0].status).toBe('warn');
  });
  it('flags unpaired declarative element', () => {
    expect(findingsByCheck(findings, 'declarative.form-pairing')[0].status).toBe('fail');
  });
  it('flags missing param annotations', () => {
    expect(findingsByCheck(findings, 'declarative.param-coverage')[0].status).toBe('warn');
  });
  it('flags invalid inputSchema', () => {
    const fails = findingsByCheck(findings, 'metadata.inputschema-valid').filter((f) => f.status === 'fail');
    expect(fails.length).toBeGreaterThanOrEqual(1);
  });
  it('flags short descriptions', () => {
    const warns = findingsByCheck(findings, 'metadata.description-length').filter((f) => f.status === 'warn');
    expect(warns.length).toBeGreaterThanOrEqual(1);
  });
});

describe('evaluateChecks — runtime unavailable', () => {
  const findings = evaluateChecks({
    rawProbe: { runtime: { modelContextPresent: false }, tools: { available: false }, declarative: [], registrations: [] },
    responseHeaders: {}, httpStatus: 200, runtimeMode: 'unavailable', executeResults: null
  });
  it('marks runtime checks as na', () => {
    expect(findingsByCheck(findings, 'runtime.api-present')[0].status).toBe('na');
    expect(findingsByCheck(findings, 'imperative.tool-count')[0].status).toBe('na');
  });
});

describe('computeScores', () => {
  it('weights pass/warn/fail correctly', () => {
    const findings = evaluateChecks({
      rawProbe: {
        runtime: { modelContextPresent: true, registerToolAvailable: true, getToolsAvailable: true, executeToolAvailable: true },
        registrations: [{ at: 50, name: 'a' }],
        tools: { available: true, tools: [{ name: 'a', description: 'A good description that is long enough.', inputSchema: { type: 'object', properties: { x: { type: 'string' } } }, annotations: { readOnlyHint: true } }] },
        declarative: []
      },
      responseHeaders: {}, httpStatus: 200, runtimeMode: 'headless-new', executeResults: null
    });
    const { overallScore, categories } = computeScores(findings);
    expect(overallScore).toBeGreaterThan(0);
    expect(overallScore).toBeLessThanOrEqual(100);
    expect(categories.find((c) => c.id === 'runtime').score).toBeGreaterThanOrEqual(90);
  });
});
