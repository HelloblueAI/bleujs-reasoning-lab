import { runEvalSuite } from '../../src/eval/runner';
import { EVAL_TASKS } from '../../src/eval/tasks';

describe('Autonomous Reasoning Lab eval suite', () => {
  it('defines eval tasks', () => {
    expect(EVAL_TASKS.length).toBeGreaterThanOrEqual(6);
    expect(EVAL_TASKS.some((t) => t.id === 'xor-learning')).toBe(true);
  });

  it('runs offline eval tasks without LLM', async () => {
    const result = await runEvalSuite(false);

    expect(result.total).toBe(EVAL_TASKS.length);
    expect(result.passRate).toBeGreaterThanOrEqual(0);
    expect(result.results.every((r) => r.id && typeof r.passed === 'boolean')).toBe(true);

    const xor = result.results.find((r) => r.id === 'xor-learning');
    expect(xor?.passed).toBe(true);

    const concepts = result.results.find((r) => r.id === 'concept-extraction');
    expect(concepts?.passed).toBe(true);

    const goals = result.results.find((r) => r.id === 'autonomous-goals');
    expect(goals?.passed).toBe(true);

    const tools = result.results.find((r) => r.id === 'tool-detection');
    expect(tools?.passed).toBe(true);
  }, 30_000);
});
