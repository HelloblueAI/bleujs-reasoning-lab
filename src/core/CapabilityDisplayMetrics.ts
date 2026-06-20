import type { RealMetrics } from './RealMetricsCalculator';

export type CapabilityMetricSources = {
  reasoningQuality: string;
  systemDepth: string;
  understandingDepth: string;
  adaptability: string;
};

export type CapabilityDisplayMetrics = {
  reasoningQuality: number;
  systemDepth: number;
  understandingDepth: number;
  adaptability: number;
  confidence: number;
  sources: CapabilityMetricSources;
};

type MlStats = {
  tasksLearned: number;
  conceptsAcquired: number;
  averageAccuracy: number;
};

function clampMetric(value: number): number {
  return Math.min(0.95, Math.max(0, value));
}

/** Derive dashboard capability scores from learning engine state and request performance. */
export function buildCapabilityDisplayMetrics(
  realMetrics: RealMetrics | null,
  mlStats: MlStats
): CapabilityDisplayMetrics {
  if (realMetrics) {
    return {
      reasoningQuality: clampMetric(realMetrics.reasoningQuality),
      systemDepth: clampMetric(realMetrics.systemDepth),
      understandingDepth: clampMetric(realMetrics.understandingDepth),
      adaptability: clampMetric(realMetrics.adaptability),
      confidence: clampMetric(realMetrics.learningEfficiency),
      sources: {
        reasoningQuality: 'Request success & latency',
        systemDepth: 'Learning depth & concepts',
        understandingDepth: 'Comprehension & concepts',
        adaptability: 'Learning adaptability',
      },
    };
  }

  const taskFactor = Math.min(mlStats.tasksLearned / 10, 0.15);
  const conceptFactor = Math.min(mlStats.conceptsAcquired / 20, 0.15);
  const acc = mlStats.averageAccuracy;

  return {
    reasoningQuality: clampMetric(acc * 0.85 + conceptFactor),
    systemDepth: clampMetric(0.5 + acc * 0.3 + taskFactor),
    understandingDepth: clampMetric(acc * 0.7 + conceptFactor + taskFactor),
    adaptability: clampMetric(acc * 0.6 + taskFactor * 2),
    confidence: clampMetric(acc),
    sources: {
      reasoningQuality: 'Learning engine',
      systemDepth: 'Learning engine',
      understandingDepth: 'Learning engine',
      adaptability: 'Learning engine',
    },
  };
}

/** @deprecated Use buildCapabilityDisplayMetrics */
export const buildConsciousnessDisplayMetrics = buildCapabilityDisplayMetrics;
