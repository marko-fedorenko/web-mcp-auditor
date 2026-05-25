import { CATEGORIES, CHECKS } from './checks-catalog.js';

const STATUS_RANK = { pass: 1.0, warn: 0.5, fail: 0.0 };

export function computeScores(findings) {
  const buckets = new Map();
  for (const cat of CATEGORIES) buckets.set(cat.id, []);

  for (const f of findings) {
    if (f.status === 'na' || f.status === 'info') continue;
    if (!buckets.has(f.category)) buckets.set(f.category, []);
    buckets.get(f.category).push(f);
  }

  const categories = CATEGORIES.map((cat) => {
    const list = buckets.get(cat.id) || [];
    let totalWeight = 0;
    let earned = 0;
    for (const f of list) {
      const meta = CHECKS[f.checkId];
      const weight = meta ? meta.weight : 1;
      totalWeight += weight;
      earned += weight * (STATUS_RANK[f.status] ?? 0);
    }
    const score = totalWeight === 0 ? null : Math.round((earned / totalWeight) * 100);
    return {
      id: cat.id,
      title: cat.title,
      description: cat.description,
      score,
      passCount: list.filter((f) => f.status === 'pass').length,
      warnCount: list.filter((f) => f.status === 'warn').length,
      failCount: list.filter((f) => f.status === 'fail').length,
      naCount: findings.filter((f) => f.category === cat.id && f.status === 'na').length,
      findings: findings.filter((f) => f.category === cat.id)
    };
  });

  const scored = categories.filter((c) => c.score !== null);
  const overallScore = scored.length === 0
    ? null
    : Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length);

  return { overallScore, categories };
}
