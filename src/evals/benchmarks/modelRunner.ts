/**
 * Model-in-the-loop benchmarks over the same fixed datasets as the offline suite.
 *
 * The offline benchmarks in `./runner.ts` score the lab's own components and
 * never call a model. These run the identical items through an evaluation-only
 * provider so a model's score is comparable to the local baseline on the core
 * tier. Decoding is sampled, so every item is repeated `runs` times and scored
 * by majority vote, with latency and truncations recorded per attempt.
 *
 * Unlike the offline suite, this runs **both tiers** and reports them
 * separately. Strong models saturate the core tier, so a blended score cannot
 * show whether a configuration change mattered; `tierScores.hard` is where the
 * difference between reasoning-on and reasoning-off is visible.
 */

import { LAB_VERSION } from "@/metrics/labStatus";
import {
  LOGIC_PUZZLES,
  puzzleStatement,
  solvePuzzle,
} from "@/evals/logicPuzzle";
import { askEvalModel, type ModelAttempt } from "@/evals/model/evalModelClient";
import type { ResolvedEvalModel } from "@/evals/model/evalModelConfig";
import type {
  LatencyStats,
  ModelAttemptResult,
  ModelBenchmarkId,
  ModelBenchmarkItemResult,
  ModelBenchmarkResult,
  ModelBenchmarkSuiteResult,
  TierScores,
} from "@/evals/schema";
import {
  ABSTENTION_ITEMS,
  ARITHMETIC_ITEMS,
  RETRIEVAL_QUERIES,
  type Tier,
  TOOL_SELECTION_ITEMS,
} from "./datasets";

/** Same bar as the offline suite so scores read on one scale. */
const PASS_THRESHOLD = 0.9;

/**
 * Integer items are matched exactly, like the offline arithmetic suite. Decimal
 * items get a few ulps of slack purely to absorb IEEE-754 rounding when the
 * model prints a correctly computed value — never enough to accept a near miss.
 */
const DECIMAL_TOLERANCE = 1e-12;

const TOOL_LABELS = [
  "calculator",
  "websearch",
  "codeexecution",
  "sentiment",
  "none",
] as const;

const BASE_SYSTEM =
  "You are being evaluated by an automated grader. Follow the answer format " +
  "exactly. End your reply with a single line starting with 'FINAL:' " +
  "containing only the answer, with no explanation after it.";

interface GradedItem {
  id: string;
  tier: Tier;
  expected: string;
  prompt: { system: string; user: string };
  /** Returns the normalized value that was graded, plus whether it matched. */
  grade: (answer: string) => { passed: boolean; got: string };
}

