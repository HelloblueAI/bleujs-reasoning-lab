/** Process-scoped request counters for honest history metrics on Workers. */

import type { LLMProvider } from '../core/RealLLMIntegration';

let reasoningCount = 0;
let learningCount = 0;
let creativeCount = 0;

export type ReasonProvider = LLMProvider | 'local' | 'none';

const llmProviderCounts: Record<ReasonProvider, number> = {
  bleujs: 0,
  anthropic: 0,
  openai: 0,
  local: 0,
  none: 0,
};

export function incrementReasoning(): void {
  reasoningCount++;
}

export function incrementLearning(): void {
  learningCount++;
}

export function incrementCreative(): void {
  creativeCount++;
}

export function recordReasonProvider(provider: ReasonProvider): void {
  llmProviderCounts[provider]++;
}

export function getRequestCounters(): { reasoning: number; learning: number; creative: number } {
  return { reasoning: reasoningCount, learning: learningCount, creative: creativeCount };
}

export function getLlmProviderCounters() {
  const { bleujs, anthropic, openai, local, none } = llmProviderCounts;
  const llmTotal = bleujs + anthropic + openai;
  const fallbackTotal = anthropic + openai;

  return {
    bleujs,
    anthropic,
    openai,
    local,
    none,
    llmTotal,
    /** Share of LLM-backed /reason calls that used Anthropic or OpenAI instead of BleuJS. */
    fallbackRate: llmTotal > 0 ? fallbackTotal / llmTotal : 0,
  };
}

/** @internal Test helper */
export function resetRequestCountersForTests(): void {
  reasoningCount = 0;
  learningCount = 0;
  creativeCount = 0;
  for (const key of Object.keys(llmProviderCounts) as ReasonProvider[]) {
    llmProviderCounts[key] = 0;
  }
}
