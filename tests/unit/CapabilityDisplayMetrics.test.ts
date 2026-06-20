import { buildCapabilityDisplayMetrics } from '../../src/core/CapabilityDisplayMetrics';

describe('CapabilityDisplayMetrics', () => {
  const mlStats = { tasksLearned: 2, conceptsAcquired: 5, averageAccuracy: 0.9 };

  it('maps real metrics without hardcoded baselines', () => {
    const result = buildCapabilityDisplayMetrics(
      {
        learningComplexity: 0.8,
        systemDepth: 0.76,
        adaptability: 0.81,
        crossDomainIntegration: 0.55,
        understandingDepth: 0.72,
        reasoningQuality: 0.68,
        learningEfficiency: 0.74,
      },
      mlStats
    );

    expect(result.reasoningQuality).toBe(0.68);
    expect(result.systemDepth).toBe(0.76);
    expect(result.understandingDepth).toBe(0.72);
    expect(result.adaptability).toBe(0.81);
    expect(result.confidence).toBe(0.74);
    expect(result.sources.reasoningQuality).toContain('Request');
  });

  it('derives from ML stats when calculator is unavailable', () => {
    const result = buildCapabilityDisplayMetrics(null, mlStats);
    expect(result.reasoningQuality).toBeGreaterThan(0);
    expect(result.reasoningQuality).toBeLessThanOrEqual(0.95);
    expect(result.sources.systemDepth).toBe('Learning engine');
  });
});
