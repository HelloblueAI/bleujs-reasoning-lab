#!/usr/bin/env tsx
/**
 * CLI for running the Autonomous Reasoning Lab eval suite locally.
 */

import { runEvalSuite } from './runner';

const llm = process.argv.includes('--llm');

async function main() {
  console.log('BleuJS Autonomous Reasoning Lab — Eval Suite\n');
  const result = await runEvalSuite(llm);

  for (const r of result.results) {
    const icon = r.skipped ? '○' : r.passed ? '✓' : '✗';
    console.log(`${icon} ${r.name} (${r.category}) — ${r.message} [${r.durationMs}ms]`);
  }

  console.log(
    `\n${result.passed}/${result.total - result.skipped} passed` +
      (result.skipped ? ` (${result.skipped} skipped)` : '') +
      ` — pass rate ${(result.passRate * 100).toFixed(1)}%`
  );

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
