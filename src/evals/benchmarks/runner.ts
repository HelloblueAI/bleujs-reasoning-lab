/**
 * Reproducible benchmark suite (offline, deterministic, exact scoring).
 *
 * These are real benchmarks over fixed datasets — not smoke tests. Each returns
 * per-item results so regressions between releases are diffable. None of these
 * require API keys; an optional live-LLM benchmark can be added separately and
 * would populate the `model`/`costUsd` fields.
 */

import { tryArithmeticReason } from "@/routing/arithmeticReason";
import { rankTextsByOverlap } from "@/retrieval/semanticRetrieval";
import { ToolSystem } from "@/tools/ToolSystem";
import { solveBleuLabPuzzle } from "@/evals/logicPuzzle";
import { LAB_VERSION } from "@/metrics/labStatus";
import {
  ABSTENTION_ITEMS,
  ARITHMETIC_ITEMS,
  RETRIEVAL_QUERIES,
  ROUTING_EXPECTED,
  ROUTING_FIXTURES,
  TOOL_SELECTION_ITEMS,
} from "./datasets";
import type {
  BenchmarkItemResult,
  BenchmarkResult,
  BenchmarkSuiteResult,
} from "@/evals/schema";

/** Pass threshold applied to every benchmark's score (fraction correct). */
const PASS_THRESHOLD = 0.9;

function parseAnswerNumber(answer: string): number | null {
  const tail = answer.split("=").pop();
  if (!tail) return null;
  const value = Number(tail.replace(/,/g, "").trim());
  return Number.isFinite(value) ? value : null;
}

function finalize(
  id: BenchmarkResult["id"],
  name: string,
  metric: string,
  items: BenchmarkItemResult[],
  start: number,
): BenchmarkResult {
  const correct = items.filter((i) => i.passed).length;
  const score = items.length > 0 ? correct / items.length : 0;
  return {
    id,
    name,
    metric,
    total: items.length,
    correct,
    score,
    passed: score >= PASS_THRESHOLD,
    runs: 1,
    deterministic: true,
    durationMs: Date.now() - start,
    model: null,
    costUsd: null,
    items,
  };
}

function runArithmetic(): BenchmarkResult {
  const start = Date.now();
  const items: BenchmarkItemResult[] = ARITHMETIC_ITEMS.map((item) => {
    const result = tryArithmeticReason(item.input);
    const got = result ? parseAnswerNumber(result.answer) : null;
    return {
      id: item.id,
      passed: got === item.expected,
      got: got === null ? "abstained" : String(got),
      expected: String(item.expected),
    };
  });
  return finalize(
    "arithmetic",
    "Arithmetic (exact)",
    "exact match",
    items,
    start,
  );
}

function runRetrieval(): BenchmarkResult {
  const start = Date.now();
  const items: BenchmarkItemResult[] = RETRIEVAL_QUERIES.map((q) => {
    const ranked = rankTextsByOverlap(q.query, q.passages);
    const top = ranked[0];
    return {
      id: q.id,
      passed: top?.text === q.expectedTop && (top?.score ?? 0) > 0,
      got: top?.text ?? "none",
      expected: q.expectedTop,
    };
  });
  return finalize(
    "retrieval",
    "Retrieval (top-1)",
    "top-1 accuracy",
    items,
    start,
  );
}

function runToolSelection(): BenchmarkResult {
  const start = Date.now();
  const tools = new ToolSystem();
  const items: BenchmarkItemResult[] = TOOL_SELECTION_ITEMS.map((item) => {
    const detected = tools.detectTool(item.query);
    return {
      id: item.id,
      passed: detected === item.expected,
      got: detected,
      expected: item.expected,
    };
  });
  return finalize(
    "tool-selection",
    "Tool selection",
    "exact label accuracy",
    items,
    start,
  );
}

function runRouting(): BenchmarkResult {
  const start = Date.now();
  const total = ROUTING_FIXTURES.length;
  let solved = 0;
  let fallbackSolved = 0;
  for (const fixture of ROUTING_FIXTURES) {
    const winnerIndex = fixture.attempts.findIndex(([, ok]) => ok);
    if (winnerIndex >= 0) {
      solved += 1;
      if (winnerIndex > 0) fallbackSolved += 1;
    }
  }
  const successRate = total > 0 ? solved / total : 0;
  const fallbackRate = total > 0 ? fallbackSolved / total : 0;
  const items: BenchmarkItemResult[] = [
    {
      id: "success-rate",
      passed: successRate === ROUTING_EXPECTED.successRate,
      got: successRate.toFixed(2),
      expected: ROUTING_EXPECTED.successRate.toFixed(2),
    },
    {
      id: "fallback-rate",
      passed: fallbackRate === ROUTING_EXPECTED.fallbackRate,
      got: fallbackRate.toFixed(2),
      expected: ROUTING_EXPECTED.fallbackRate.toFixed(2),
    },
  ];
  return finalize(
    "routing",
    "Routing success/fallback",
    "exact rate match",
    items,
    start,
  );
}

function runAbstention(): BenchmarkResult {
  const start = Date.now();
  const items: BenchmarkItemResult[] = ABSTENTION_ITEMS.map((item) => {
    const result = tryArithmeticReason(item.input);
    return {
      id: item.id,
      passed: result === null,
      got: result === null ? "abstained" : result.answer,
      expected: "abstained",
    };
  });
  return finalize(
    "abstention",
    "Abstention (no fabricated math)",
    "abstention rate",
    items,
    start,
  );
}

function runLogicPuzzle(): BenchmarkResult {
  const start = Date.now();
  const puzzle = solveBleuLabPuzzle();
  const expected: Record<string, string> = {
    Alpha: "Orchestration",
    Beta: "Reasoning",
    Gamma: "Understanding",
  };
  const items: BenchmarkItemResult[] = Object.entries(expected).map(
    ([agent, mod]) => ({
      id: `assign-${agent}`,
      passed: puzzle.solved && puzzle.assignment[agent] === mod,
      got: puzzle.assignment[agent] ?? "unassigned",
      expected: mod,
    }),
  );
  return finalize(
    "logic-puzzle",
    "Logic puzzle (constraint solve)",
    "exact assignment",
    items,
    start,
  );
}

export async function runBenchmarkSuite(
  gitSha: string | null = null,
): Promise<BenchmarkSuiteResult> {
  const start = Date.now();
  const benchmarks: BenchmarkResult[] = [
    runArithmetic(),
    runLogicPuzzle(),
    runRetrieval(),
    runToolSelection(),
    runRouting(),
    runAbstention(),
  ];

  const passed = benchmarks.filter((b) => b.passed).length;
  const failed = benchmarks.length - passed;

  return {
    suite: "benchmark",
    labVersion: LAB_VERSION,
    gitSha,
    timestamp: Date.now(),
    total: benchmarks.length,
    passed,
    failed,
    passRate: benchmarks.length > 0 ? passed / benchmarks.length : 0,
    durationMs: Date.now() - start,
    benchmarks,
  };
}
