/**
 * Global llmRouting counters via KV (shared across worker isolates).
 */

import type { ReasonProvider } from './requestCounters';

export const KV_LLM_ROUTING_KEY = 'metrics:llmRouting';

export type LlmRoutingCounts = Record<ReasonProvider, number>;

export function emptyLlmRoutingCounts(): LlmRoutingCounts {
  return { bleujs: 0, anthropic: 0, openai: 0, local: 0, none: 0 };
}

export function buildLlmRoutingPayload(counts: LlmRoutingCounts, scope: 'global' | 'isolate') {
  const llmTotal = counts.bleujs + counts.anthropic + counts.openai;
  const fallbackTotal = counts.anthropic + counts.openai;

  return {
    ...counts,
    llmTotal,
    fallbackRate: llmTotal > 0 ? fallbackTotal / llmTotal : 0,
    scope,
  };
}

export async function readLlmRoutingFromKv(kv: KVNamespace): Promise<LlmRoutingCounts> {
  const stored = await kv.get<LlmRoutingCounts>(KV_LLM_ROUTING_KEY, 'json');
  if (!stored) {
    return emptyLlmRoutingCounts();
  }

  return {
    bleujs: stored.bleujs ?? 0,
    anthropic: stored.anthropic ?? 0,
    openai: stored.openai ?? 0,
    local: stored.local ?? 0,
    none: stored.none ?? 0,
  };
}

export async function recordLlmRoutingInKv(
  kv: KVNamespace,
  provider: ReasonProvider
): Promise<void> {
  const counts = await readLlmRoutingFromKv(kv);
  counts[provider]++;
  await kv.put(KV_LLM_ROUTING_KEY, JSON.stringify(counts));
}
