import { runEvalSuite } from '../../src/eval/runner';
import { solveBleuLabPuzzle } from '../../src/eval/logicPuzzle';
import { EVAL_TASKS } from '../../src/eval/tasks';

describe('Bleu Lab logic puzzle', () => {
  it('has a unique satisfying assignment', () => {
    const result = solveBleuLabPuzzle();

    expect(result.solved).toBe(true);
    expect(result.assignment).toEqual({
      Alpha: 'Orchestration',
      Beta: 'Reasoning',
      Gamma: 'Understanding',
    });
    expect(result.steps.some((s) => s.startsWith('Clue '))).toBe(true);
  });
});

describe('Autonomous Reasoning Lab eval suite', () => {
  it('defines eval tasks', () => {
    expect(EVAL_TASKS.length).toBeGreaterThanOrEqual(6);
    expect(EVAL_TASKS.some((t) => t.id === 'xor-learning')).toBe(true);
    expect(EVAL_TASKS.some((t) => t.id === 'logic-puzzle')).toBe(true);
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

    const puzzle = result.results.find((r) => r.id === 'logic-puzzle');
    expect(puzzle?.passed).toBe(true);
    expect(puzzle?.skipped).toBeFalsy();
    expect(puzzle?.message).toContain('Beta→Reasoning');
  }, 30_000);
});
