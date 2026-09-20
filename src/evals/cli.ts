#!/usr/bin/env tsx
/**
 * CLI for the offline reasoning lab benchmarks.
 *
 *   pnpm run eval            # reproducible benchmarks over fixed datasets
 *
 * These score deterministic baselines, so the result is a fixed point: the same
 * commit always produces the same numbers. For hosted-model scores on the same
 * datasets, use `pnpm run eval:model`.
 *
 * Writes results to src/evals/results/latest.json, which the Worker serves from
 * GET /capabilities.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmarkSuite } from "./benchmarks/runner";
import { LAB_VERSION } from "@/metrics/labStatus";
import type { EvalResultsFile } from "./schema";

function getGitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const gitSha = getGitSha();

  console.log("BleuJS Reasoning Lab — offline benchmarks\n");
  console.log("Fixed datasets, exact scoring, deterministic baselines:");

  const benchmark = await runBenchmarkSuite(gitSha);
  for (const b of benchmark.benchmarks) {
    const icon = b.passed ? "✓" : "✗";
    console.log(
      `  ${icon} ${b.name} — ${b.correct}/${b.total} ${b.metric} ` +
        `(${(b.score * 100).toFixed(1)}%) [${b.durationMs}ms]`,
    );
  }
  console.log(
    `  → ${benchmark.passed}/${benchmark.total} benchmarks passed — ` +
      `pass rate ${(benchmark.passRate * 100).toFixed(1)}%\n`,
  );

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "results", "latest.json");
  const payload: EvalResultsFile = {
    labVersion: LAB_VERSION,
    gitSha,
    generatedAt: new Date().toISOString(),
    benchmark,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Results written to ${outPath}`);

  process.exit(benchmark.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
