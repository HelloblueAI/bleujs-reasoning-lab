/**
 * Status payloads for the BleuJS Reasoning Lab.
 *
 * Every field here is either a counter the Worker incremented, a duration it
 * timed, or a benchmark score read from a committed eval result. Nothing is
 * derived from a heuristic "capability" formula — if a number cannot be traced
 * to a measurement, it does not belong in this file.
 */

import type {
  LatencySummary,
  RequestCounters,
} from "@/metrics/requestCounters";
import { buildLlmRoutingPayload } from "@/routing/llmRoutingMetrics";

export const LAB_VERSION = "6.0.0";
/** Public product name (API + dashboard) */
export const LAB_NAME = "BleuJS Reasoning Lab";
/** Internal project name — used in docs and repo */
export const LAB_PROJECT_NAME = "BleuJS Reasoning Lab";
/** GitHub repository */
export const GITHUB_REPO =
  "https://github.com/HelloblueAI/bleujs-reasoning-lab";

export type LlmRoutingSummary = ReturnType<typeof buildLlmRoutingPayload>;

/**
 * Benchmark scores are not computed at request time — they come from the last
 * committed run of the offline suite, so the dashboard reports a reproducible
 * number rather than a fresh guess.
 */
export type BenchmarkSummary = {
  source: string;
  recordedAt: string | null;
  gitSha: string | null;
  passed: number;
  total: number;
  passRate: number;
  scores: Record<string, number>;
};

/**
 * Public status. Traffic counters, latency, and provider routing are
 * operational telemetry and live only in the token-gated metrics payload.
 */
export function buildLabStatusPayload(params: {
  llmAvailable: boolean;
  benchmarks: BenchmarkSummary | null;
}) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    status: "operational",
    timestamp: Date.now(),
    features: {
      llmReasoning: params.llmAvailable,
      offlineBenchmarks: true,
      modelInTheLoopBenchmarks: true,
    },
    benchmarks: params.benchmarks,
  };
}

/** Operator-only payload for `GET /metrics` (requires METRICS_TOKEN). */
export function buildLabMetricsPayload(params: {
  llmAvailable: boolean;
  counters: RequestCounters;
  latency: LatencySummary;
  benchmarks: BenchmarkSummary | null;
  llmRouting?: LlmRoutingSummary;
}) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    timestamp: Date.now(),
    note: "Counters and latency are measured by this Worker since the last cold start. Benchmark scores come from the last committed offline run, not from live traffic.",
    requests: params.counters,
    latency: params.latency,
    llmAvailable: params.llmAvailable,
    llmRouting:
      params.llmRouting ??
      buildLlmRoutingPayload(
        { bleujs: 0, nvidia: 0, anthropic: 0, openai: 0, local: 0, none: 0 },
        "isolate",
      ),
    benchmarks: params.benchmarks,
  };
}
