/**
 * Real Metrics Calculator
 * Computes actual metrics from system state instead of using random values
 */

import { RealLearningEngine } from './RealLearningEngine';

export interface RealMetrics {
  learningComplexity: number;
  systemDepth: number;
  adaptability: number;
  crossDomainIntegration: number;
  understandingDepth: number;
  reasoningQuality: number;
  learningEfficiency: number;
}

export class RealMetricsCalculator {
  private learningEngine: RealLearningEngine;
  private requestCount: number = 0;
  private successCount: number = 0;
  private totalProcessingTime: number = 0;
  private domainInteractions: Map<string, number> = new Map();
  private conceptConnections: Map<string, Set<string>> = new Map();

  constructor(learningEngine: RealLearningEngine) {
    this.learningEngine = learningEngine;
  }

  /**
   * Learning complexity from neural network task depth and accuracy.
   */
  calculateLearningComplexity(): number {
    const stats = this.learningEngine.getStatistics();
    // Base advantage on actual learning performance
    const baseAdvantage = stats.averageAccuracy;
    // Add complexity factor from number of tasks
    const complexityFactor = Math.min(stats.tasksLearned / 10, 0.3);
    return Math.min(0.95, baseAdvantage + complexityFactor);
  }

  /**
   * System depth from learning capability and concept knowledge.
   */
  calculateSystemDepth(): number {
    const stats = this.learningEngine.getStatistics();
    // Base depth on learning capability
    const learningDepth = stats.averageAccuracy * 0.6;
    // Add self-awareness from concept knowledge
    const conceptDepth = Math.min(stats.conceptsAcquired / 20, 0.3);
    // Add meta-awareness from task diversity
    const metaDepth = Math.min(stats.tasksLearned / 5, 0.1);
    
    return Math.min(0.95, 0.5 + learningDepth + conceptDepth + metaDepth);
  }

  /**
   * Adaptability from learning rate and concept acquisition.
   */
  calculateAdaptability(): number {
    const stats = this.learningEngine.getStatistics();
    // Plasticity based on how well system learns new tasks
    const learningPlasticity = stats.averageAccuracy * 0.7;
    // Add adaptation factor from concept acquisition rate
    const adaptationFactor = Math.min(stats.conceptsAcquired / 15, 0.2);
    
    return Math.min(0.95, learningPlasticity + adaptationFactor);
  }

  /**
   * Calculate cross-domain integration from actual concept connections
   */
  calculateCrossDomainIntegration(): number {
    // Count unique domain interactions
    const uniqueDomains = this.domainInteractions.size;
    const domainFactor = Math.min(uniqueDomains / 8, 0.4);
    
    // Count concept connections across domains
    let crossConnections = 0;
    this.conceptConnections.forEach((connections) => {
      crossConnections += connections.size;
    });
    const connectionFactor = Math.min(crossConnections / 50, 0.4);
    
    // Base integration on learning stats
    const stats = this.learningEngine.getStatistics();
    const learningFactor = stats.conceptsAcquired > 0 ? 0.2 : 0;
    
    return Math.min(0.95, domainFactor + connectionFactor + learningFactor);
  }

  /**
   * Calculate understanding depth from actual comprehension
   */
  calculateUnderstandingDepth(input: string): number {
    const stats = this.learningEngine.getStatistics();
    // Base understanding on learning capability
    const baseUnderstanding = stats.averageAccuracy * 0.5;
    
    // Add depth from input complexity analysis
    const inputComplexity = this.analyzeInputComplexity(input);
    const complexityFactor = Math.min(inputComplexity / 2, 0.3);
    
    // Add depth from concept knowledge
    const conceptFactor = Math.min(stats.conceptsAcquired / 25, 0.2);
    
    return Math.min(0.95, baseUnderstanding + complexityFactor + conceptFactor);
  }

  /**
   * Calculate reasoning quality from actual reasoning performance
   */
  calculateReasoningQuality(): number {
    if (this.requestCount === 0) return 0.7; // Default for new system
    
    const successRate = this.successCount / this.requestCount;
    const avgProcessingTime = this.totalProcessingTime / this.requestCount;
    
    // Quality based on success rate
    const successFactor = successRate * 0.6;
    // Efficiency factor (faster is better, up to a point)
    const efficiencyFactor = Math.min(1000 / Math.max(avgProcessingTime, 100), 0.3);
    
    return Math.min(0.95, successFactor + efficiencyFactor);
  }

  /**
   * Calculate learning efficiency from actual learning performance
   */
  calculateLearningEfficiency(): number {
    const stats = this.learningEngine.getStatistics();
    // Efficiency based on accuracy achieved
    const accuracyFactor = stats.averageAccuracy * 0.6;
    // Add efficiency from learning speed (tasks learned)
    const speedFactor = Math.min(stats.tasksLearned / 10, 0.3);
    
    return Math.min(0.95, accuracyFactor + speedFactor);
  }

  /**
   * Record a domain interaction for cross-domain metrics
   */
  recordDomainInteraction(domain: string): void {
    const count = this.domainInteractions.get(domain) || 0;
    this.domainInteractions.set(domain, count + 1);
  }

  /**
   * Record a concept connection for cross-domain metrics
   */
  recordConceptConnection(concept1: string, concept2: string): void {
    if (!this.conceptConnections.has(concept1)) {
      this.conceptConnections.set(concept1, new Set());
    }
    this.conceptConnections.get(concept1)!.add(concept2);
    
    // Bidirectional
    if (!this.conceptConnections.has(concept2)) {
      this.conceptConnections.set(concept2, new Set());
    }
    this.conceptConnections.get(concept2)!.add(concept1);
  }

  /**
   * Record a request for performance metrics
   */
  recordRequest(success: boolean, processingTime: number): void {
    this.requestCount++;
    if (success) this.successCount++;
    this.totalProcessingTime += processingTime;
  }

  /**
   * Analyze input complexity
   */
  private analyzeInputComplexity(input: string): number {
    // Simple complexity metrics
    const length = input.length;
    const wordCount = input.split(/\s+/).length;
    const sentenceCount = input.split(/[.!?]+/).length;
    const questionCount = (input.match(/\?/g) || []).length;
    
    // Normalize complexity (0-1 scale)
    const lengthFactor = Math.min(length / 500, 0.3);
    const wordFactor = Math.min(wordCount / 50, 0.3);
    const structureFactor = Math.min(sentenceCount / 10, 0.2);
    const questionFactor = Math.min(questionCount / 3, 0.2);
    
    return lengthFactor + wordFactor + structureFactor + questionFactor;
  }

  /**
   * Get all computed metrics
   */
  getAllMetrics(input?: string): RealMetrics {
    return {
      learningComplexity: this.calculateLearningComplexity(),
      systemDepth: this.calculateSystemDepth(),
      adaptability: this.calculateAdaptability(),
      crossDomainIntegration: this.calculateCrossDomainIntegration(),
      understandingDepth: input ? this.calculateUnderstandingDepth(input) : this.calculateSystemDepth(),
      reasoningQuality: this.calculateReasoningQuality(),
      learningEfficiency: this.calculateLearningEfficiency(),
    };
  }
}

