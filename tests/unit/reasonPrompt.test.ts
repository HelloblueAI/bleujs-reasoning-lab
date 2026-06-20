import {
  getReasonMaxTokens,
  getReasonSystemPrompt,
  isSimpleFactualQuestion,
} from '../../src/lab/reasonPrompt';

describe('reasonPrompt', () => {
  it('detects simple factual questions', () => {
    expect(isSimpleFactualQuestion('where is tehran')).toBe(true);
    expect(isSimpleFactualQuestion('What is the capital of France?')).toBe(true);
    expect(isSimpleFactualQuestion('explain quantum entanglement in depth')).toBe(false);
  });

  it('uses concise prompt and token limit for simple questions', () => {
    expect(getReasonSystemPrompt(true)).toMatch(/1–3 sentences/);
    expect(getReasonMaxTokens(true)).toBe(256);
    expect(getReasonMaxTokens(false)).toBe(1024);
  });
});
