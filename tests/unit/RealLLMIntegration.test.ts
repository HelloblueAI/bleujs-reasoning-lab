import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealLLMIntegration } from '../../src/core/RealLLMIntegration';

describe('RealLLMIntegration BleuJS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls BleuJS chat API first when key is set', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: 'Tehran is in Iran.' } }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const llm = new RealLLMIntegration(undefined, undefined, undefined, undefined, 'bleujs_sk_test');
    const result = await llm.answerQuestion('where is tehran', {
      systemPrompt: 'Be concise.',
      maxTokens: 256,
    });

    expect(result.answer).toBe('Tehran is in Iran.');
    expect(result.provider).toBe('bleujs');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.bleujs.org/api/v1/chat');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer bleujs_sk_test',
    });
  });

  it('is available when only BleuJS key is configured', () => {
    const llm = new RealLLMIntegration(undefined, undefined, undefined, undefined, 'bleujs_sk_test');
    expect(llm.isAvailable()).toBe(true);
    expect(llm.getAvailableModels()).toContain('bleujs-chat');
  });
});
