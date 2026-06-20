/**
 * Hybrid Reasoning Worker — BleuJS Reasoning (production dashboard + API)
 */

import { RealLearningEngine } from './core/RealLearningEngine';
import { RealLLMIntegration } from './core/RealLLMIntegration';
import { RealReasoningEngine } from './core/RealReasoningEngine';
import { UltimateAGIOrchestrator } from './core/UltimateAGIOrchestrator';
import { RealMetricsCalculator } from './core/RealMetricsCalculator';
import { buildCapabilityDisplayMetrics } from './core/CapabilityDisplayMetrics';
import { RealUnderstandingEngine } from './core/RealUnderstandingEngine';
import { CrossDomainReasoningEngine } from './core/CrossDomainReasoningEngine';
import { AutonomousGoalSystem } from './core/AutonomousGoalSystem';
import { ReasoningEngine } from './core/ReasoningEngine';
import { runEvalSuite } from './eval/runner';
import {
  buildCapabilitiesEndpointPayload,
  buildConsciousnessCompatPayload,
  buildHonestCreateResponse,
  buildHonestLearnResponse,
  buildLabStatusPayload,
  withLegacyStatusShims,
} from './lab/endpointResponses';
import {
  buildLabMetricsPayload,
  LAB_NAME,
  LAB_VERSION,
} from './lab/labStatus';
import { buildHonestReasonResponse } from './lab/reasonResponse';
import { stripMarkdownEmphasis, tryArithmeticReason } from './lab/arithmeticReason';
import { getReasonMaxTokens, getReasonSystemPrompt, isSimpleFactualQuestion } from './lab/reasonPrompt';
import {
  getLlmProviderCounters,
  getRequestCounters,
  incrementCreative,
  incrementLearning,
  incrementReasoning,
  recordReasonProvider,
} from './lab/requestCounters';

/** Structured log for Workers Observability (JSON parseable). */
function logEvent(level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>): void {
  const payload = { level, message, ts: Date.now(), ...extra };
  const out = JSON.stringify(payload);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

// Process-scoped stateless engines (no request data stored here)
let learningEngine: RealLearningEngine | null = null;
let llmIntegration: RealLLMIntegration | null = null;
let reasoningEngine: RealReasoningEngine | null = null;
let ultimateOrchestrator: UltimateAGIOrchestrator | null = null;
let metricsCalculator: RealMetricsCalculator | null = null;
let understandingEngine: RealUnderstandingEngine | null = null;
let crossDomainEngine: CrossDomainReasoningEngine | null = null;
let goalSystem: AutonomousGoalSystem | null = null;
let tensorReasoningEngine: ReasoningEngine | null = null;

/** Env: secrets via wrangler secret put; optional AGI_CACHE KV binding for response cache. Run `wrangler types` to sync with config. */
interface Env {
  BLEUJS_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ENVIRONMENT?: string;
  AGI_CACHE?: KVNamespace;
}

// Helper function to validate and sanitize input
function validateInput(input: string, maxLength: number = 10000): { valid: boolean; sanitized?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Input must be a non-empty string' };
  }
  
  if (input.length > maxLength) {
    return { valid: false, error: `Input exceeds maximum length of ${maxLength} characters` };
  }
  
  // Basic sanitization - remove potentially dangerous characters
  const sanitized = input.trim().slice(0, maxLength);
  
  return { valid: true, sanitized };
}

