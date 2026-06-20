/**
 * Deterministic helpers derived from measured system state.
 */

import type { RealMetrics } from '@/core/RealMetricsCalculator';

export function analyzeInputFromMetrics(input: string, metrics: RealMetrics) {
  const lengthFactor = Math.min(input.length / 500, 1);
  return {
    complexity: lengthFactor * metrics.understandingDepth,
    semanticDepth: metrics.understandingDepth,
    contextualUnderstanding: metrics.reasoningQuality,
    processingEfficiency: metrics.learningEfficiency,
  };
}
