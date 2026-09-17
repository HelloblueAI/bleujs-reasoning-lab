/**
 * Evaluation adapter over the shared NVIDIA chat transport.
 *
 * Grading only ever sees the final answer: the reasoning trace is measured but
 * never scored, and a response that spent its whole budget thinking is reported
 * as a truncation error instead of being graded as if the trace were the answer.
 */

import { NvidiaApiError, nvidiaChatCompletion } from "@/routing/nvidiaChat";
import type { ResolvedEvalModel } from "./evalModelConfig";

/** Graders match on the text after this marker, so keep prompts asking for it. */
export const FINAL_ANSWER_MARKER = "FINAL:";

export interface ModelAttempt {
  /** Extracted final answer, or null when nothing gradeable came back. */
  answer: string | null;
  /** Full answer text (thinking removed) for report context. */
  content: string;
  reasoningChars: number;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  truncated: boolean;
  error: string | null;
  /**
   * True when the endpoint never produced a response (rate limit, overload).
   * These are excluded from scoring — they say nothing about the model.
   */
  inconclusive: boolean;
  /** Server-advised retry delay, when the endpoint sent one. */
  retryAfterMs: number | null;
}

/**
 * Takes the text after the last FINAL: marker, tolerating models that restate
 * the marker inside a summary. Falls back to the last non-empty line.
 */
export function extractFinalAnswer(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const marker = trimmed.toUpperCase().lastIndexOf(FINAL_ANSWER_MARKER);
  const tail =
    marker >= 0
      ? trimmed.slice(marker + FINAL_ANSWER_MARKER.length)
      : (trimmed
          .split("\n")
          .filter((line) => line.trim())
          .pop() ?? "");

  const answer = tail.split("\n")[0]?.replace(/[*`]/g, "").trim();
  return answer ? answer : null;
}

/** The free hosted endpoint is shared, so rate limits are expected, not failures. */
const MAX_TRANSPORT_ATTEMPTS = 7;
const BASE_BACKOFF_MS = 1500;

interface TransportFailure {
  message: string;
  transient: boolean;
  retryAfterMs: number | null;
}

function classify(error: unknown): TransportFailure {
  if (error instanceof NvidiaApiError) {
    return {
      message: error.message,
      transient: error.isTransient,
      retryAfterMs: error.retryAfterMs,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    message,
    transient: /timeout|ECONNRESET|fetch failed|socket hang up/i.test(message),
    retryAfterMs: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter so parallel workers don't retry in lockstep. */
function backoffMs(retry: number, advised: number | null): number {
  const base = advised ?? BASE_BACKOFF_MS * 2 ** (retry - 1);
  return base + Math.random() * 500;
}

async function askOnce(
  model: ResolvedEvalModel,
  prompt: { system: string; user: string },
): Promise<ModelAttempt> {
  const { config, apiKey } = model;
  const started = Date.now();

  try {
    const result = await nvidiaChatCompletion({
      apiKey,
      model: config.model,
      ...(config.chatUrl ? { chatUrl: config.chatUrl } : {}),
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      topP: config.topP,
      enableThinking: config.reasoning !== "off",
      ...(config.reasoning === "low" ? { lowEffort: true } : {}),
    });

    const answer = extractFinalAnswer(result.content);
    const error =
      answer === null
        ? result.truncated
          ? `truncated after ${config.maxTokens} tokens with no final answer`
          : "no final answer in response"
        : null;

    return {
      answer,
      content: result.content,
      reasoningChars: result.reasoning.length,
      latencyMs: result.latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      truncated: result.truncated,
      error,
      inconclusive: false,
      retryAfterMs: null,
    };
  } catch (error) {
    const failure = classify(error);
    return {
      answer: null,
      content: "",
      reasoningChars: 0,
      latencyMs: Date.now() - started,
      promptTokens: null,
      completionTokens: null,
      truncated: false,
      error: failure.message,
      inconclusive: failure.transient,
      retryAfterMs: failure.retryAfterMs,
    };
  }
}

export async function askEvalModel(
  model: ResolvedEvalModel,
  prompt: { system: string; user: string },
): Promise<ModelAttempt> {
  let attempt = await askOnce(model, prompt);

  for (let retry = 1; retry < MAX_TRANSPORT_ATTEMPTS; retry++) {
    if (!attempt.inconclusive) break;
    await sleep(backoffMs(retry, attempt.retryAfterMs));
    attempt = await askOnce(model, prompt);
  }

  return attempt;
}
