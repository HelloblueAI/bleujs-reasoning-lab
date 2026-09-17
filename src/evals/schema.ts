/**
 * Shared result schema for the reproducible benchmark suite.
 *
 * Benchmarks use fixed datasets and exact scoring so results are comparable
 * across releases. Model/cost fields are null for offline benchmarks.
 */

export type BenchmarkId =
  | "arithmetic"
  | "logic-puzzle"
  | "retrieval"
  | "tool-selection"
  | "routing"
  | "abstention";

export interface BenchmarkItemResult {
  /** Stable identifier for the individual item within the benchmark. */
  id: string;
  passed: boolean;
  /** What the system produced (stringified for the report). */
  got: string;
  /** The exact expected value. */
  expected: string;
}

export interface BenchmarkResult {
  id: BenchmarkId;
  name: string;
  /** How the benchmark is scored (e.g. "exact match", "top-1 accuracy"). */
  metric: string;
  /** Number of items in the fixed dataset. */
  total: number;
  correct: number;
  /** correct / total. */
  score: number;
  passed: boolean;
  /** Number of repeated runs (>1 only for stochastic benchmarks). */
  runs: number;
  /** True when the benchmark is fully deterministic offline. */
  deterministic: boolean;
  durationMs: number;
  /** Model identifier when an LLM was used; null for offline benchmarks. */
  model: string | null;
  /** Measured USD cost when applicable; null for offline benchmarks. */
  costUsd: number | null;
  items: BenchmarkItemResult[];
}

export interface BenchmarkSuiteResult {
  suite: "benchmark";
  labVersion: string;
  gitSha: string | null;
  timestamp: number;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs: number;
  benchmarks: BenchmarkResult[];
}

/**
 * Model-in-the-loop results. Kept separate from `BenchmarkResult` because these
 * are sampled (temperature > 0), so every item is repeated and scored by
 * majority vote, and latency/token cost are part of the record.
 */
export type ModelBenchmarkId = Exclude<BenchmarkId, "routing">;

export interface ModelAttemptResult {
  passed: boolean;
  got: string;
  latencyMs: number;
  truncated: boolean;
  /** Endpoint never answered (rate limit / overload); not scored. */
  inconclusive: boolean;
  completionTokens: number | null;
  /** Size of the discarded reasoning trace; never graded. */
  reasoningChars: number;
  error: string | null;
}

export interface ModelBenchmarkItemResult {
  id: string;
  expected: string;
  /** Majority of scored runs passed. Null when every run was inconclusive. */
  passed: boolean | null;
  passedRuns: number;
  /** Runs that produced a gradeable response. */
  scoredRuns: number;
  runs: number;
  attempts: ModelAttemptResult[];
}

export interface LatencyStats {
  p50: number;
  p95: number;
  max: number;
}

export interface ModelBenchmarkResult {
  id: ModelBenchmarkId;
  name: string;
  metric: string;
  /** Items with at least one gradeable run; the scoring denominator. */
  total: number;
  correct: number;
  score: number;
  passed: boolean;
  runs: number;
  deterministic: false;
  /** Items whose scored runs disagreed — the cost of sampled decoding. */
  unstableItems: number;
  /** Items dropped because the endpoint never answered. */
  inconclusiveItems: number;
  truncations: number;
  /** Attempts the model answered unusably (bad format/truncation). */
  errors: number;
  /** Attempts lost to rate limiting or overload; excluded from scoring. */
  rateLimited: number;
  latencyMs: LatencyStats;
  durationMs: number;
  items: ModelBenchmarkItemResult[];
}

export interface ModelBenchmarkSuiteResult {
  suite: "model-benchmark";
  labVersion: string;
  gitSha: string | null;
  timestamp: number;
  provider: string;
  model: string;
  /** "on" | "off" — the Nemotron enable_thinking setting used. */
  reasoning: string;
  config: {
    temperature: number;
    topP: number;
    maxTokens: number;
    runs: number;
    timeoutMs?: number;
    /**
     * Request parallelism. Latency is only comparable between runs at equal
     * concurrency — the shared endpoint queues under load.
     */
    concurrency?: number;
  };
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  /** Item-weighted accuracy across all gradeable items. */
  itemScore: number;
  /** Items excluded because the endpoint never answered. */
  inconclusiveItems: number;
  rateLimited: number;
  latencyMs: LatencyStats;
  completionTokens: number;
  durationMs: number;
  benchmarks: ModelBenchmarkResult[];
}

export interface SmokeSuiteReport {
  suite: "smoke";
  labVersion: string;
  timestamp: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
}

export interface EvalResultsFile {
  labVersion: string;
  gitSha: string | null;
  generatedAt: string;
  smoke: SmokeSuiteReport;
  benchmark: BenchmarkSuiteResult;
}
