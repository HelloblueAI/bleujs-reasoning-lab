/** Process-scoped request counters and latency samples for the Worker. */

import type { LLMProvider } from "@/routing/RealLLMIntegration";
import { buildLlmRoutingPayload } from "@/routing/llmRoutingMetrics";

/**
 * Latency samples are kept in a bounded ring buffer. Workers isolates are
 * recycled frequently, so these percentiles describe recent traffic on one
 * isolate — they are not a global SLO. `/metrics` says so explicitly.
 */
const MAX_LATENCY_SAMPLES = 512;

let reasoningCount = 0;
let evalCount = 0;
let latencySamples: number[] = [];

export type ReasonProvider = LLMProvider | "local" | "none";

export type RequestCounters = {
  reasoning: number;
  eval: number;
};

export type LatencySummary = {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

const llmProviderCounts: Record<ReasonProvider, number> = {
  bleujs: 0,
  nvidia: 0,
  anthropic: 0,
  openai: 0,
  local: 0,
  none: 0,
};

export function incrementReasoning(): void {
  reasoningCount++;
}

export function incrementEval(): void {
  evalCount++;
}

export function recordLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  latencySamples.push(ms);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.shift();
  }
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.floor(fraction * sorted.length),
  );
  return sorted[index]!;
}

export function getLatencySummary(): LatencySummary {
  if (latencySamples.length === 0) {
    return { count: 0, p50Ms: null, p95Ms: null, maxMs: null };
  }
  const sorted = [...latencySamples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1]!,
  };
}

export function recordReasonProvider(provider: ReasonProvider): void {
  llmProviderCounts[provider]++;
}

export function getRequestCounters(): RequestCounters {
  return { reasoning: reasoningCount, eval: evalCount };
}

export function getLlmProviderCounters() {
  const { bleujs, nvidia, anthropic, openai, local, none } = llmProviderCounts;
  return buildLlmRoutingPayload(
    { bleujs, nvidia, anthropic, openai, local, none },
    "isolate",
  );
}

/** @internal Test helper */
export function resetRequestCountersForTests(): void {
  reasoningCount = 0;
  evalCount = 0;
  latencySamples = [];
  for (const key of Object.keys(llmProviderCounts) as ReasonProvider[]) {
    llmProviderCounts[key] = 0;
  }
}
