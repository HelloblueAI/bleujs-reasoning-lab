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
  /** The request exceeded its timeout rather than being refused. */
  timedOut: boolean;
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
const MAX_RATE_LIMIT_RETRIES = 6;
/**
 * A stalled request already cost a full timeout, and an endpoint that stops
 * responding rarely recovers mid-run, so retry it once rather than six times.
 */
const MAX_TIMEOUT_RETRIES = 1;
const BASE_BACKOFF_MS = 1500;

interface TransportFailure {
  message: string;
  transient: boolean;
  /** Timeouts get far fewer retries than rate limits. */
  timedOut: boolean;
  retryAfterMs: number | null;
}

function classify(error: unknown): TransportFailure {
  if (error instanceof NvidiaApiError) {
    return {
      message: error.message,
      transient: error.isTransient,
      timedOut: false,
      retryAfterMs: error.retryAfterMs,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  // AbortSignal.timeout surfaces as TimeoutError; retry it, and if the endpoint
  // keeps stalling record it as inconclusive rather than as a wrong answer.
  const name = error instanceof Error ? error.name : "";
  const timedOut = name === "TimeoutError" || /timeout|abort/i.test(message);
  return {
    message: timedOut ? `request timed out: ${message}` : message,
    transient:
      timedOut || /ECONNRESET|fetch failed|socket hang up/i.test(message),
    timedOut,
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
      signal: AbortSignal.timeout(config.timeoutMs),
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
      timedOut: false,
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
      timedOut: failure.timedOut,
      retryAfterMs: failure.retryAfterMs,
    };
  }
}

export async function askEvalModel(
  model: ResolvedEvalModel,
  prompt: { system: string; user: string },
): Promise<ModelAttempt> {
  let attempt = await askOnce(model, prompt);
  // Counted separately: a run that hits a rate limit and then stalls must still
  // get its timeout retry, rather than inheriting the exhausted 429 budget.
  let timeoutRetries = 0;
  let rateLimitRetries = 0;

  while (attempt.inconclusive) {
    if (attempt.timedOut) {
      if (timeoutRetries >= MAX_TIMEOUT_RETRIES) break;
      timeoutRetries++;
    } else {
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) break;
      rateLimitRetries++;
    }
    await sleep(
      backoffMs(timeoutRetries + rateLimitRetries, attempt.retryAfterMs),
    );
    attempt = await askOnce(model, prompt);
  }

  return attempt;
}
