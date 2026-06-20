/**
 * Real LLM Integration for Cloudflare Workers
 * Uses direct fetch calls to Claude and GPT APIs for genuine language understanding
 */

export interface LLMResponse {
  answer: string;
  confidence: number;
  model?: string; // Hidden from user responses
  reasoning?: string;
}

/** Default Claude model — pinned snapshot ID per Anthropic docs */
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
const DEFAULT_OPENAI_MODEL = 'gpt-4o';

export class RealLLMIntegration {
  private anthropicKey: string | undefined;
  private openaiKey: string | undefined;
  private claudeModel: string;
  private openaiModel: string;

  constructor(anthropicKey?: string, openaiKey?: string, claudeModel = DEFAULT_CLAUDE_MODEL, openaiModel = DEFAULT_OPENAI_MODEL) {
    this.anthropicKey = anthropicKey;
    this.openaiKey = openaiKey;
    this.claudeModel = claudeModel;
    this.openaiModel = openaiModel;
  }

  /**
   * Query Claude AI using direct fetch
   */
  private async queryClaude(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.anthropicKey) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.claudeModel,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: prompt
          }],
          ...(systemPrompt ? { system: systemPrompt } : {})
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      const content = data.content[0]?.text || 'No response';

      return {
        answer: content,
        confidence: 0.9
        // model name hidden from user
      };
    } catch (error) {
      throw new Error(`Claude query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Query OpenAI GPT using direct fetch
   */
  private async queryGPT(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          model: this.openaiModel,
          messages,
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      const content = data.choices[0]?.message?.content || 'No response';

      return {
        answer: content,
        confidence: 0.85
        // model name hidden from user
      };
    } catch (error) {
      throw new Error(`GPT query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Answer a question using the best available LLM
   */
  public async answerQuestion(question: string): Promise<LLMResponse> {
    let lastError: Error | undefined;

    if (this.anthropicKey) {
      try {
        return await this.queryClaude(
          question,
          'You are a helpful AI assistant integrated into a Hybrid Reasoning System. Provide clear, accurate, and thoughtful responses.'
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error('Claude failed:', lastError.message);
      }
    }

    if (this.openaiKey) {
      return await this.queryGPT(
        question,
        'You are a helpful AI assistant integrated into a Hybrid Reasoning System. Provide clear, accurate, and thoughtful responses.'
      );
    }

    throw lastError ?? new Error('No LLM API keys configured');
  }

  /**
   * Generate creative content using LLM
   */
  public async generateCreative(prompt: string, type: string = 'text'): Promise<LLMResponse> {
    const systemPrompt = `You are a creative AI assistant. Generate ${type} based on the user's prompt. Be imaginative and innovative.`;

    if (this.anthropicKey) {
      try {
        return await this.queryClaude(prompt, systemPrompt);
      } catch (error) {
        console.error('Claude creative generation failed:', error);
      }
    }

    if (this.openaiKey) {
      return await this.queryGPT(prompt, systemPrompt);
    }

    throw new Error('No LLM API keys configured');
  }

  /**
   * Solve a problem using LLM reasoning
   */
  public async solveProblem(problem: string): Promise<LLMResponse> {
    const systemPrompt = 'You are a problem-solving AI. Break down the problem, analyze it systematically, and provide a clear solution with reasoning steps.';

    if (this.anthropicKey) {
      try {
        const result = await this.queryClaude(problem, systemPrompt);
        result.reasoning = 'Step-by-step logical analysis using Claude AI';
        return result;
      } catch (error) {
        console.error('Claude problem solving failed:', error);
      }
    }

    if (this.openaiKey) {
      const result = await this.queryGPT(problem, systemPrompt);
      result.reasoning = 'Step-by-step logical analysis using GPT-4';
      return result;
    }

    throw new Error('No LLM API keys configured');
  }

  /**
   * Analyze data using LLM
   */
  public async analyzeData(data: string, question: string): Promise<LLMResponse> {
    const prompt = `Data: ${data}\n\nQuestion: ${question}\n\nProvide a detailed analysis.`;
    const systemPrompt = 'You are a data analysis AI. Examine the data carefully and provide insights based on the question asked.';

    if (this.anthropicKey) {
      try {
        return await this.queryClaude(prompt, systemPrompt);
      } catch (error) {
        console.error('Claude analysis failed:', error);
      }
    }

    if (this.openaiKey) {
      return await this.queryGPT(prompt, systemPrompt);
    }

    throw new Error('No LLM API keys configured');
  }

  /**
   * Check if LLM is available
   */
  public isAvailable(): boolean {
    return !!(this.anthropicKey || this.openaiKey);
  }

  /**
   * Get available models
   */
  public getAvailableModels(): string[] {
    const models: string[] = [];
    if (this.anthropicKey) models.push(this.claudeModel);
    if (this.openaiKey) models.push(this.openaiModel);
    return models;
  }
}