// Helper function to safely initialize systems with error handling
async function safeInitializeSystems(env: Env): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Initialize learning engine (no API keys required)
    if (!learningEngine) {
      learningEngine = new RealLearningEngine();
      await learningEngine.learnTask('xor', [
        { input: [0, 0], output: [1, 0] },
        { input: [0, 1], output: [0, 1] },
        { input: [1, 0], output: [0, 1] },
        { input: [1, 1], output: [1, 0] }
      ]);
      console.log('✓ Real Learning Engine initialized');
    }
    
    // Initialize metrics calculator (depends on learning engine)
    if (!metricsCalculator && learningEngine) {
      metricsCalculator = new RealMetricsCalculator(learningEngine);
      console.log('✓ Real Metrics Calculator initialized');
    }
    
    // Initialize understanding engine
    if (!understandingEngine) {
      understandingEngine = new RealUnderstandingEngine();
      console.log('✓ Real Understanding Engine initialized');
    }
    
    // Initialize cross-domain reasoning engine (depends on understanding engine)
    if (!crossDomainEngine && understandingEngine) {
      crossDomainEngine = new CrossDomainReasoningEngine(understandingEngine);
      console.log('✓ Cross-Domain Reasoning Engine initialized');
    }
    
    // Initialize autonomous goal system
    if (!goalSystem) {
      goalSystem = new AutonomousGoalSystem();
      console.log('✓ Autonomous Goal System initialized');
    }
    
    // Initialize Tensor Logic Engine (no API keys required)
    if (!tensorReasoningEngine) {
      try {
        tensorReasoningEngine = new ReasoningEngine();
        await tensorReasoningEngine.initialize();
        console.log('✓ Tensor Logic Engine initialized');
      } catch (error) {
        errors.push(`Tensor Logic Engine initialization failed: ${(error as Error).message}`);
        console.warn('Tensor Logic Engine unavailable:', error);
      }
    }
  } catch (error) {
    errors.push(`Learning engine initialization failed: ${(error as Error).message}`);
    console.error('Learning engine initialization error:', error);
  }
  
  const hasLlmKey = !!(env.BLEUJS_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);

  // Initialize LLM integration (BleuJS primary, Anthropic/OpenAI fallback)
  if (!llmIntegration && hasLlmKey) {
    try {
      llmIntegration = new RealLLMIntegration(
        env.ANTHROPIC_API_KEY,
        env.OPENAI_API_KEY,
        undefined,
        undefined,
        env.BLEUJS_API_KEY
      );
      console.log('✓ Real LLM Integration initialized (BleuJS + fallback)');
    } catch (error) {
      errors.push(`LLM integration initialization failed: ${(error as Error).message}`);
      console.warn('LLM integration unavailable:', error);
    }
  } else if (!hasLlmKey) {
    console.warn('⚠ LLM integration disabled: API keys not configured');
  }
  
  // Initialize reasoning engine (requires API keys)
  if (!reasoningEngine && (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY)) {
    try {
      reasoningEngine = new RealReasoningEngine(env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY);
      console.log('✓ Real Reasoning Engine initialized');
    } catch (error) {
      errors.push(`Reasoning engine initialization failed: ${(error as Error).message}`);
      console.warn('Reasoning engine unavailable:', error);
    }
  }
  
  // Initialize Ultimate Orchestrator (requires API keys)
  if (!ultimateOrchestrator && (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY)) {
    try {
      ultimateOrchestrator = new UltimateAGIOrchestrator(env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY);
      await ultimateOrchestrator.initialize();
      console.log('✓ Hybrid reasoning orchestrator initialized');
    } catch (error) {
      errors.push(`Ultimate orchestrator initialization failed: ${(error as Error).message}`);
      console.warn('Ultimate orchestrator unavailable:', error);
    }
  }
  
  return { success: errors.length === 0, errors };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Enhanced headers with security and performance
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    
    const htmlHeaders = {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check endpoint (lightweight, no initialization required)
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        system: LAB_NAME,
        timestamp: Date.now(),
        version: LAB_VERSION
      }), { headers: corsHeaders });
    }
    
    try {
      // Initialize systems with error handling
      const initResult = await safeInitializeSystems(env);
      
      if (initResult.errors.length > 0) {
        logEvent('warn', 'init_partial', { errors: initResult.errors, path });
      }
      
      const mlStats = learningEngine.getStatistics();
      const realMetricsForDisplay = metricsCalculator ? metricsCalculator.getAllMetrics() : null;
      const capabilityDisplay = buildCapabilityDisplayMetrics(realMetricsForDisplay, mlStats);
      const counters = getRequestCounters();
      
      if (path === '/status' && request.method === 'GET') {
        const cacheKey = 'agi:status';
        const cached = env.AGI_CACHE ? await env.AGI_CACHE.get(cacheKey) : null;
        if (cached) {
          logEvent('info', 'cache_hit', { path: '/status' });
          return new Response(cached, { headers: corsHeaders });
        }
        const statusBody = JSON.stringify({
          success: true,
          data: withLegacyStatusShims(
            buildLabStatusPayload(
              mlStats,
              realMetricsForDisplay,
              capabilityDisplay,
              counters,
              llmIntegration ? llmIntegration.isAvailable() : false,
              ultimateOrchestrator ? ultimateOrchestrator.getStatus() : null,
              tensorReasoningEngine !== null
            )
          ),
        });
        if (env.AGI_CACHE) {
          ctx.waitUntil(env.AGI_CACHE.put(cacheKey, statusBody, { expirationTtl: 60 }));
        }
        return new Response(statusBody, { headers: corsHeaders });
      }

      if (path === '/consciousness' && request.method === 'GET') {
        const cacheKey = 'agi:consciousness-compat';
        const cached = env.AGI_CACHE ? await env.AGI_CACHE.get(cacheKey) : null;
        if (cached) {
          return new Response(cached, { headers: corsHeaders });
        }
        const goalSummary = goalSystem
          ? {
              active: goalSystem.getStatistics().active,
              completed: goalSystem.getStatistics().completed,
              topPriorities: goalSystem.getStatistics().topPriorities,
            }
          : null;
        const body = JSON.stringify({
          success: true,
          data: buildConsciousnessCompatPayload(capabilityDisplay, mlStats, goalSummary),
        });
        if (env.AGI_CACHE) {
          ctx.waitUntil(env.AGI_CACHE.put(cacheKey, body, { expirationTtl: 60 }));
        }
        return new Response(body, { headers: corsHeaders });
      }

      if (path === '/capabilities' && request.method === 'GET') {
        const cacheKey = 'agi:capabilities';
        const cached = env.AGI_CACHE ? await env.AGI_CACHE.get(cacheKey) : null;
        if (cached) {
          logEvent('info', 'cache_hit', { path: '/capabilities' });
          return new Response(cached, { headers: corsHeaders });
        }
        const goalSummary = goalSystem
          ? {
              active: goalSystem.getStatistics().active,
              completed: goalSystem.getStatistics().completed,
              topPriorities: goalSystem.getStatistics().topPriorities,
            }
          : null;
        const body = JSON.stringify({
          success: true,
          data: buildCapabilitiesEndpointPayload(capabilityDisplay, mlStats, goalSummary),
        });
        if (env.AGI_CACHE) {
          ctx.waitUntil(env.AGI_CACHE.put(cacheKey, body, { expirationTtl: 60 }));
        }
        return new Response(body, { headers: corsHeaders });
      }

      if (path === '/metrics' && request.method === 'GET') {
        const goalSummary = goalSystem
          ? {
              active: goalSystem.getStatistics().active,
              completed: goalSystem.getStatistics().completed,
              topPriorities: goalSystem.getStatistics().topPriorities,
            }
          : null;
        const metricsBody = JSON.stringify({
          success: true,
          data: buildLabMetricsPayload(
            mlStats,
            realMetricsForDisplay,
            capabilityDisplay,
            counters,
            llmIntegration ? llmIntegration.isAvailable() : false,
            goalSummary,
            getLlmProviderCounters()
          ),
        });
        return new Response(metricsBody, { headers: corsHeaders });
      }

      if (path === '/eval' && request.method === 'GET') {
        const evalResult = await runEvalSuite(llmIntegration ? llmIntegration.isAvailable() : false);
        return new Response(
          JSON.stringify({ success: true, data: evalResult }),
          { headers: corsHeaders }
        );
      }

      if (path === '/goals' && request.method === 'GET') {
        if (!goalSystem) {
          return new Response(
            JSON.stringify({ success: false, error: 'Goal system not initialized' }),
            { status: 503, headers: corsHeaders }
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              active: goalSystem.getActiveGoals(),
              statistics: goalSystem.getStatistics(),
            },
          }),
          { headers: corsHeaders }
        );
      }
      
      if (path === '/reason' && request.method === 'POST') {
        // Validate request size (limit to 1MB)
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Request body too large. Maximum size is 1MB.'
          }), {
            status: 413,
            headers: corsHeaders
          });
        }
        
        let body;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const rawInput = body.input || '';
        const inputValidation = validateInput(rawInput, 10000);
        
        if (!inputValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: inputValidation.error || 'Invalid input'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const input = inputValidation.sanitized!;
        const startTime = Date.now();
        
        // Use REAL understanding engine to extract genuine understanding
        let understanding = null;
        try {
          understanding = understandingEngine ? understandingEngine.understand(input) : null;
        } catch (e) {
          console.error('Understanding engine error:', e);
        }
        
        let realMetrics = {
          learningComplexity: 0.7,
          systemDepth: 0.7,
          adaptability: 0.7,
          crossDomainIntegration: 0.5,
          understandingDepth: 0.7,
          reasoningQuality: 0.7,
          learningEfficiency: 0.7,
        };
        try {
          if (metricsCalculator) {
            realMetrics = metricsCalculator.getAllMetrics(input);
          }
        } catch (e) {
          console.error('Metrics calculator error:', e);
        }

        if (understanding && metricsCalculator) {
          understanding.domains.forEach(domain => {
            metricsCalculator!.recordDomainInteraction(domain);
          });
          for (let i = 0; i < understanding.concepts.length; i++) {
            for (let j = i + 1; j < understanding.concepts.length; j++) {
              metricsCalculator!.recordConceptConnection(
                understanding.concepts[i].name,
                understanding.concepts[j].name
              );
            }
          }
        }

        const localArithmetic = tryArithmeticReason(input);

        let llmEnhancement: {
          insight: string;
          confidence: number;
          provider?: 'bleujs' | 'anthropic' | 'openai';
        } | null = null;
        if (localArithmetic) {
          llmEnhancement = {
            insight: localArithmetic.answer,
            confidence: localArithmetic.confidence,
          };
        } else if (llmIntegration && llmIntegration.isAvailable()) {
          try {
            const simpleFactual = isSimpleFactualQuestion(input);
            const llmResponse = await llmIntegration.answerQuestion(input, {
              systemPrompt: getReasonSystemPrompt(simpleFactual),
              maxTokens: getReasonMaxTokens(simpleFactual),
            });
            llmEnhancement = {
              insight: stripMarkdownEmphasis(llmResponse.answer),
              confidence: llmResponse.confidence,
              provider: llmResponse.provider,
            };
          } catch (error) {
            console.error('LLM enhancement unavailable:', error);
          }
        }

        const processingTimeMs = Date.now() - startTime;
        if (metricsCalculator) {
          try {
            metricsCalculator.recordRequest(true, processingTimeMs);
          } catch (e) {
            console.error('Metrics recording error:', e);
          }
        }
        incrementReasoning();
        if (localArithmetic) {
          recordReasonProvider('local');
        } else if (llmEnhancement?.provider === 'bleujs') {
          recordReasonProvider('bleujs');
        } else if (llmEnhancement?.provider === 'anthropic') {
          recordReasonProvider('anthropic');
        } else if (llmEnhancement?.provider === 'openai') {
          recordReasonProvider('openai');
        } else {
          recordReasonProvider('none');
        }

        const honestData = buildHonestReasonResponse({
          input,
          answer: llmEnhancement?.insight ?? null,
          confidence: llmEnhancement?.confidence ?? realMetrics.reasoningQuality,
          llmUsed: !localArithmetic && llmEnhancement !== null,
          llmProvider: localArithmetic ? null : (llmEnhancement?.provider ?? null),
          processingTimeMs,
          understanding: understanding
            ? {
                concepts: understanding.concepts,
                domains: understanding.domains,
                relationships: understanding.relationships,
                insights: understanding.insights,
              }
            : null,
        });

        return new Response(JSON.stringify({ success: true, data: honestData }), {
          headers: corsHeaders,
        });
      }
      
      // Tensor Logic reasoning endpoint
      if (path === '/tensor-reason' && request.method === 'POST') {
        // Validate request size
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Request body too large. Maximum size is 1MB.'
          }), {
            status: 413,
            headers: corsHeaders
          });
        }
        
        let body;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const rawInput = body.input || '';
        const inputValidation = validateInput(rawInput, 10000);
        
        if (!inputValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: inputValidation.error || 'Invalid input'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const input = inputValidation.sanitized!;
        const startTime = Date.now();
        
        try {
          if (!tensorReasoningEngine) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Tensor Logic Engine not initialized'
            }), {
              status: 503,
              headers: corsHeaders
            });
          }
          
          // Perform tensor logic reasoning with error handling
          let tensorResult;
          try {
            tensorResult = await tensorReasoningEngine.reason(input, body.context || {});
          } catch (reasoningError) {
            console.error('Reasoning error:', reasoningError);
            // Return a fallback result if reasoning fails
            tensorResult = {
              confidence: 0.5,
              reasoning: {
                steps: [],
                logic: 'tensor',
                evidence: [],
                assumptions: []
              },
              conclusions: [{
                id: 'fallback',
                statement: `Processed input: ${input.substring(0, 100)}`,
                confidence: 0.5,
                evidence: [],
                reasoning: 'Tensor logic processing',
                implications: []
              }],
              uncertainty: {
                type: 'probabilistic',
                parameters: {},
                confidence: 0.5
              },
              alternatives: []
            };
          }
          
          const processingTime = Date.now() - startTime;
          
          // Safely extract result properties with defaults
          const confidence = tensorResult?.confidence ?? 0.5;
          const reasoning = tensorResult?.reasoning ?? {};
          const conclusions = tensorResult?.conclusions ?? [];
          const uncertainty = tensorResult?.uncertainty ?? { type: 'unknown', confidence: 0.5 };
          const alternatives = tensorResult?.alternatives ?? [];
          
          // Check if result includes tensor-specific information
          const tensorResultAny = tensorResult as any;
          const hasTensorData = tensorResultAny?.tensorOperations || 
                                tensorResultAny?.embeddingSpace ||
                                tensorResultAny?.unifiedRepresentation ||
                                tensorResultAny?.neuralSymbolicFusion !== undefined;
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              system: 'Tensor Logic Engine',
              version: '1.0.0',
              method: 'tensor_logic',
              timestamp: Date.now(),
              processingTime: `${processingTime}ms`,
              reasoning: {
                confidence: confidence,
                logic: reasoning?.logic || 'tensor',
                steps: reasoning?.steps || [],
                evidence: reasoning?.evidence || [],
                assumptions: reasoning?.assumptions || []
              },
              conclusions: conclusions,
              uncertainty: uncertainty,
              alternatives: alternatives,
              // Tensor-specific data if available
              ...(hasTensorData && {
                tensorOperations: tensorResultAny?.tensorOperations?.length || 0,
                embeddingSpace: tensorResultAny?.embeddingSpace?.length || 0,
                unifiedRepresentation: tensorResultAny?.unifiedRepresentation ? {
                  rank: tensorResultAny.unifiedRepresentation?.rank || 0,
                  shape: tensorResultAny.unifiedRepresentation?.shape || []
                } : null,
                neuralSymbolicFusion: tensorResultAny?.neuralSymbolicFusion || 0
              }),
              input: input.substring(0, 200) // Truncate for response
            }
          }), { headers: corsHeaders });
        } catch (error) {
          console.error('Tensor Logic reasoning error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Tensor Logic reasoning failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      
      if (path === '/learn' && request.method === 'POST') {
        // Validate request size
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Request body too large. Maximum size is 1MB.'
          }), {
            status: 413,
            headers: corsHeaders
          });
        }
        
        let body;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const rawData = body.data || '';
        const dataValidation = validateInput(rawData, 10000);
        
        if (!dataValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: dataValidation.error || 'Invalid input'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const data = dataValidation.sanitized!;
        const startTime = Date.now();
        
        const learningUnderstanding = understandingEngine ? understandingEngine.understand(data) : null;

        let realLearning: {
          taskName?: string;
          accuracy?: number;
          conceptName?: string;
          examples?: number;
        } | null = null;

        if (body.examples && Array.isArray(body.examples) && body.examples.length > 0 && learningEngine) {
          try {
            const taskName = body.taskName || `task_${Date.now()}`;
            const result = await learningEngine.learnTask(taskName, body.examples);
            realLearning = {
              taskName,
              accuracy: result.accuracy,
            };
          } catch (error) {
            console.log('Real learning unavailable:', error);
          }
        } else if (learningEngine && data.length > 10) {
          try {
            const conceptName = `concept_${Date.now()}`;
            const examples = data.split('.').filter((s: string) => s.trim().length > 0);
            await learningEngine.learnConcept(conceptName, examples);
            realLearning = { conceptName, examples: examples.length };
          } catch (error) {
            console.log('Concept learning unavailable:', error);
          }
        }

        if (learningUnderstanding && goalSystem) {
          const knowledgeGaps = goalSystem.identifyKnowledgeGaps(learningUnderstanding, [
            'mathematics', 'physics', 'computer_science', 'biology', 'psychology',
          ]);
          goalSystem.generateGoals({
            knowledgeGaps,
            curiosityAreas: goalSystem.identifyCuriosityAreas(learningUnderstanding.insights || []),
            performanceWeaknesses: [],
            unexploredDomains: [],
            recentInsights: learningUnderstanding.insights || [],
          });
        }

        const processingTimeMs = Date.now() - startTime;
        if (metricsCalculator) {
          metricsCalculator.recordRequest(true, processingTimeMs);
          if (learningUnderstanding) {
            learningUnderstanding.domains.forEach(domain => {
              metricsCalculator!.recordDomainInteraction(domain);
            });
          }
        }

        incrementLearning();
        const mlStatsAfter = learningEngine.getStatistics();
        return new Response(
          JSON.stringify({
            success: true,
            data: buildHonestLearnResponse({
              data,
              processingTimeMs,
              mlStats: mlStatsAfter,
              realLearning,
              understanding: learningUnderstanding
                ? {
                    concepts: learningUnderstanding.concepts.length,
                    relationships: learningUnderstanding.relationships.length,
                    domains: learningUnderstanding.domains,
                  }
                : null,
            }),
          }),
          { headers: corsHeaders }
        );
      }
      
      if (path === '/create' && request.method === 'POST') {
        // Validate request size
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Request body too large. Maximum size is 1MB.'
          }), {
            status: 413,
            headers: corsHeaders
          });
        }
        
        let body;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const rawPrompt = body.prompt || '';
        const promptValidation = validateInput(rawPrompt, 10000);
        
        if (!promptValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: promptValidation.error || 'Invalid input'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const prompt = promptValidation.sanitized!;
        const startTime = Date.now();
        
        const promptUnderstanding = understandingEngine ? understandingEngine.understand(prompt) : null;

        let crossDomainCreativeInsights: { insight: string; novelty: number; confidence: number }[] = [];
        if (promptUnderstanding && crossDomainEngine) {
          const insights = crossDomainEngine.generateCrossDomainInsights(promptUnderstanding);
          crossDomainCreativeInsights = insights.map(insight => ({
            insight: insight.insight,
            novelty: insight.novelty,
            confidence: insight.confidence,
          }));
        }

        const processingTimeMs = Date.now() - startTime;
        if (metricsCalculator) {
          metricsCalculator.recordRequest(true, processingTimeMs);
        }

        incrementCreative();
        return new Response(
          JSON.stringify({
            success: true,
            data: buildHonestCreateResponse({
              prompt,
              processingTimeMs,
              understanding: promptUnderstanding
                ? {
                    concepts: promptUnderstanding.concepts.length,
                    relationships: promptUnderstanding.relationships.length,
                    domains: promptUnderstanding.domains,
                    confidence: promptUnderstanding.confidence,
                  }
                : null,
              crossDomainInsights: crossDomainCreativeInsights,
            }),
          }),
          { headers: corsHeaders }
        );
      }
      
      // Root endpoint - return the exact same HTML as deployed
      if (path === '/' && request.method === 'GET') {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BleuJS Reasoning</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg-primary: #0a0a0a;
            --bg-secondary: #111111;
            --bg-tertiary: #1a1a1a;
            --accent: #00d4ff;
            --text-primary: #ffffff;
            --text-secondary: #cccccc;
            --text-muted: #888888;
            --border: #333333;
            --success: #00ff88;
            --warning: #ffaa00;
            --error: #ff4444;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 60px;
            position: relative;
        }
        
        .header h1 {
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--accent);
            letter-spacing: 1px;
            text-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
        }
        
        .header p {
            font-size: 1rem;
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.4;
        }
        
        .status-indicator {
            background: var(--success);
            color: var(--bg-primary);
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 400;
            font-size: 0.7rem;
            letter-spacing: 0.3px;
            display: inline-block;
        }

        .header-links {
            position: absolute;
            top: 0;
            right: 0;
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .github-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-decoration: none;
            padding: 8px;
            border: 1px solid var(--border);
            border-radius: 8px;
            transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .github-link:hover {
            color: var(--text-primary);
            border-color: var(--accent);
            background: rgba(0, 212, 255, 0.08);
        }

        .github-link svg {
            width: 22px;
            height: 22px;
            fill: currentColor;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .consciousness-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
        }
        
        .consciousness-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .consciousness-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        
        .consciousness-item {
            text-align: center;
            padding: 20px;
            background: var(--bg-tertiary);
            border-radius: 10px;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }
        
        .consciousness-item:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            box-shadow: 0 10px 25px rgba(0, 212, 255, 0.1);
        }
        
        .consciousness-item h3 {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .consciousness-value {
            font-size: 2.2em;
            font-weight: bold;
            color: var(--accent);
            margin-bottom: 5px;
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }
        
        .consciousness-label {
            font-size: 0.8em;
            color: var(--text-muted);
            font-style: italic;
        }
        
        .interaction-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
        }
        
        .interaction-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-secondary);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 15px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.2);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 120px;
        }
        
        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 25px;
        }
        
        .btn-primary {
            background: var(--accent);
            color: var(--bg-primary);
            border: 1px solid var(--accent);
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-primary:hover {
            background: var(--bg-tertiary);
            color: var(--accent);
            transform: translateY(-1px);
            box-shadow: 0 3px 8px rgba(0, 212, 255, 0.15);
        }
        
        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-secondary:hover {
            background: var(--bg-secondary);
            border-color: var(--accent);
            transform: translateY(-1px);
        }
        
        .result-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .result-panel h3 {
            margin-bottom: 20px;
            color: var(--accent);
            font-size: 1.3em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .result-content {
            background: var(--bg-tertiary);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--border);
            max-height: 600px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            white-space: pre-wrap;
            color: var(--text-primary);
            line-height: 1.6;
        }

        .lab-answer {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 1.05rem;
            line-height: 1.7;
            white-space: normal;
            margin-bottom: 1rem;
            padding: 1rem 1.25rem;
            background: rgba(99, 102, 241, 0.08);
            border-left: 4px solid var(--accent);
            border-radius: 0 8px 8px 0;
        }

        .lab-answer h2 { font-size: 1.35rem; margin: 1rem 0 0.5rem; color: var(--accent); }
        .lab-answer h3 { font-size: 1.15rem; margin: 1rem 0 0.5rem; color: var(--text-primary); }
        .lab-answer h4 { font-size: 1rem; margin: 0.75rem 0 0.35rem; color: var(--text-secondary); }
        .lab-answer p { margin: 0.5rem 0; }
        .lab-answer ul { margin: 0.5rem 0 0.5rem 1.25rem; }
        .lab-answer li { margin: 0.25rem 0; }
        .lab-answer blockquote {
            margin: 0.75rem 0;
            padding: 0.5rem 1rem;
            border-left: 3px solid var(--accent);
            color: var(--text-secondary);
            font-style: italic;
        }
        .lab-answer hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
        .lab-answer code {
            background: var(--bg-primary);
            padding: 0.1rem 0.35rem;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .lab-answer table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.75rem 0;
            font-size: 0.9rem;
        }
        .lab-answer th, .lab-answer td {
            border: 1px solid var(--border);
            padding: 0.4rem 0.6rem;
            text-align: left;
        }
        .lab-answer th { background: var(--bg-primary); color: var(--accent); }

        .lab-meta {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
        }

        .lab-details summary {
            cursor: pointer;
            color: var(--accent);
            margin-top: 0.5rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .metrics-panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .metrics-panel h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
        }
        
        .metric-item {
            text-align: center;
            padding: 20px;
            background: var(--bg-tertiary);
            border-radius: 10px;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }
        
        .metric-item:hover {
            transform: translateY(-3px);
            border-color: var(--accent);
            box-shadow: 0 8px 20px rgba(0, 212, 255, 0.1);
        }
        
        .metric-value {
            font-size: 2.0em;
            font-weight: bold;
            color: var(--success);
            margin-bottom: 5px;
        }
        
        .metric-label {
            font-size: 0.8em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-status {
            background: var(--success);
            color: var(--bg-primary);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 8px;
            display: inline-block;
            animation: pulse 2s infinite;
        }
        
        /* Advanced Metrics */
        .advanced-metrics {
            margin-top: 30px;
        }
        
        .metrics-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 25px;
        }
        
        .metric-category {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }
        
        .metric-category h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.1em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .metric-detail-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .metric-detail-item:last-child {
            border-bottom: none;
        }
        
        .metric-detail-item .metric-label {
            color: var(--text-secondary);
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .metric-detail-item .metric-value {
            color: var(--accent);
            font-weight: bold;
            font-size: 0.9em;
        }
        
        .metric-detail-item .metric-status {
            background: var(--success);
            color: var(--bg-primary);
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 0.65em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            animation: pulse 2s infinite;
        }
        
        .documentation-section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .documentation-section h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .documentation-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 25px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .documentation-tab {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border: 1px solid var(--border);
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .documentation-tab:hover,
        .documentation-tab.active {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
            transform: translateY(-1px);
        }
        
        .documentation-content {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 30px;
            min-height: 400px;
        }
        
        .documentation-tab-content {
            display: none;
        }
        
        .documentation-tab-content.active {
            display: block;
        }
        
        .documentation-tab-content h3 {
            color: var(--accent);
            margin-bottom: 20px;
            font-size: 1.4em;
            text-align: center;
        }
        
        .documentation-tab-content h4 {
            color: var(--text-primary);
            margin: 25px 0 15px 0;
            font-size: 1.2em;
        }
        
        .documentation-tab-content p {
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.6;
        }
        
        .documentation-tab-content ul {
            color: var(--text-secondary);
            margin-bottom: 20px;
            padding-left: 20px;
        }
        
        .documentation-tab-content li {
            margin-bottom: 10px;
            line-height: 1.5;
        }
        
        .documentation-tab-content strong {
            color: var(--accent);
        }
        
        /* API Endpoints */
        .endpoints {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 15px;
            padding: 30px;
            margin-top: 30px;
        }
        
        .endpoints h2 {
            margin-bottom: 25px;
            color: var(--accent);
            font-size: 1.5em;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .endpoints > p {
            text-align: center;
            margin-bottom: 25px;
            color: var(--text-secondary);
            font-size: 1.1rem;
        }
        
        .endpoint-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .endpoint-item {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .endpoint-item:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 212, 255, 0.1);
        }
        
        .endpoint-item .method {
            background: var(--accent);
            color: var(--bg-primary);
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 0.8em;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .endpoint-item .path {
            color: var(--text-primary);
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 1.1em;
            margin-bottom: 8px;
            font-weight: bold;
        }
        
        .endpoint-item .description {
            color: var(--text-secondary);
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .api-details {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
        }
        
        .api-details h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.2em;
            text-align: center;
        }
        
        .api-details ul {
            list-style: none;
            padding: 0;
        }
        
        .api-details li {
            color: var(--text-secondary);
            margin-bottom: 10px;
            padding-left: 20px;
            position: relative;
            line-height: 1.5;
        }
        
        .api-details li:before {
            content: "→";
            color: var(--accent);
            position: absolute;
            left: 0;
            font-weight: bold;
        }
        
        .loading {
            text-align: center;
            color: var(--accent);
            font-style: italic;
            margin: 20px 0;
        }
        
        .spinner {
            border: 2px solid var(--bg-tertiary);
            border-top: 2px solid var(--accent);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Enhanced Mobile Responsiveness */
        @media (max-width: 768px) {
            .header-links {
                position: static;
                justify-content: center;
                margin-bottom: 12px;
            }

            .header h1 {
                font-size: 1.4rem;
                line-height: 1.2;
                margin-bottom: 12px;
                letter-spacing: 0.5px;
            }
            
            .header p {
                font-size: 0.9rem;
                line-height: 1.3;
                margin-bottom: 15px;
            }
            
            .container {
                padding: 12px 8px;
                max-width: 100%;
            }
            
            .header {
                margin-bottom: 30px;
                padding: 20px 15px;
            }
            
            .dashboard {
                grid-template-columns: 1fr;
                gap: 20px;
                margin-bottom: 25px;
            }
            
            .consciousness-panel,
            .interaction-panel {
                padding: 20px 15px;
            }
            
            .consciousness-panel h2,
            .interaction-panel h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .consciousness-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .consciousness-item {
                padding: 15px;
            }
            
            .consciousness-item h3 {
                font-size: 0.85rem;
                margin-bottom: 8px;
            }
            
            .consciousness-value {
                font-size: 1.8rem;
                margin-bottom: 8px;
            }
            
            .consciousness-label {
                font-size: 0.75rem;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                font-size: 0.9rem;
                margin-bottom: 6px;
            }
            
            .form-group select,
            .form-group textarea {
                padding: 15px;
                font-size: 16px; /* Prevents zoom on iOS */
                border-radius: 8px;
            }
            
            .form-group textarea {
                min-height: 100px;
            }
            
            .button-group {
                flex-direction: column;
                gap: 10px;
            }
            
            .btn-primary,
            .btn-secondary {
                width: 100%;
                padding: 15px 20px;
                font-size: 16px;
                border-radius: 8px;
                touch-action: manipulation;
            }
            
            .btn-primary:active,
            .btn-secondary:active {
                transform: scale(0.98);
            }
            
            .result-panel {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .result-panel h3 {
                font-size: 1.2rem;
                margin-bottom: 15px;
            }
            
            .result-content {
                padding: 15px;
                max-height: 500px;
                font-size: 0.85rem;
                border-radius: 8px;
            }
            
            .metrics-panel {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .metrics-panel h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            
            .metric-item {
                padding: 12px;
            }
            
            .metric-value {
                font-size: 1.4rem;
            }
            
            .metric-label {
                font-size: 0.7rem;
            }
            
            /* Advanced metrics mobile optimization */
            .advanced-metrics {
                margin-top: 20px;
            }
            
            .metrics-row {
                grid-template-columns: 1fr;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .metric-category {
                padding: 15px;
            }
            
            .metric-category h3 {
                font-size: 1rem;
                margin-bottom: 12px;
            }
            
            .metric-detail-item {
                padding: 6px 0;
            }
            
            .metric-detail-item .metric-label {
                font-size: 0.75rem;
            }
            
            .metric-detail-item .metric-value {
                font-size: 0.8rem;
            }
            
            .metric-detail-item .metric-status {
                font-size: 0.6rem;
                padding: 1px 4px;
            }
            
            .documentation-section {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .documentation-section h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .documentation-tabs {
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .documentation-tab {
                padding: 10px 16px;
                font-size: 0.8rem;
            }
            
            .documentation-content {
                padding: 20px 15px;
                min-height: 300px;
            }
            
            .documentation-tab-content h3 {
                font-size: 1.2rem;
                margin-bottom: 15px;
            }
            
            .documentation-tab-content h4 {
                font-size: 1.1rem;
                margin: 20px 0 12px 0;
            }
            
            .documentation-tab-content p {
                font-size: 0.9rem;
                margin-bottom: 15px;
            }
            
            .documentation-tab-content ul {
                padding-left: 15px;
            }
            
            .documentation-tab-content li {
                margin-bottom: 8px;
                font-size: 0.9rem;
            }
            
            /* API endpoints mobile optimization */
            .endpoints {
                padding: 20px 15px;
                margin-top: 20px;
            }
            
            .endpoints h2 {
                font-size: 1.3rem;
                margin-bottom: 20px;
            }
            
            .endpoints > p {
                font-size: 1rem;
                margin-bottom: 20px;
            }
            
            .endpoint-list {
                grid-template-columns: 1fr;
                gap: 15px;
                margin-bottom: 25px;
            }
            
            .endpoint-item {
                padding: 15px;
            }
            
            .endpoint-item .method {
                font-size: 0.7rem;
                padding: 3px 10px;
            }
            
            .endpoint-item .path {
                font-size: 1rem;
            }
            
            .endpoint-item .description {
                font-size: 0.8rem;
            }
            
            .api-details {
                padding: 15px;
            }
            
            .api-details h3 {
                font-size: 1.1rem;
                margin-bottom: 12px;
            }
            
            .api-details li {
                font-size: 0.8rem;
                margin-bottom: 8px;
            }
        }

        /* Small Mobile Devices */
        @media (max-width: 480px) {
            .header h1 {
                font-size: 1.2rem;
                letter-spacing: 0.3px;
            }
            
            .header p {
                font-size: 0.8rem;
                line-height: 1.2;
            }
            
            .container {
                padding: 10px 8px;
            }
            
            .consciousness-panel,
            .interaction-panel,
            .result-panel,
            .metrics-panel,
            .documentation-section {
                padding: 15px 12px;
            }
            
            .consciousness-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            
            .consciousness-item {
                padding: 10px 8px;
            }
            
            .consciousness-value {
                font-size: 1.3rem;
            }
            
            .form-group select,
            .form-group textarea {
                padding: 12px;
                font-size: 16px;
            }
            
            .btn-primary,
            .btn-secondary {
                padding: 12px 16px;
                font-size: 15px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            
            .metric-item {
                padding: 10px 8px;
            }
            
            .metric-value {
                font-size: 1.2rem;
            }
            
            .metric-label {
                font-size: 0.65rem;
            }
            
            .documentation-tabs {
                flex-direction: column;
                align-items: center;
            }
            
            .documentation-tab {
                width: 100%;
                max-width: 200px;
            }
        }

        /* Touch Device Optimizations */
        @media (hover: none) and (pointer: coarse) {
            .btn-primary,
            .btn-secondary {
                min-height: 44px; /* iOS recommended touch target size */
            }
            
            .form-group select,
            .form-group textarea {
                min-height: 44px;
            }
            
            .consciousness-item,
            .metric-item,
            .documentation-tab {
                cursor: pointer;
            }
            
            .consciousness-item:active,
            .metric-item:active,
            .documentation-tab:active {
                transform: scale(0.98);
            }
        }

        /* Landscape Mobile */
        @media (max-width: 768px) and (orientation: landscape) {
            .header {
                margin-bottom: 30px;
            }
            
            .header h1 {
                font-size: 1.5rem;
            }
            
            .dashboard {
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .consciousness-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            
            .consciousness-item {
                padding: 8px 6px;
            }
            
            .consciousness-value {
                font-size: 1.2rem;
            }
            
            .consciousness-label {
                font-size: 0.7rem;
            }
            
            .container {
                padding: 10px 15px;
            }
            
            .metrics-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
            }
            
            .documentation-tabs {
                flex-direction: row;
                justify-content: center;
            }
        }

        /* High DPI Mobile Devices */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
            .btn-primary,
            .btn-secondary {
                border-width: 0.5px;
            }
            
            .consciousness-panel,
            .interaction-panel,
            .result-panel,
            .metrics-panel,
            .documentation-section {
                border-width: 0.5px;
            }
        }

        /* Mobile Navigation Improvements */
        @media (max-width: 768px) {
            /* Smooth scrolling for mobile */
            html {
                scroll-behavior: smooth;
            }
            
            /* Better focus states for mobile */
            .btn-primary:focus,
            .btn-secondary:focus,
            .form-group select:focus,
            .form-group textarea:focus,
            .documentation-tab:focus {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
            
            /* Prevent horizontal scroll */
            body {
                overflow-x: hidden;
                width: 100%;
            }
            
            /* Better text selection */
            ::selection {
                background: var(--accent);
                color: var(--bg-primary);
            }
            
            /* Improved scrollbar for mobile */
            ::-webkit-scrollbar {
                width: 8px;
            }
            
            ::-webkit-scrollbar-track {
                background: var(--bg-tertiary);
                border-radius: 4px;
            }
            
            ::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-links">
                <a class="github-link" href="https://github.com/HelloblueAI/neural-quantum-consciousness-framework" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="View on GitHub">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                </a>
            </div>
            <h1>BleuJS Reasoning</h1>
            <p>Measured reasoning · LLM when configured · No simulated metrics</p>
            <div class="status-indicator">Online · v5.1</div>
        </div>
        
        <div class="dashboard">
            <div class="consciousness-panel">
                <h2>Capabilities</h2>
                <div class="consciousness-grid" id="consciousnessGrid">
                    <div class="consciousness-item">
                        <h3>Reasoning</h3>
                        <div class="consciousness-value">Loading...</div>
                        <div class="consciousness-label">Loading...</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>System Depth</h3>
                        <div class="consciousness-value">Loading...</div>
                        <div class="consciousness-label">Loading...</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>Understanding</h3>
                        <div class="consciousness-value">Loading...</div>
                        <div class="consciousness-label">Loading...</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>Adaptability</h3>
                        <div class="consciousness-value">Loading...</div>
                        <div class="consciousness-label">Loading...</div>
                    </div>
                </div>
            </div>
            
            <div class="interaction-panel">
                <h2>Reasoning Interaction</h2>
                <div class="form-group">
                    <label for="hrsEndpoint">Function:</label>
                    <select id="hrsEndpoint">
                        <option value="reason">Reason</option>
                        <option value="learn">Learn</option>
                        <option value="create">Create</option>
                        <option value="status">Status</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="hrsInput">Input:</label>
                    <textarea id="hrsInput" placeholder="Enter your question, data to learn, or creative prompt..."></textarea>
                </div>
                <div class="button-group">
                    <button class="btn btn-primary" onclick="interactWithSystem()">Process Request</button>
                    <button class="btn btn-secondary" onclick="clearResult()">Clear</button>
                </div>
            </div>
        </div>
        
        <div class="result-panel" id="resultPanel" style="display: none;">
            <h3 id="resultPanelTitle">Answer</h3>
            <div class="result-content" id="hrsResult"></div>
        </div>
        
        <div class="metrics-panel">
            <h2>System Metrics</h2>
            <div class="metrics-grid" id="metricsGrid">
                <div class="metric-item">
                    <div class="metric-value">Loading...</div>
                    <div class="metric-label">Knowledge Base</div>
                    <div class="metric-status">ACTIVE</div>
                </div>
                <div class="metric-item">
                    <div class="metric-value">Loading...</div>
                    <div class="metric-label">Reasoning History</div>
                    <div class="metric-status">ACTIVE</div>
                </div>
                <div class="metric-item">
                    <div class="metric-value">Loading...</div>
                    <div class="metric-label">Learning History</div>
                    <div class="metric-status">ACTIVE</div>
                </div>
                <div class="metric-item">
                    <div class="metric-value">Loading...</div>
                    <div class="metric-label">Creative History</div>
                    <div class="metric-status">ACTIVE</div>
                </div>
            </div>
            
            <div class="advanced-metrics">
                <div class="metrics-row">
                    <div class="metric-category">
                        <h3>Learning Stats</h3>
                        <div class="metric-details">
                            <div class="metric-detail-item">
                                <span class="metric-label">Tasks Learned:</span>
                                <span class="metric-value" id="activeNeurons">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Concepts Acquired:</span>
                                <span class="metric-value" id="synapticConnections">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Adaptability:</span>
                                <span class="metric-value" id="neuralPlasticity">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-category">
                        <h3>System Performance</h3>
                        <div class="metric-details">
                            <div class="metric-detail-item">
                                <span class="metric-label">Reasoning Quality:</span>
                                <span class="metric-value" id="cpuUsage">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Learning Efficiency:</span>
                                <span class="metric-value" id="memoryUsage">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Model Accuracy:</span>
                                <span class="metric-value" id="processingSpeed">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="metrics-row">
                    <div class="metric-category">
                        <h3>Learning Engine</h3>
                        <div class="metric-details">
                            <div class="metric-detail-item">
                                <span class="metric-label">Tasks Learned:</span>
                                <span class="metric-value" id="quantumCoherence">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Concepts Acquired:</span>
                                <span class="metric-value" id="superpositionStates">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Average Accuracy:</span>
                                <span class="metric-value" id="entanglementPairs">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-category">
                        <h3>Capability Scores</h3>
                        <div class="metric-details">
                            <div class="metric-detail-item">
                                <span class="metric-label">System Depth:</span>
                                <span class="metric-value" id="selfAwareness">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Cross-Domain:</span>
                                <span class="metric-value" id="understandingLevel">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                            <div class="metric-detail-item">
                                <span class="metric-label">Adaptability:</span>
                                <span class="metric-value" id="creativeSynthesis">Loading...</span>
                                <span class="metric-status">ACTIVE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="documentation-section">
            <h2>System Documentation</h2>
            <div class="documentation-tabs">
                <button class="documentation-tab active" onclick="showDocumentationTab('overview')">Overview</button>
                <button class="documentation-tab" onclick="showDocumentationTab('architecture')">Architecture</button>
                <button class="documentation-tab" onclick="showDocumentationTab('tech')">Tech Stack</button>
            </div>
            
            <div class="documentation-content">
                <div id="overview" class="documentation-tab-content active">
                    <h3>BleuJS Reasoning v5.1</h3>
                    <p>A measured reasoning API on Cloudflare Workers — multi-agent orchestration, optional LLM integration, and an eval harness. Not a claim of AGI.</p>
                    
                    <h4>What it does</h4>
                    <ul>
                        <li><strong>POST /reason:</strong> Answer-first responses via BleuJS API when <code>BLEUJS_API_KEY</code> is configured</li>
                        <li><strong>GET /eval:</strong> Benchmark pass rate over a fixed task suite</li>
                        <li><strong>GET /metrics:</strong> Learning-engine state and request counters — no random telemetry</li>
                        <li><strong>GET /capabilities:</strong> Capability scores derived from real ML stats</li>
                        <li><strong>POST /learn:</strong> Concept learning via the built-in neural engine</li>
                    </ul>
                </div>
                
                <div id="architecture" class="documentation-tab-content">
                    <h3>Architecture</h3>
                    <p>Single Cloudflare Worker (<code>primary-agi-worker.ts</code>) with process-scoped engines: learning, understanding, cross-domain reasoning, optional LLM, and autonomous goals.</p>
                    
                    <h4>Components</h4>
                    <ul>
                        <li><strong>RealLLMIntegration:</strong> BleuJS API (<code>bleujs-chat</code>) primary; Anthropic/OpenAI fallback</li>
                        <li><strong>RealLearningEngine:</strong> Backpropagation on small tasks (XOR baseline)</li>
                        <li><strong>RealUnderstandingEngine:</strong> Concept and domain extraction from input</li>
                        <li><strong>AutonomousGoalSystem:</strong> Goal tracking (execution loop planned)</li>
                        <li><strong>Eval harness:</strong> <code>pnpm run eval</code> for local benchmarks</li>
                    </ul>
                </div>
                
                <div id="tech" class="documentation-tab-content">
                    <h3>Technology Stack</h3>
                    <p>TypeScript on Cloudflare Workers. Legacy Rust/C/WASM modules exist in the repo but are not required for the live worker path.</p>
                    
                    <h4>Runtime</h4>
                    <ul>
                        <li><strong>Cloudflare Workers:</strong> Production deployment</li>
                        <li><strong>TypeScript:</strong> Worker, orchestrator, and eval harness</li>
                        <li><strong>Wrangler:</strong> Deploy via <code>pnpm run deploy:worker:prod</code></li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>API Endpoints</h2>
            <p>REST API for BleuJS Reasoning:</p>
            
            <div class="endpoint-list">
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/capabilities</div>
                    <div class="description">Measured capability scores from the learning engine</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/metrics</div>
                    <div class="description">Full metrics payload — ML stats, performance, history, goals</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/status</div>
                    <div class="description">Operational status and feature flags</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">GET</div>
                    <div class="path">/eval</div>
                    <div class="description">Run the eval suite and return pass rate</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">POST</div>
                    <div class="path">/reason</div>
                    <div class="description">Reasoning via BleuJS API when configured; response includes <code>llmProvider</code> (<code>bleujs</code>, <code>anthropic</code>, or <code>openai</code>)</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">POST</div>
                    <div class="path">/learn</div>
                    <div class="description">Learn concepts or train on labeled examples</div>
                </div>
                
                <div class="endpoint-item">
                    <div class="method">POST</div>
                    <div class="path">/create</div>
                    <div class="description">Understanding analysis for a creative prompt (LLM creative output via /reason)</div>
                </div>
            </div>
            
            <div class="api-details">
                <h3>API Notes</h3>
                <ul>
                    <li><strong>Measured metrics:</strong> No random or simulated telemetry on live endpoints</li>
                    <li><strong>LLM:</strong> <code>BLEUJS_API_KEY</code> (primary, <code>api.bleujs.org</code>); <code>ANTHROPIC_API_KEY</code> / <code>OPENAI_API_KEY</code> optional fallback. Check <code>llmProvider</code> in <code>/reason</code> responses.</li>
                    <li><strong>/consciousness:</strong> Deprecated alias of /capabilities for older clients</li>
                    <li><strong>CORS:</strong> Open for GET and POST from any origin</li>
                </ul>
            </div>
        </div>
    </div>
    
    <script>
        // Load system status on page load
        window.onload = function() {
            console.log('Page loaded, calling loadSystemStatus...');
            setTimeout(loadSystemStatus, 100); // Small delay to ensure DOM is ready
        };
        
        // Also try to load when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM content loaded, calling loadSystemStatus...');
            loadSystemStatus();
        });
        
        async function loadSystemStatus() {
            const consciousnessGrid = document.getElementById('consciousnessGrid');
            if (!consciousnessGrid) return;

            function renderCapabilities(caps, sources) {
                consciousnessGrid.innerHTML = \`
                    <div class="consciousness-item">
                        <h3>Reasoning</h3>
                        <div class="consciousness-value">\${(caps.reasoningQuality * 100).toFixed(1)}%</div>
                        <div class="consciousness-label">\${sources.reasoningQuality || sources.awareness || 'Measured'}</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>System Depth</h3>
                        <div class="consciousness-value">\${(caps.systemDepth * 100).toFixed(1)}%</div>
                        <div class="consciousness-label">\${sources.systemDepth || sources.selfAwareness || 'Measured'}</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>Understanding</h3>
                        <div class="consciousness-value">\${(caps.understandingDepth * 100).toFixed(1)}%</div>
                        <div class="consciousness-label">\${sources.understandingDepth || sources.understanding || 'Measured'}</div>
                    </div>
                    <div class="consciousness-item">
                        <h3>Adaptability</h3>
                        <div class="consciousness-value">\${(caps.adaptability * 100).toFixed(1)}%</div>
                        <div class="consciousness-label">\${sources.adaptability || sources.creativity || 'Measured'}</div>
                    </div>
                \`;
            }

            function normalizeCapabilities(data) {
                const d = data.data || {};
                if (d.capabilities) {
                    return { caps: d.capabilities, sources: d.capabilities.sources || {} };
                }
                if (d.consciousnessMetrics) {
                    const m = d.consciousnessMetrics;
                    const s = d.consciousnessSources || {};
                    return {
                        caps: {
                            reasoningQuality: m.awareness,
                            systemDepth: m.selfAwareness,
                            understandingDepth: m.understanding,
                            adaptability: m.creativity,
                        },
                        sources: {
                            reasoningQuality: s.awareness,
                            systemDepth: s.selfAwareness,
                            understandingDepth: s.understanding,
                            adaptability: s.creativity,
                        },
                    };
                }
                return null;
            }

            try {
                let capResponse = await fetch('/capabilities');
                if (!capResponse.ok) {
                    capResponse = await fetch('/consciousness');
                }
                if (!capResponse.ok) {
                    throw new Error('HTTP ' + capResponse.status);
                }
                const capData = await capResponse.json();
                const normalized = normalizeCapabilities(capData);
                if (!capData.success || !normalized || normalized.caps.reasoningQuality == null) {
                    throw new Error('Invalid capabilities response');
                }
                renderCapabilities(normalized.caps, normalized.sources);
            } catch (error) {
                console.error('Failed to load capabilities:', error);
                consciousnessGrid.innerHTML = \`
                    <div class="consciousness-item">
                        <h3>Error</h3>
                        <div class="consciousness-value">Failed to load</div>
                        <div class="consciousness-label">Hard refresh (Ctrl+Shift+R) or try workers.dev URL</div>
                    </div>
                \`;
                return;
            }

            try {
                const metricsResponse = await fetch('/status');
                if (!metricsResponse.ok) return;
                const metricsData = await metricsResponse.json();
                if (!metricsData.success) return;

                const metrics = metricsData.data.history || metricsData.data.metrics;
                const performance = metricsData.data.performance || {};
                const ml = metricsData.data.ml || metricsData.data.realML || {};
                const metricsGrid = document.getElementById('metricsGrid');
                if (metrics && metricsGrid) {
                    metricsGrid.innerHTML = \`
                        <div class="metric-item">
                            <div class="metric-value">\${metrics.knowledgeBaseSize ?? 0}</div>
                            <div class="metric-label">Knowledge Base</div>
                            <div class="metric-status">ACTIVE</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">\${metrics.reasoningHistorySize ?? 0}</div>
                            <div class="metric-label">Reasoning History</div>
                            <div class="metric-status">ACTIVE</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">\${metrics.learningHistorySize ?? 0}</div>
                            <div class="metric-label">Learning History</div>
                            <div class="metric-status">ACTIVE</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">\${metrics.creativeHistorySize ?? 0}</div>
                            <div class="metric-label">Creative History</div>
                            <div class="metric-status">ACTIVE</div>
                        </div>
                    \`;
                }
                updateAdvancedMetrics(performance, ml);
            } catch (error) {
                console.error('Failed to load status metrics:', error);
            }
        }
        
        function setMetricText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function updateAdvancedMetrics(performance, ml) {
            setMetricText('activeNeurons', String(ml.tasksLearned ?? 0));
            setMetricText('synapticConnections', String(ml.conceptsAcquired ?? 0));
            setMetricText('neuralPlasticity', ((performance.adaptability || 0) * 100).toFixed(1) + '%');
            setMetricText('cpuUsage', ((performance.reasoningQuality || 0) * 100).toFixed(1) + '%');
            setMetricText('memoryUsage', ((performance.learningEfficiency || 0) * 100).toFixed(1) + '%');
            setMetricText('processingSpeed', ((ml.averageAccuracy || 0) * 100).toFixed(1) + '% acc');
            setMetricText('quantumCoherence', String(ml.tasksLearned ?? 0));
            setMetricText('superpositionStates', String(ml.conceptsAcquired ?? 0));
            setMetricText('entanglementPairs', ((ml.averageAccuracy || 0) * 100).toFixed(1) + '%');
            setMetricText('selfAwareness', ((performance.systemDepth || 0) * 100).toFixed(1) + '%');
            setMetricText('understandingLevel', ((performance.crossDomainIntegration || 0) * 100).toFixed(1) + '%');
            setMetricText('creativeSynthesis', ((performance.adaptability || 0) * 100).toFixed(1) + '%');
        }
        
        function escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function renderMarkdown(text) {
            const lines = String(text).split('\\n');
            const out = [];
            let inList = false;
            let tableRows = [];

            function flushTable() {
                if (tableRows.length === 0) return;
                const rows = tableRows.filter(r => !/^\\|[\\s\\-:|]+\\|$/.test(r.trim()));
                if (rows.length === 0) { tableRows = []; return; }
                let t = '<table><tbody>';
                rows.forEach((row, i) => {
                    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
                    const tag = i === 0 ? 'th' : 'td';
                    t += '<tr>' + cells.map(c => '<' + tag + '>' + c + '</' + tag + '>').join('') + '</tr>';
                });
                t += '</tbody></table>';
                out.push(t);
                tableRows = [];
            }

            for (const raw of lines) {
                const line = raw
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const bold = (s) => s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
                const code = (s) => s.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

                if (line.trim().startsWith('|')) {
                    if (inList) { out.push('</ul>'); inList = false; }
                    tableRows.push(line);
                    continue;
                }
                flushTable();

                if (/^### (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h4>' + bold(code(line.replace(/^### /, ''))) + '</h4>'); continue; }
                if (/^## (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h3>' + bold(code(line.replace(/^## /, ''))) + '</h3>'); continue; }
                if (/^# (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h2>' + bold(code(line.replace(/^# /, ''))) + '</h2>'); continue; }
                if (/^---+$/.test(line.trim())) { if (inList) { out.push('</ul>'); inList = false; } out.push('<hr>'); continue; }
                if (/^&gt; (.+)/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<blockquote>' + bold(code(line.replace(/^&gt; /, ''))) + '</blockquote>'); continue; }
                if (/^- (.+)/.test(line)) {
                    if (!inList) { out.push('<ul>'); inList = true; }
                    out.push('<li>' + bold(code(line.slice(2))) + '</li>');
                    continue;
                }
                if (line.trim() === '') {
                    if (inList) { out.push('</ul>'); inList = false; }
                    continue;
                }
                if (inList) { out.push('</ul>'); inList = false; }
                out.push('<p>' + bold(code(line)) + '</p>');
            }
            flushTable();
            if (inList) out.push('</ul>');
            return out.join('');
        }

        function formatLabResponse(endpoint, payload) {
            const answer = payload.answer ?? payload.aiInsight ?? null;
            if (endpoint === 'reason' && answer != null) {
                document.getElementById('resultPanelTitle').textContent = 'Answer';
                const meta = [
                    !payload.llmUsed
                        ? (payload.confidence === 1 ? 'Local math' : 'Local reasoning')
                        : (payload.llmProvider === 'bleujs' ? 'BleuJS API'
                            : payload.llmProvider === 'anthropic' ? 'Anthropic'
                            : payload.llmProvider === 'openai' ? 'OpenAI'
                            : 'LLM'),
                    ((payload.confidence ?? 0) * 100).toFixed(0) + '% confidence',
                    (payload.processingTimeMs ?? '—') + 'ms'
                ].join(' · ');
                let html = '<div class="lab-meta">' + escapeHtml(meta) + '</div>';
                html += '<div class="lab-answer">' + renderMarkdown(answer) + '</div>';
                if (payload.understanding) {
                    html += '<div class="lab-meta">Domains: ' + escapeHtml((payload.understanding.domains || []).join(', ') || 'general') +
                        ' · ' + (payload.understanding.conceptCount ?? 0) + ' concepts</div>';
                }
                html += '<details class="lab-details"><summary>Raw JSON</summary><pre>' +
                    escapeHtml(JSON.stringify(payload, null, 2)) + '</pre></details>';
                return html;
            }
            if (endpoint === 'reason' && !answer) {
                document.getElementById('resultPanelTitle').textContent = 'Response';
                return '<div class="lab-meta">No LLM answer — check API keys.</div><pre>' +
                    escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
            }
            document.getElementById('resultPanelTitle').textContent = 'Response';
            return '<pre>' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre>';
        }

        async function interactWithSystem() {
            const endpoint = document.getElementById('hrsEndpoint').value;
            const input = document.getElementById('hrsInput').value;
            const resultPanel = document.getElementById('resultPanel');
            const resultDiv = document.getElementById('hrsResult');
            
            if (!input.trim()) {
                alert('Please enter some input!');
                return;
            }
            
            // Show loading
            resultPanel.style.display = 'block';
            resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Processing request...</div>';
            
            try {
                let response;
                switch (endpoint) {
                    case 'reason':
                        response = await fetch('/reason', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ input })
                        });
                        break;
                    case 'learn':
                        response = await fetch('/learn', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ data: input })
                        });
                        break;
                    case 'create':
                        response = await fetch('/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: input })
                        });
                        break;
                    case 'status':
                        response = await fetch('/status');
                        break;
                }
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = formatLabResponse(endpoint, data.data);
                    loadSystemStatus();
                } else {
                    resultDiv.innerHTML = 'Error: ' + (data.error || 'Unknown error occurred');
                }
            } catch (error) {
                resultDiv.innerHTML = 'Failed to process request: ' + error.message;
                console.error('Reasoning interaction error:', error);
            }
        }
        
        function clearResult() {
            document.getElementById('resultPanel').style.display = 'none';
            document.getElementById('hrsResult').innerHTML = '';
            document.getElementById('hrsInput').value = '';
        }
        
        function showDocumentationTab(tabName) {
            // Hide all tab contents
            const tabContents = document.querySelectorAll('.documentation-tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Remove active class from all tabs
            const tabs = document.querySelectorAll('.documentation-tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
        `;
        
        return new Response(html, {
          headers: htmlHeaders
        });
      }
      
      // 404 for unknown routes
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: ['/health', '/metrics', '/eval', '/goals', '/status', '/capabilities', '/reason', '/learn', '/create', '/']
      }), {
        status: 404,
        headers: corsHeaders
      });
      
    } catch (error) {
      // Enhanced error handling with better user messages
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Log full error for debugging (server-side only)
      console.error('Worker error:', {
        message: errorMessage,
        stack: errorStack,
        path: path,
        method: request.method,
        timestamp: new Date().toISOString()
      });
      
      // Return user-friendly error response (don't expose stack traces)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'An error occurred while processing your request. Please try again later.',
        timestamp: Date.now()
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
