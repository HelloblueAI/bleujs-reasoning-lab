/**
 * Real LLM Integration for Cloudflare Workers
 * BleuJS API first, then NVIDIA Nemotron Lightning, then paid Anthropic/OpenAI.
 */

import { isClarificationOnlyResponse } from "./reasonPrompt";
import {
  DEFAULT_NVIDIA_CHAT_URL as NVIDIA_CHAT_URL,
  nvidiaChatCompletion,
  type NvidiaChatMessage,
} from "./nvidiaChat";

export type LLMProvider = "bleujs" | "nvidia" | "anthropic" | "openai";

export interface LLMResponse {
  answer: string;
  confidence: number;
  provider?: LLMProvider;
  model?: string;
  reasoning?: string;
}

export type NvidiaLLMOptions = {
  apiKey?: string;
  chatUrl?: string;
  model?: string;
};

export type RealLLMIntegrationOptions = {
  anthropicKey?: string | undefined;
  openaiKey?: string | undefined;
  claudeModel?: string | undefined;
  openaiModel?: string | undefined;
  bleujsKey?: string | undefined;
  bleujsChatUrl?: string | undefined;
  allowFallback?: boolean | undefined;
  nvidiaKey?: string | undefined;
  nvidiaChatUrl?: string | undefined;
  nvidiaModel?: string | undefined;
};

/** Default Claude model — pinned snapshot ID per Anthropic docs */
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_BLEUJS_CHAT_URL = "https://api.bleujs.org/api/v1/chat";
export const DEFAULT_NVIDIA_CHAT_URL = NVIDIA_CHAT_URL;
export const DEFAULT_NVIDIA_CHAT_MODEL =
  "nvidia/nemotron-3.5-lightning-30b-a3b";
const BLEUJS_MAX_ATTEMPTS = 5;

function isRetryableBleuJsStatus(status: number): boolean {
  return (
    status >= 500 ||
    status === 429 ||
    status === 522 ||
    status === 523 ||
    status === 524
  );
}