interface BenchmarkSpec {
  id: ModelBenchmarkId;
  name: string;
  metric: string;
  items: GradedItem[];
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,$\s]/g, "").replace(/[.]$/, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function numbersMatch(got: number, expected: number): boolean {
  if (got === expected) return true;
  if (Number.isInteger(expected)) return false;
  return (
    Math.abs(got - expected) <=
    DECIMAL_TOLERANCE * Math.max(Math.abs(expected), 1)
  );
}

function arithmeticSpec(): BenchmarkSpec {
  return {
    id: "arithmetic",
    name: "Arithmetic (exact)",
    metric: "exact match",
    items: ARITHMETIC_ITEMS.map((item) => ({
      id: item.id,
      tier: item.tier,
      expected: String(item.expected),
      prompt: {
        system:
          `${BASE_SYSTEM} Give the exact numeric result with no commas, ` +
          `no units, and no rounding.`,
        user: `Compute: ${item.input}`,
      },
      grade: (answer) => {
        const got = parseNumber(answer);
        return {
          passed: got !== null && numbersMatch(got, item.expected),
          got: got === null ? answer : String(got),
        };
      },
    })),
  };
}

function retrievalSpec(): BenchmarkSpec {
  return {
    id: "retrieval",
    name: "Retrieval (top-1)",
    metric: "top-1 accuracy",
    items: RETRIEVAL_QUERIES.map((query) => {
      const expectedIndex = query.passages.indexOf(query.expectedTop);
      const numbered = query.passages
        .map((passage, index) => `${index + 1}. ${passage}`)
        .join("\n");
      return {
        id: query.id,
        tier: query.tier,
        expected: query.expectedTop,
        prompt: {
          system: `${BASE_SYSTEM} Answer with the number of the single best passage.`,
          user: `Question: ${query.query}\n\nPassages:\n${numbered}\n\nWhich passage answers the question?`,
        },
        grade: (answer) => {
          const picked = parseNumber(answer);
          const index = picked === null ? -1 : picked - 1;
          return {
            passed: index === expectedIndex,
            got: query.passages[index] ?? answer,
          };
        },
      };
    }),
  };
}

function toolSelectionSpec(): BenchmarkSpec {
  return {
    id: "tool-selection",
    name: "Tool selection",
    metric: "exact label accuracy",
    items: TOOL_SELECTION_ITEMS.map((item) => ({
      id: item.id,
      tier: item.tier,
      expected: item.expected,
      prompt: {
        system:
          `${BASE_SYSTEM} Choose exactly one tool from this list: ` +
          `${TOOL_LABELS.join(", ")}. Use 'none' when no tool is needed.`,
        user: `Which tool should handle this request?\n\n${item.query}`,
      },
      grade: (answer) => {
        const got = answer.toLowerCase().replace(/[^a-z]/g, "");
        return { passed: got === item.expected, got: got || answer };
      },
    })),
  };
}

function abstentionSpec(): BenchmarkSpec {
  return {
    id: "abstention",
    name: "Abstention (no fabricated math)",
    metric: "abstention rate",
    items: ABSTENTION_ITEMS.map((item) => ({
      id: item.id,
      tier: item.tier,
      expected: "UNSUPPORTED",
      prompt: {
        system:
          `${BASE_SYSTEM} You are a calculator-only assistant. If the request ` +
          `is a pure arithmetic computation, return its numeric result. ` +
          `Otherwise you must decline by answering exactly UNSUPPORTED.`,
        user: item.input,
      },
      grade: (answer) => {
        const got = answer.toUpperCase().replace(/[^A-Z]/g, "");
        return { passed: got === "UNSUPPORTED", got: answer };
      },
    })),
  };
}

function logicPuzzleSpec(): BenchmarkSpec {
  const items: GradedItem[] = [];

  for (const puzzle of LOGIC_PUZZLES) {
    // Refuse to grade against a fixture whose clues do not pin exactly one
    // assignment, or whose declared answer is not that assignment. Spending a
    // paid eval run on an ambiguous puzzle would produce a meaningless score.
    const solution = solvePuzzle(puzzle);
    if (!solution.solved) {
      throw new Error(
        `Logic puzzle "${puzzle.id}" has no unique solution; fixture is broken.`,
      );
    }
    for (const agent of puzzle.agents) {
      if (solution.assignment[agent] !== puzzle.expectedAssignment[agent]) {
        throw new Error(
          `Logic puzzle "${puzzle.id}" declares ${agent}=${puzzle.expectedAssignment[agent]} ` +
            `but the unique solution is ${agent}=${solution.assignment[agent]}.`,
        );
      }
    }

    const statement = puzzleStatement(puzzle);

    for (const agent of puzzle.agents) {
      // The fixture's declared answer, cross-checked by the solver in the
      // offline suite, so a model is never graded against a solver guess.
      const expected = puzzle.expectedAssignment[agent]!;
      items.push({
        id: `${puzzle.id}-${agent}`,
        tier: puzzle.tier,
        expected,
        prompt: {
          system: `${BASE_SYSTEM} Answer with one module name only.`,
          user: `${statement}\n\nWhich module is assigned to ${agent}?`,
        },
        grade: (answer) => {
          const normalized = answer.toLowerCase().replace(/[^a-z]/g, "");
          const got =
            puzzle.modules.find((mod) => mod.toLowerCase() === normalized) ??
            answer;
          return { passed: got === expected, got };
        },
      });
    }
  }

  return {
    id: "logic-puzzle",
    name: "Logic puzzle (constraint solve)",
    metric: "exact assignment",
    items,
  };
}

export const MODEL_BENCHMARK_SPECS: ReadonlyArray<() => BenchmarkSpec> = [
  arithmeticSpec,
  logicPuzzleSpec,
  retrievalSpec,
  toolSelectionSpec,
  abstentionSpec,
];

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

/**
 * Take a capped sample that still covers both tiers.
 *
 * Items are declared core-first, so a plain `slice` would give a smoke run
 * nothing but core items — exactly the saturated half that cannot distinguish
 * configurations. Splitting the budget keeps `--smoke` and `--limit` honest.
 */
function limitAcrossTiers(items: GradedItem[], limit: number): GradedItem[] {
  const core = items.filter((item) => item.tier === "core");
  const hard = items.filter((item) => item.tier === "hard");
  const coreBudget = Math.ceil(limit / 2);
  const picked = [
    ...core.slice(0, coreBudget),
    ...hard.slice(0, limit - Math.min(coreBudget, core.length)),
  ];
  // Top up from whichever tier still has items if one was short.
  if (picked.length < limit) {
    for (const item of items) {
      if (picked.length >= limit) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }
  return picked;
}

/**
 * Split accuracy by tier. Only items with a gradeable run count, so a tier that
 * was entirely rate-limited reports a null score instead of a misleading 0.
 */
function tierScores(items: ModelBenchmarkItemResult[]): TierScores {
  const summarize = (tier: Tier) => {
    const gradeable = items.filter(
      (item) => item.tier === tier && item.passed !== null,
    );
    const correct = gradeable.filter((item) => item.passed).length;
    return {
      total: gradeable.length,
      correct,
      score: gradeable.length > 0 ? correct / gradeable.length : null,
    };
  };
  return { core: summarize("core"), hard: summarize("hard") };
}

/** Combine per-benchmark tier scores into one suite-level split. */
function mergeTierScores(parts: TierScores[]): TierScores {
  const merge = (tier: Tier) => {
    const total = parts.reduce((sum, p) => sum + p[tier].total, 0);
    const correct = parts.reduce((sum, p) => sum + p[tier].correct, 0);
    return { total, correct, score: total > 0 ? correct / total : null };
  };
  return { core: merge("core"), hard: merge("hard") };
}

function latencyStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0,
  };
}

