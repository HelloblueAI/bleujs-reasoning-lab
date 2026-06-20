/**
 * Prompt selection for /reason LLM calls.
 */

const SIMPLE_FACTUAL =
  /^(where|what|who|when|how many|how much)\s+(is|are|was|were|do|does|did)\b/i;

export function isSimpleFactualQuestion(input: string): boolean {
  const text = input.trim();
  return SIMPLE_FACTUAL.test(text) || /^(define|what'?s)\s+/i.test(text);
}

export function getReasonSystemPrompt(simple: boolean): string {
  if (simple) {
    return (
      'You are BleuJS Reasoning. Answer directly in 1–3 sentences unless the user asks for detail. ' +
      'No markdown headers or bullet lists for short factual questions.'
    );
  }
  return 'You are BleuJS Reasoning. Provide clear, accurate, thoughtful responses.';
}

export function getReasonMaxTokens(simple: boolean): number {
  return simple ? 256 : 1024;
}
