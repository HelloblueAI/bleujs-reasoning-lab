/** Process-scoped request counters for honest history metrics on Workers. */

let reasoningCount = 0;
let learningCount = 0;
let creativeCount = 0;

export function incrementReasoning(): void {
  reasoningCount++;
}

export function incrementLearning(): void {
  learningCount++;
}

export function incrementCreative(): void {
  creativeCount++;
}

export function getRequestCounters(): { reasoning: number; learning: number; creative: number } {
  return { reasoning: reasoningCount, learning: learningCount, creative: creativeCount };
}