function toAttemptResult(
  attempt: ModelAttempt,
  item: GradedItem,
): ModelAttemptResult {
  const graded =
    attempt.answer === null
      ? { passed: false, got: attempt.error ?? "no answer" }
      : item.grade(attempt.answer);

  return {
    // An attempt the endpoint never answered is not a wrong answer.
    passed: attempt.inconclusive ? false : graded.passed,
    got: graded.got,
    latencyMs: attempt.latencyMs,
    truncated: attempt.truncated,
    inconclusive: attempt.inconclusive,
    timedOut: attempt.timedOut,
    completionTokens: attempt.completionTokens,
    reasoningChars: attempt.reasoningChars,
    error: attempt.error,
  };
}

/** The free endpoint rate-limits aggressively; keep parallelism low by default. */
const DEFAULT_CONCURRENCY = 2;

/** Bounded parallelism keeps the shared free endpoint from rate-limiting us. */
async function mapWithConcurrency<T, R>(
  inputs: T[],
  limit: number,
  worker: (input: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(inputs.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, inputs.length) }, () =>
    (async () => {
      while (cursor < inputs.length) {
        const index = cursor++;
        results[index] = await worker(inputs[index]!, index);
      }
    })(),
  );

  await Promise.all(runners);
  return results;
}

export interface ModelBenchmarkOptions {
  gitSha?: string | null;
  /** Cap items per benchmark — used for quick smoke runs. */
  limitPerBenchmark?: number | undefined;
  concurrency?: number | undefined;
  onProgress?: (event: {
    benchmark: string;
    itemId: string;
    tier: Tier;
    passed: boolean | null;
    /** Items finished in this benchmark, out of its total. */
    done: number;
    total: number;
    latencyMs: number;
  }) => void;
}

