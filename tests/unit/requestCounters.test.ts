import { describe, expect, it, beforeEach } from 'vitest';
import {
  getLlmProviderCounters,
  recordReasonProvider,
  resetRequestCountersForTests,
} from '@/lab/requestCounters';

describe('requestCounters llmRouting', () => {
  beforeEach(() => {
    resetRequestCountersForTests();
  });

  it('tracks provider hits', () => {
    recordReasonProvider('bleujs');
    recordReasonProvider('bleujs');
    recordReasonProvider('anthropic');

    expect(getLlmProviderCounters()).toMatchObject({
      bleujs: 2,
      anthropic: 1,
      openai: 0,
      local: 0,
      none: 0,
      llmTotal: 3,
    });
  });

  it('computes fallbackRate as non-bleujs share of llm calls', () => {
    recordReasonProvider('bleujs');
    recordReasonProvider('anthropic');
    recordReasonProvider('openai');

    expect(getLlmProviderCounters().fallbackRate).toBeCloseTo(2 / 3);
  });

  it('returns zero fallbackRate when no llm calls recorded', () => {
    recordReasonProvider('local');
    expect(getLlmProviderCounters().fallbackRate).toBe(0);
  });
});
