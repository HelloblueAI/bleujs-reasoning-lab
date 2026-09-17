/**
 * NVIDIA NIM chat transport (OpenAI-compatible Chat Completions).
 *
 * Shared by production routing (`RealLLMIntegration`) and the Reasoning Lab
 * evaluation adapter so both speak to the same endpoint with the same parsing.
 * Reasoning ("thinking") output is returned separately from the answer — callers
 * decide what to do with it rather than having it silently substituted.
 */

export const DEFAULT_NVIDIA_CHAT_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";

/** Carries the HTTP status so callers can distinguish rate limits from refusals. */
export class NvidiaApiError extends Error {
  readonly status: number;
  /** Server-advised wait from Retry-After, when present. */
  readonly retryAfterMs: number | null;

  constructor(status: number, body: string, retryAfterMs: number | null) {
    super(`NVIDIA API error: ${status} - ${body}`);
    this.name = "NvidiaApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  /** 429 and 5xx are endpoint capacity, not a model result. */
  get isTransient(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export interface NvidiaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaChatRequest {
  apiKey: string;
  model: string;
  messages: NvidiaChatMessage[];
  chatUrl?: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  /** Nemotron chat-template flag; reasoning is on by default server-side. */
  enableThinking: boolean;
  /**
   * Appends NVIDIA's low reasoning-effort instruction. Per NVIDIA's docs this
   * nudges toward shorter traces — it does not turn reasoning off, and is only
   * meaningful while `enableThinking` is true.
   */
  lowEffort?: boolean;
  signal?: AbortSignal;
}

export interface NvidiaChatResult {
  /** Final answer text with any inline <think> block removed. Empty if the
   *  model spent its whole budget reasoning. */
  content: string;
  /** Reasoning trace, from `reasoning_content` or an inline <think> block. */
  reasoning: string;
  finishReason: string | null;
  /** True when generation stopped on the token budget instead of finishing. */
  truncated: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
}

const THINK_BLOCK = /<think>([\s\S]*?)(?:<\/think>|$)/i;

/** Splits an inline <think>…</think> prelude from the final answer. */
function splitThinkBlock(raw: string): { answer: string; thought: string } {
  const match = THINK_BLOCK.exec(raw);
  if (!match) {
    return { answer: raw.trim(), thought: "" };
  }
  return {
    answer: raw.replace(THINK_BLOCK, "").trim(),
    thought: (match[1] ?? "").trim(),
  };
}

export async function nvidiaChatCompletion(
  request: NvidiaChatRequest,
): Promise<NvidiaChatResult> {
  if (!request.apiKey) {
    throw new Error("NVIDIA API key not configured");
  }

  const url = request.chatUrl?.trim() || DEFAULT_NVIDIA_CHAT_URL;
  const start = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stream: false,
      chat_template_kwargs: {
        enable_thinking: request.enableThinking,
        ...(request.lowEffort ? { low_effort: true } : {}),
      },
    }),
    ...(request.signal ? { signal: request.signal } : {}),
  });

  if (!response.ok) {
    const body = await response.text();
    const header = response.headers.get("retry-after");
    const retryAfter = header === null ? Number.NaN : Number(header);
    throw new NvidiaApiError(
      response.status,
      body,
      Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : null,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string; reasoning_content?: string };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = data.choices?.[0];
  const { answer, thought } = splitThinkBlock(choice?.message?.content ?? "");
  const reasoning = choice?.message?.reasoning_content?.trim() || thought;
  const finishReason = choice?.finish_reason ?? null;

  return {
    content: answer,
    reasoning,
    finishReason,
    truncated: finishReason === "length",
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    latencyMs: Date.now() - start,
  };
}
