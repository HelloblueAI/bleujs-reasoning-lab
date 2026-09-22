/**
 * /reason response — answer first, nothing operational.
 *
 * Which provider answered, provider "confidence" constants, and upstream error
 * text are deliberately absent: together they map the live routing chain and
 * can carry upstream response bodies. They are recorded server-side (logs and
 * the token-gated /metrics) instead.
 */

import { LAB_NAME, LAB_VERSION } from "@/metrics/labStatus";
import type { ReasonProvider } from "@/metrics/requestCounters";

/** Where the answer came from, at the granularity that is safe to publish. */
export type ReasonAnswerSource = "local-arithmetic" | "model";

export type ReasonErrorCode =
  | "model_not_configured"
  | "model_rate_limited"
  | "model_temporarily_unavailable"
  | "model_unavailable";

export type ReasonError = {
  code: ReasonErrorCode;
  retryable: boolean;
};

export type HonestReasonResponse = {
  system: string;
  version: string;
  input: string;
  answer: string | null;
  llmUsed: boolean;
  answerSource: ReasonAnswerSource | null;
  error: ReasonError | null;
  processingTimeMs: number;
};

export function toAnswerSource(
  provider: ReasonProvider | null | undefined,
): ReasonAnswerSource | null {
  if (!provider || provider === "none") return null;
  return provider === "local" ? "local-arithmetic" : "model";
}

const RETRYABLE_UPSTREAM_STATUSES = new Set([502, 503, 504, 522, 523, 524]);

/**
 * Reduces a provider failure to a fixed public code. The upstream message is
 * never returned — it can contain response bodies, hostnames, or quota details.
 */
export function toPublicReasonError(error: unknown): ReasonError {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = Number(/API error: (\d{3})\b/.exec(message)?.[1]);
  if (status === 429) {
    return { code: "model_rate_limited", retryable: true };
  }
  if (RETRYABLE_UPSTREAM_STATUSES.has(status)) {
    return { code: "model_temporarily_unavailable", retryable: true };
  }
  return { code: "model_unavailable", retryable: false };
}

export const MODEL_NOT_CONFIGURED: ReasonError = {
  code: "model_not_configured",
  retryable: false,
};

export function buildHonestReasonResponse(params: {
  input: string;
  answer: string | null;
  llmUsed: boolean;
  llmProvider?: ReasonProvider | null;
  error?: ReasonError | null;
  processingTimeMs: number;
}): HonestReasonResponse {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    input: params.input,
    answer: params.answer,
    llmUsed: params.llmUsed,
    answerSource: toAnswerSource(params.llmProvider),
    error: params.error ?? null,
    processingTimeMs: params.processingTimeMs,
  };
}
