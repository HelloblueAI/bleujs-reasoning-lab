/**
 * Honest API payloads for the production worker — no quantum/consciousness theater.
 */

import type { RealMetrics } from '@/core/RealMetricsCalculator';
import type { CapabilityDisplayMetrics } from '@/core/CapabilityDisplayMetrics';
import type { Goal } from '@/core/AutonomousGoalSystem';
import { LAB_NAME, LAB_VERSION, buildHonestHistoryMetrics, type MlStats } from './labStatus';

export function buildLabStatusPayload(
  mlStats: MlStats,
  realMetrics: RealMetrics | null,
  capabilities: CapabilityDisplayMetrics,
  counters: { reasoning: number; learning: number; creative: number },
  llmAvailable: boolean,
  orchestratorStatus: unknown,
  tensorLogicAvailable = false
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
    status: 'operational',
    measured: true,
    timestamp: Date.now(),
    capabilities: {
      reasoningQuality: capabilities.reasoningQuality,
      systemDepth: capabilities.systemDepth,
      understandingDepth: capabilities.understandingDepth,
      adaptability: capabilities.adaptability,
      confidence: capabilities.confidence,
      sources: capabilities.sources,
    },
    features: {
      llmReasoning: llmAvailable,
      learningEngine: true,
      understandingEngine: true,
      crossDomainReasoning: true,
      tensorLogic: tensorLogicAvailable,
      autonomousGoals: true,
    },
    ml: {
      tasksLearned: mlStats.tasksLearned,
      conceptsAcquired: mlStats.conceptsAcquired,
      averageAccuracy: mlStats.averageAccuracy,
      llmAvailable,
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
    orchestrator: orchestratorStatus,
  };
}

export function buildCapabilitiesEndpointPayload(
  capabilities: CapabilityDisplayMetrics,
  mlStats: MlStats,
  goals: { active: number; completed: number; topPriorities: Goal[] } | null
) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    measured: true,
    disclaimer: 'Capability scores are derived from learning engine state — not consciousness simulation.',
    timestamp: Date.now(),
    capabilities: {
      reasoningQuality: capabilities.reasoningQuality,
      systemDepth: capabilities.systemDepth,
      understandingDepth: capabilities.understandingDepth,
      adaptability: capabilities.adaptability,
      confidence: capabilities.confidence,
      sources: capabilities.sources,
    },
    ml: {
      tasksLearned: mlStats.tasksLearned,
      conceptsAcquired: mlStats.conceptsAcquired,
      averageAccuracy: mlStats.averageAccuracy,
    },
    goals,
  };
}

export function buildHonestLearnResponse(params: {
  data: string;
  processingTimeMs: number;
  mlStats: MlStats;
  realLearning: { taskName?: string; accuracy?: number; conceptName?: string; examples?: number } | null;
  understanding: {
    concepts: number;
    relationships: number;
    domains: string[];
  } | null;
}) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    measured: true,
    inputLength: params.data.length,
    processingTimeMs: params.processingTimeMs,
    learned: params.realLearning !== null,
    realLearning: params.realLearning,
    understanding: params.understanding,
    ml: {
      tasksLearned: params.mlStats.tasksLearned,
      conceptsAcquired: params.mlStats.conceptsAcquired,
      averageAccuracy: params.mlStats.averageAccuracy,
    },
  };
}

export function buildHonestCreateResponse(params: {
  prompt: string;
  processingTimeMs: number;
  understanding: {
    concepts: number;
    relationships: number;
    domains: string[];
    confidence: number;
  } | null;
  crossDomainInsights: { insight: string; confidence: number; novelty: number }[];
}) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    measured: true,
    prompt: params.prompt,
    processingTimeMs: params.processingTimeMs,
    note: 'Creative output requires LLM integration via POST /reason until a dedicated creative model is wired.',
    understanding: params.understanding,
    crossDomainInsights: params.crossDomainInsights.slice(0, 5),
  };
}

export const CONSCIOUSNESS_DEPRECATED = {
  success: false,
  deprecated: true,
  redirect: '/capabilities',
  message: 'GET /consciousness removed. Use GET /capabilities or GET /metrics for measured lab state.',
};