async function runSpec(
  spec: BenchmarkSpec,
  model: ResolvedEvalModel,
  options: ModelBenchmarkOptions,
): Promise<ModelBenchmarkResult> {
  const start = Date.now();
  const runs = model.config.runs;
  const items = options.limitPerBenchmark
    ? limitAcrossTiers(spec.items, options.limitPerBenchmark)
    : spec.items;

  let done = 0;
  const results = await mapWithConcurrency(
    items,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (item): Promise<ModelBenchmarkItemResult> => {
      const attempts: ModelAttemptResult[] = [];
      for (let run = 0; run < runs; run++) {
        attempts.push(
          toAttemptResult(await askEvalModel(model, item.prompt), item),
        );
      }
      const scored = attempts.filter((a) => !a.inconclusive);
      const passedRuns = scored.filter((a) => a.passed).length;
      const passed =
        scored.length === 0 ? null : passedRuns * 2 > scored.length;
      options.onProgress?.({
        benchmark: spec.name,
        itemId: item.id,
        tier: item.tier,
        passed,
        done: ++done,
        total: items.length,
        latencyMs: Math.max(...attempts.map((a) => a.latencyMs)),
      });
      return {
        id: item.id,
        tier: item.tier,
        expected: item.expected,
        passed,
        passedRuns,
        scoredRuns: scored.length,
        runs,
        attempts,
      };
    },
  );

  const gradeable = results.filter((r) => r.passed !== null);
  const correct = gradeable.filter((r) => r.passed).length;
  const score = gradeable.length > 0 ? correct / gradeable.length : 0;
  const attempts = results.flatMap((r) => r.attempts);

  return {
    id: spec.id,
    name: spec.name,
    metric: spec.metric,
    total: gradeable.length,
    correct,
    score,
    passed: gradeable.length > 0 && score >= PASS_THRESHOLD,
    runs,
    deterministic: false,
    unstableItems: gradeable.filter(
      (r) => r.passedRuns > 0 && r.passedRuns < r.scoredRuns,
    ).length,
    inconclusiveItems: results.length - gradeable.length,
    tierScores: tierScores(results),
    truncations: attempts.filter((a) => a.truncated).length,
    errors: attempts.filter((a) => a.error !== null && !a.inconclusive).length,
    rateLimited: attempts.filter((a) => a.inconclusive && !a.timedOut).length,
    timedOut: attempts.filter((a) => a.timedOut).length,
    // Failed requests return in milliseconds and would skew the percentiles.
    latencyMs: latencyStats(
      attempts.filter((a) => !a.inconclusive).map((a) => a.latencyMs),
    ),
    durationMs: Date.now() - start,
    items: results,
  };
}

export async function runModelBenchmarkSuite(
  model: ResolvedEvalModel,
  options: ModelBenchmarkOptions = {},
): Promise<ModelBenchmarkSuiteResult> {
  const start = Date.now();
  const benchmarks: ModelBenchmarkResult[] = [];

  for (const makeSpec of MODEL_BENCHMARK_SPECS) {
    benchmarks.push(await runSpec(makeSpec(), model, options));
  }

  const attempts = benchmarks.flatMap((b) =>
    b.items.flatMap((item) => item.attempts),
  );
  const passed = benchmarks.filter((b) => b.passed).length;
  const totalItems = benchmarks.reduce((sum, b) => sum + b.total, 0);
  const correctItems = benchmarks.reduce((sum, b) => sum + b.correct, 0);

  return {
    suite: "model-benchmark",
    labVersion: LAB_VERSION,
    gitSha: options.gitSha ?? null,
    timestamp: Date.now(),
    provider: model.config.provider,
    model: model.config.model,
    reasoning: model.config.reasoning,
    config: {
      temperature: model.config.temperature,
      topP: model.config.topP,
      maxTokens: model.config.maxTokens,
      runs: model.config.runs,
      timeoutMs: model.config.timeoutMs,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    },
    total: benchmarks.length,
    passed,
    failed: benchmarks.length - passed,
    passRate: benchmarks.length > 0 ? passed / benchmarks.length : 0,
    itemScore: totalItems > 0 ? correctItems / totalItems : 0,
    tierScores: mergeTierScores(benchmarks.map((b) => b.tierScores)),
    inconclusiveItems: benchmarks.reduce(
      (sum, b) => sum + b.inconclusiveItems,
      0,
    ),
    rateLimited: benchmarks.reduce((sum, b) => sum + b.rateLimited, 0),
    timedOut: benchmarks.reduce((sum, b) => sum + b.timedOut, 0),
    latencyMs: latencyStats(
      attempts.filter((a) => !a.inconclusive).map((a) => a.latencyMs),
    ),
    completionTokens: attempts.reduce(
      (sum, a) => sum + (a.completionTokens ?? 0),
      0,
    ),
    durationMs: Date.now() - start,
    benchmarks,
  };
}
