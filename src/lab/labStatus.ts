/**
 * Honest status payloads for the BleuJS Autonomous Reasoning Lab.
 */

import type { RealMetrics } from '@/core/RealMetricsCalculator';
import type { CapabilityDisplayMetrics } from '@/core/CapabilityDisplayMetrics';
import type { Goal } from '@/core/AutonomousGoalSystem';

export const LAB_VERSION = '5.1.0';
/** Public product name (API + dashboard) */
export const LAB_NAME = 'BleuJS Reasoning';
/** Internal project name — used in docs and repo */
export const LAB_PROJECT_NAME = 'BleuJS Autonomous Reasoning Lab';

export type MlStats = {
  tasksLearned: number;
  conceptsAcquired: number;
  averageAccuracy: number;
};

export function buildHonestHistoryMetrics(
  mlStats: MlStats,
  counters: { reasoning: number; learning: number; creative: number }
) {
  return {
    knowledgeBaseSize: mlStats.conceptsAcquired,
    reasoningHistorySize: counters.reasoning,
    learningHistorySize: counters.learning + mlStats.tasksLearned,
    creativeHistorySize: counters.creative,
  };
}

export function buildLabMetricsPayload(
  mlStats: MlStats,
  realMetrics: RealMetrics | null,
  capabilities: CapabilityDisplayMetrics,
  counters: { reasoning: number; learning: number; creative: number },
  llmAvailable: boolean,
  goals: { active: number; completed: number; topPriorities: Goal[] } | null,
  llmRouting?: {
    bleujs: number;
    anthropic: number;
    openai: number;
    local: number;
    none: number;
    llmTotal: number;
    fallbackRate: number;
  }
) {
  const metrics = realMetrics ?? {
    learningComplexity: mlStats.averageAccuracy,
    systemDepth: capabilities.systemDepth,
    adaptability: capabilities.adaptability,
    crossDomainIntegration: 0.5,
    understandingDepth: capabilities.understandingDepth,
    reasoningQuality: capabilities.reasoningQuality,
    learningEfficiency: capabilities.confidence,
  };

  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    measured: true,
    disclaimer:
      'Metrics are derived from learning engine state and request performance — not simulated values.',
    timestamp: Date.now(),
    ml: {
      tasksLearned: mlStats.tasksLearned,
      conceptsAcquired: mlStats.conceptsAcquired,
      averageAccuracy: mlStats.averageAccuracy,
      llmAvailable,
    },
    capabilities: {
      reasoningQuality: capabilities.reasoningQuality,
      systemDepth: capabilities.systemDepth,
      understandingDepth: capabilities.understandingDepth,
      adaptability: capabilities.adaptability,
      confidence: capabilities.confidence,
      sources: capabilities.sources,
    },
    performance: {
      reasoningQuality: metrics.reasoningQuality,
      learningEfficiency: metrics.learningEfficiency,
      crossDomainIntegration: metrics.crossDomainIntegration,
      adaptability: metrics.adaptability,
      learningComplexity: metrics.learningComplexity,
      systemDepth: metrics.systemDepth,
    },
    history: buildHonestHistoryMetrics(mlStats, counters),
    llmRouting: {
      ...(llmRouting ?? {
        bleujs: 0,
        anthropic: 0,
        openai: 0,
        local: 0,
        none: 0,
        llmTotal: 0,
        fallbackRate: 0,
      }),
      scope: 'isolate' as const,
    },
    goals,
  };
}
