/**
 * Reads the last committed offline benchmark run and exposes it as the Worker's
 * capability report.
 *
 * This deliberately replaces the previous heuristic capability scores. The old
 * numbers were formulas over request counters ("understandingDepth",
 * "adaptability") that measured nothing and were capped so they never reached
 * 1.0. These numbers are reproducible instead: anyone can run `pnpm run eval`
 * at the recorded git SHA and get the same values.
 */

import latest from "@/evals/results/latest.json";
import type { BenchmarkSummary } from "@/metrics/labStatus";

type CommittedBenchmark = {
  id: string;
  score: number;
};

type CommittedRun = {
  gitSha?: string | null;
  generatedAt?: string | null;
  benchmark?: {
    passed?: number;
    total?: number;
    passRate?: number;
    benchmarks?: CommittedBenchmark[];
  };
};

/** The committed offline run, or null if results have not been generated yet. */
export function getOfflineBenchmarkSummary(): BenchmarkSummary | null {
  const run = latest as CommittedRun;
  const benchmark = run.benchmark;
  if (!benchmark || typeof benchmark.total !== "number") {
    return null;
  }

  const scores: Record<string, number> = {};
  for (const entry of benchmark.benchmarks ?? []) {
    scores[entry.id] = entry.score;
  }

  return {
    source: "src/evals/results/latest.json (pnpm run eval)",
    recordedAt: run.generatedAt ?? null,
    gitSha: run.gitSha ?? null,
    passed: benchmark.passed ?? 0,
    total: benchmark.total,
    passRate: benchmark.passRate ?? 0,
    scores,
  };
}
