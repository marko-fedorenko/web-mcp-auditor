import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import jsf from 'json-schema-faker';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

jsf.option({
  alwaysFakeOptionals: false,
  useDefaultValue: true,
  requiredOnly: true,
  failOnInvalidTypes: false,
  failOnInvalidFormat: false
});

const PER_TOOL_TIMEOUT_MS = 3000;

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function synthInput(tool) {
  if (!tool.inputSchema || typeof tool.inputSchema !== 'object') return {};
  try {
    // Pass the actual random fn — not a factory. Bug: () => deterministicRand(...) returns a
    // function, breaking jsf's random branch and looping forever on minLength/maxLength.
    jsf.option({ random: deterministicRand(tool.name || 'unnamed') });
    const sample = jsf.generate(tool.inputSchema);
    const validate = ajv.compile(tool.inputSchema);
    if (validate(sample)) return sample;
    return sample || {};
  } catch (e) {
    return {};
  }
}

function deterministicRand(seedKey) {
  let s = hashSeed(seedKey) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function preview(val) {
  try {
    const s = JSON.stringify(val);
    return s.length > 400 ? s.slice(0, 400) + '…' : s;
  } catch {
    return String(val).slice(0, 400);
  }
}

export async function runExecutionTests(page, tools) {
  const results = [];
  for (const tool of tools) {
    if (!tool.name) {
      results.push({ name: '(unnamed)', skipped: true, skipReason: 'tool has no name' });
      continue;
    }
    if (tool.canExecute === false) {
      results.push({ name: tool.name, skipped: true, skipReason: 'modelContext.executeTool unavailable' });
      continue;
    }
    const input = synthInput(tool);
    const inputJson = JSON.stringify(input);
    const t0 = Date.now();
    try {
      // Wrap page.evaluate in our own race — if Chrome's executeTool deadlocks (e.g. waits
      // for a user gesture that never comes in headless), the inner Promise.race wouldn't help
      // because Chrome would still hold the evaluate transport open.
      const outerRace = Promise.race([
        page.evaluate(
          async (name, json, timeoutMs) => {
            const mc = navigator && navigator.modelContext;
            if (!mc || typeof mc.getTools !== 'function' || typeof mc.executeTool !== 'function') {
              return { ok: false, error: 'modelContext API missing' };
            }
            const all = await mc.getTools();
            const target = (all || []).find((t) => t && t.name === name);
            if (!target) return { ok: false, error: 'tool no longer registered' };
            try {
              const exec = mc.executeTool(target, json);
              const winner = await Promise.race([
                exec.then((r) => ({ ok: true, result: r })),
                new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: `timeout after ${timeoutMs}ms` }), timeoutMs))
              ]);
              return winner;
            } catch (e) {
              return { ok: false, error: String(e && e.message || e) };
            }
          },
          tool.name,
          inputJson,
          PER_TOOL_TIMEOUT_MS
        ),
        new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: `evaluate-level timeout after ${PER_TOOL_TIMEOUT_MS + 1000}ms (likely user-gesture / confirmation dialog required)` }), PER_TOOL_TIMEOUT_MS + 1000))
      ]);
      const { ok, result, error } = await outerRace;
      const durationMs = Date.now() - t0;
      if (ok) {
        results.push({ name: tool.name, success: true, durationMs, resultPreview: preview(result), input });
      } else {
        results.push({ name: tool.name, success: false, durationMs, error, input });
      }
    } catch (e) {
      results.push({ name: tool.name, success: false, durationMs: Date.now() - t0, error: String(e.message || e), input });
    }
  }
  return results;
}
