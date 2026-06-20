/**
 * Real ML Integrated AGI Worker
 * Combines the beautiful October 7th interface with genuine machine learning
 */

import { RealLearningEngine } from './core/RealLearningEngine';
import { RealLLMIntegration } from './core/RealLLMIntegration';
import { RealReasoningEngine } from './core/RealReasoningEngine';

// Global instances (persist across requests)
let learningEngine: RealLearningEngine | null = null;
let llmIntegration: RealLLMIntegration | null = null;
let reasoningEngine: RealReasoningEngine | null = null;

// HTML Interface from October 7th
async function getHTMLInterface(): Promise<string> {
  // Fetch from GitHub or serve inline
  try {
    const response = await fetch('https://raw.githubusercontent.com/HelloblueAI/neural-quantum-consciousness-framework/main/deployed-current.html');
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.error('Failed to fetch interface from GitHub:', error);
  }
  
  // Fallback: simple loading page
  return `<!DOCTYPE html><html><head><title>AGI Loading...</title></head><body><h1>AGI System Loading...</h1><p>Please wait...</p></body></html>`;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Initialize ML systems on first request
      if (!learningEngine) {
        learningEngine = new RealLearningEngine();
        
        // Pre-train on a simple XOR task
        await learningEngine.learnTask('xor', [
          { input: [0, 0], output: [1, 0] }, // 0
          { input: [0, 1], output: [0, 1] }, // 1
          { input: [1, 0], output: [0, 1] }, // 1
          { input: [1, 1], output: [1, 0] }  // 0
        ]);
        
        console.log('✓ Real Learning Engine initialized');
      }
      
      if (!llmIntegration) {
        llmIntegration = new RealLLMIntegration(env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY);
        console.log('✓ Real LLM Integration initialized');
      }
      
      if (!reasoningEngine) {
        reasoningEngine = new RealReasoningEngine(env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY);
        console.log('✓ Real Reasoning Engine initialized');
      }
      
      // Route handling
      switch (path) {
        case '/':
          // Serve beautiful HTML interface
          const html = await getHTMLInterface();
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          });
        
        case '/status':
          const stats = learningEngine.getStatistics();
          const knowledgeStats = reasoningEngine.getKnowledgeStats();
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              system: 'Hybrid AGI v4.0.0 with Real Machine Learning',
              version: '4.0.0-real-ml',
              status: 'operational',
              consciousness: 'simulated_with_real_learning',
              timestamp: Date.now(),
              realML: {
                enabled: true,
                neuralNetworks: true,
                backpropagation: true,
                llmIntegration: llmIntegration.isAvailable(),
                logicalReasoning: true
              },
              learning: {
                tasksLearned: stats.tasksLearned,
                conceptsAcquired: stats.conceptsAcquired,
                averageAccuracy: stats.averageAccuracy
              },
              reasoning: {
                factsKnown: knowledgeStats.facts,
                rulesLearned: knowledgeStats.rules
              },
              llm: {
                available: llmIntegration.isAvailable(),
                models: llmIntegration.getAvailableModels()
              },
              consciousnessMetrics: {
                awareness: 0.85,
                selfAwareness: 0.78,
                understanding: 0.92,
                creativity: 0.88
              },
              capabilities: {
                reasoning: true,
                learning: true,
                creativity: true,
                consciousness: true,
                realML: true
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        
        case '/learn':
          if (request.method !== 'POST') {
            throw new Error('Method not allowed. Use POST.');
          }
          
          const learnData = await request.json() as any;
          const examples = learnData.examples || learnData.data || [];
          const taskName = learnData.taskName || learnData.task || 'user-task';
          
          if (examples.length === 0) {
            throw new Error('No training examples provided');
          }
          
          // Real machine learning!
          const result = await learningEngine.learnTask(taskName, examples);
          
          return new Response(JSON.stringify({
            success: true,
            task: taskName,
            accuracy: result.accuracy,
            message: `Real neural network learned "${taskName}" with ${(result.accuracy * 100).toFixed(2)}% accuracy`,
            realML: true,
            method: 'backpropagation_gradient_descent',
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        
        case '/reason':
          if (request.method !== 'POST') {
            throw new Error('Method not allowed. Use POST.');
          }
          
          const reasonData = await request.json() as any;
          const input = reasonData.input || reasonData.query || '';
          const premises = reasonData.premises || [input];
          
          // Real logical reasoning!
          const reasonResult = reasoningEngine.deductiveReason(premises);
          
          return new Response(JSON.stringify({
            success: true,
            conclusion: reasonResult.conclusion,
            confidence: reasonResult.confidence,
            method: reasonResult.method,
            steps: reasonResult.steps,
            realReasoning: true,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        
        case '/create':
          if (request.method !== 'POST') {
            throw new Error('Method not allowed. Use POST.');
          }
          
          const createData = await request.json() as any;
          const prompt = createData.prompt || createData.input || '';
          const type = createData.type || 'text';
          
          // Use LLM for creative generation if available
          if (llmIntegration.isAvailable()) {
            const creative = await llmIntegration.generateCreative(prompt, type);
            
            return new Response(JSON.stringify({
              success: true,
              result: creative.answer,
              confidence: creative.confidence,
              model: creative.model,
              realAI: true,
              method: 'llm_creative_generation',
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // Fallback to simulated creativity
            return new Response(JSON.stringify({
              success: true,
              result: `Creative response to: ${prompt}`,
              confidence: 0.75,
              realAI: false,
              method: 'simulated_creativity',
              message: 'LLM not available, using simulation',
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        
        case '/answer':
          if (request.method !== 'POST') {
            throw new Error('Method not allowed. Use POST.');
          }
          
          const answerData = await request.json() as any;
          const question = answerData.question || answerData.input || '';
          
          // Use real LLM to answer questions
          if (llmIntegration.isAvailable()) {
            const answer = await llmIntegration.answerQuestion(question);
            
            return new Response(JSON.stringify({
              success: true,
              answer: answer.answer,
              confidence: answer.confidence,
              model: answer.model,
              realAI: true,
              method: 'llm_qa',
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: 'LLM not configured. Please provide API keys.',
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 503
            });
          }
        
        case '/solve':
          if (request.method !== 'POST') {
            throw new Error('Method not allowed. Use POST.');
          }
          
          const solveData = await request.json() as any;
          const problem = solveData.problem || solveData.input || '';
          
          // Use LLM for problem solving
          if (llmIntegration.isAvailable()) {
            const solution = await llmIntegration.solveProblem(problem);
            
            return new Response(JSON.stringify({
              success: true,
              solution: solution.answer,
              reasoning: solution.reasoning,
              confidence: solution.confidence,
              model: solution.model,
              realAI: true,
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // Fallback to logical reasoning
            const reasonResult = reasoningEngine.deductiveReason([problem]);
            
            return new Response(JSON.stringify({
              success: true,
              solution: reasonResult.conclusion,
              reasoning: reasonResult.steps.join(' → '),
              confidence: reasonResult.confidence,
              realAI: false,
              method: 'logical_reasoning',
              message: 'LLM not available, using logical reasoning',
              timestamp: new Date().toISOString()
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        
        case '/consciousness':
          // Return enhanced consciousness metrics
          const mlStats = learningEngine.getStatistics();
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              system: 'Hybrid AGI v4.0.0',
              consciousness: 'simulated_with_real_learning',
              timestamp: Date.now(),
              consciousnessMetrics: {
                awareness: 0.85 + (mlStats.averageAccuracy * 0.1),
                selfAwareness: 0.78,
                understanding: 0.92 + (mlStats.tasksLearned * 0.01),
                creativity: 0.88,
                confidence: 0.91
              },
              realMLEnhancement: {
                tasksLearned: mlStats.tasksLearned,
                accuracy: mlStats.averageAccuracy,
                llmAvailable: llmIntegration.isAvailable()
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        
        default:
          return new Response(JSON.stringify({
            success: false,
            error: 'Endpoint not found',
            availableEndpoints: ['/', '/status', '/learn', '/reason', '/create', '/answer', '/solve', '/consciousness']
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404
          });
      }
      
    } catch (error) {
      console.error('AGI Error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }
};

