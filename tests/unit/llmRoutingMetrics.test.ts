import { describe, expect, it } from 'vitest';
import {
  buildLlmRoutingPayload,
  emptyLlmRoutingCounts,
  readLlmRoutingFromKv,
  recordLlmRoutingInKv,
} from '@/lab/llmRoutingMetrics';

function createMockKv(initial?: Record<string, string>) {
  const store = new Map(Object.entries(initial ?? {}));

  return {
    get: async (key: string, type?: string) => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

describe('llmRoutingMetrics', () => {
  it('builds fallbackRate from counts', () => {
    const payload = buildLlmRoutingPayload(
      { bleujs: 3, anthropic: 1, openai: 0, local: 2, none: 0 },
      'global'
    );

    expect(payload).toMatchObject({
      llmTotal: 4,
      fallbackRate: 0.25,
      scope: 'global',
    });
  });

  it('persists provider counts in KV', async () => {
    const kv = createMockKv();
    await recordLlmRoutingInKv(kv, 'bleujs');
    await recordLlmRoutingInKv(kv, 'anthropic');

    const counts = await readLlmRoutingFromKv(kv);
    expect(counts).toEqual({
      ...emptyLlmRoutingCounts(),
      bleujs: 1,
      anthropic: 1,
    });
  });
});