function bleuJsRetryDelayMs(attempt: number): number {
  return 400 * (attempt + 1);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class RealLLMIntegration {
  private bleujsKey: string | undefined;
  private anthropicKey: string | undefined;
  private openaiKey: string | undefined;
  private nvidiaKey: string | undefined;
  private claudeModel: string;
  private openaiModel: string;
  private nvidiaModel: string;
  private bleujsChatUrl: string;
  private nvidiaChatUrl: string;
  private allowFallback: boolean;

  static create(options: RealLLMIntegrationOptions): RealLLMIntegration {
    const nvidia: NvidiaLLMOptions = {};
    if (options.nvidiaKey) nvidia.apiKey = options.nvidiaKey;
    if (options.nvidiaChatUrl) nvidia.chatUrl = options.nvidiaChatUrl;
    if (options.nvidiaModel) nvidia.model = options.nvidiaModel;

    return new RealLLMIntegration(
      options.anthropicKey,
      options.openaiKey,
      options.claudeModel,
      options.openaiModel,
      options.bleujsKey,
      options.bleujsChatUrl,
      options.allowFallback ?? false,
      nvidia,
    );
  }

  constructor(
    anthropicKey?: string,
    openaiKey?: string,
    claudeModel = DEFAULT_CLAUDE_MODEL,
    openaiModel = DEFAULT_OPENAI_MODEL,
    bleujsKey?: string,
    bleujsChatUrl = DEFAULT_BLEUJS_CHAT_URL,
    allowFallback = false,
    nvidia?: NvidiaLLMOptions,
  ) {
    this.anthropicKey = anthropicKey;
    this.openaiKey = openaiKey;
    this.claudeModel = claudeModel ?? DEFAULT_CLAUDE_MODEL;
    this.openaiModel = openaiModel ?? DEFAULT_OPENAI_MODEL;
    this.bleujsKey = bleujsKey;
    this.bleujsChatUrl = bleujsChatUrl?.trim() || DEFAULT_BLEUJS_CHAT_URL;
    this.allowFallback = allowFallback;
    this.nvidiaKey = nvidia?.apiKey;
    this.nvidiaChatUrl = nvidia?.chatUrl?.trim() || DEFAULT_NVIDIA_CHAT_URL;
    this.nvidiaModel = nvidia?.model?.trim() || DEFAULT_NVIDIA_CHAT_MODEL;
  }

  private async queryBleuJS(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 1024,
  ): Promise<LLMResponse> {
    if (!this.bleujsKey) {
      throw new Error("BleuJS API key not configured");
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < BLEUJS_MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await fetch(this.bleujsChatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.bleujsKey}`,
          },
          body: JSON.stringify({
            model: "bleujs-chat",
            messages,
            max_tokens: maxTokens,
          }),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < BLEUJS_MAX_ATTEMPTS - 1) {
          await sleep(bleuJsRetryDelayMs(attempt));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const error = await response.text();
        const apiError = new Error(
          `BleuJS API error: ${response.status} - ${error}`,
        );
        if (
          attempt < BLEUJS_MAX_ATTEMPTS - 1 &&
          isRetryableBleuJsStatus(response.status)
        ) {
          lastError = apiError;
          await sleep(bleuJsRetryDelayMs(attempt));
          continue;
        }
        throw apiError;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content || "No response";

      return {
        answer: content,
        confidence: 0.9,
        provider: "bleujs",
      };
    }

    throw lastError ?? new Error("BleuJS request failed");
  }

  /**
   * Query Claude AI using direct fetch
   */
  private async queryClaude(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 1024,
  ): Promise<LLMResponse> {
    if (!this.anthropicKey) {
      throw new Error("Anthropic API key not configured");
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.claudeModel,
          max_tokens: maxTokens,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          ...(systemPrompt ? { system: systemPrompt } : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ text?: string }>;
      };
      const content = data.content?.[0]?.text || "No response";

      return {
        answer: content,
        confidence: 0.9,
        provider: "anthropic",
      };
    } catch (error) {
      throw new Error(
        `Claude query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Query OpenAI GPT using direct fetch
   */
  private async queryGPT(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 1024,
  ): Promise<LLMResponse> {
    if (!this.openaiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];

      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({ role: "user", content: prompt });

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.openaiKey}`,
          },
          body: JSON.stringify({
            model: this.openaiModel,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content || "No response";

      return {
        answer: content,
        confidence: 0.85,
        provider: "openai",
        model: this.openaiModel,
      };
    } catch (error) {
      throw new Error(
        `GPT query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * NVIDIA NIM chat — Nemotron 3.5 Lightning (Inception free endpoint).
   * Thinking is off so fallback stays latency-cheap for /reason.
   */
  private async queryNvidia(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 1024,
  ): Promise<LLMResponse> {
    if (!this.nvidiaKey) {
      throw new Error("NVIDIA API key not configured");
    }

    const messages: NvidiaChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    try {
      const result = await nvidiaChatCompletion({
        apiKey: this.nvidiaKey,
        chatUrl: this.nvidiaChatUrl,
        model: this.nvidiaModel,
        messages,
        maxTokens,
        temperature: 0.6,
        topP: 0.95,
        enableThinking: false,
      });

      return {
        answer: result.content || result.reasoning || "No response",
        confidence: 0.88,
        provider: "nvidia",
        model: this.nvidiaModel,
      };
    } catch (error) {
      throw new Error(
        `NVIDIA query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async queryWithFallback(
    prompt: string,
    systemPrompt: string,
    maxTokens: number,
    qualityCheckInput?: string,
  ): Promise<LLMResponse> {
    let lastError: Error | undefined;

    if (this.bleujsKey) {
      try {
        const result = await this.queryBleuJS(prompt, systemPrompt, maxTokens);
        if (
          !qualityCheckInput ||
          !isClarificationOnlyResponse(result.answer, qualityCheckInput)
        ) {
          return result;
        }
        if (!this.allowFallback) {
          return result;
        }
        console.warn(
          "BleuJS returned clarification-only response, trying fallback",
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error("BleuJS failed:", lastError.message);
      }

      if (!this.allowFallback) {
        throw (
          lastError ??
          new Error("BleuJS request failed and LLM fallback is disabled")
        );
      }
    }

    if (this.nvidiaKey) {
      try {
        return await this.queryNvidia(prompt, systemPrompt, maxTokens);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error("NVIDIA failed:", lastError.message);
      }
    }

    if (this.anthropicKey) {
      try {
        return await this.queryClaude(prompt, systemPrompt, maxTokens);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error("Claude failed:", lastError.message);
      }
    }

    if (this.openaiKey) {
      return await this.queryGPT(prompt, systemPrompt, maxTokens);
    }

    throw lastError ?? new Error("No LLM API keys configured");
  }

  /**
   * Answer a question using the best available LLM
   */
  public async answerQuestion(
    question: string,
    options?: { systemPrompt?: string; maxTokens?: number },
  ): Promise<LLMResponse> {
    const systemPrompt =
      options?.systemPrompt ??
      "You are BleuJS Reasoning. Provide clear, accurate, thoughtful responses.";
    const maxTokens = options?.maxTokens ?? 1024;
    return this.queryWithFallback(question, systemPrompt, maxTokens, question);
  }

  /**
   * Generate creative content using LLM
   */
  public async generateCreative(
    prompt: string,
    type: string = "text",
  ): Promise<LLMResponse> {
    const systemPrompt = `You are a creative AI assistant. Generate ${type} based on the user's prompt. Be imaginative and innovative.`;
    return this.queryWithFallback(prompt, systemPrompt, 1024);
  }

  /**
   * Solve a problem using LLM reasoning
   */
  public async solveProblem(problem: string): Promise<LLMResponse> {
    const systemPrompt =
      "You are a problem-solving AI. Break down the problem, analyze it systematically, and provide a clear solution with reasoning steps.";
    const result = await this.queryWithFallback(problem, systemPrompt, 1024);
    result.reasoning = "Step-by-step logical analysis";
    return result;
  }

  /**
   * Analyze data using LLM
   */
  public async analyzeData(
    data: string,
    question: string,
  ): Promise<LLMResponse> {
    const prompt = `Data: ${data}\n\nQuestion: ${question}\n\nProvide a detailed analysis.`;
    const systemPrompt =
      "You are a data analysis AI. Examine the data carefully and provide insights based on the question asked.";
    return this.queryWithFallback(prompt, systemPrompt, 1024);
  }

  /**
   * Check if LLM is available
   */
  public isAvailable(): boolean {
    return !!(
      this.bleujsKey ||
      this.nvidiaKey ||
      this.anthropicKey ||
      this.openaiKey
    );
  }

  /**
   * Get available models
   */
  public getAvailableModels(): string[] {
    const models: string[] = [];
    if (this.bleujsKey) models.push("bleujs-chat");
    if (this.nvidiaKey) models.push(this.nvidiaModel);
    if (this.anthropicKey) models.push(this.claudeModel);
    if (this.openaiKey) models.push(this.openaiModel);
    return models;
  }
}
