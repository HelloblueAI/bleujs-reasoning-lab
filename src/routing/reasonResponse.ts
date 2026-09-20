/**
 * /reason response — answer first, provenance second, nothing else.
 *
 * `confidence` is whatever the answering provider reported, or null for the
 * local arithmetic path. It is not a lab-computed score, so callers should not
 * read it as a quality judgement.
 */

import { LAB_NAME, LAB_VERSION } from "@/metrics/labStatus";
import type { ReasonProvider } from "@/metrics/requestCounters";

export type HonestReasonResponse = {
  system: string;
  version: string;
  input: string;
  answer: string | null;
  /** Provider-reported confidence, or null when no provider supplied one. */
  confidence: number | null;
  llmUsed: boolean;
  llmProvider: ReasonProvider | null;
  llmError: string | null;
  processingTimeMs: number;
};

export function buildHonestReasonResponse(params: {
  input: string;
  answer: string | null;
  confidence: number | null;
  llmUsed: boolean;
  llmProvider?: ReasonProvider | null;
  llmError?: string | null;
  processingTimeMs: number;
}): HonestReasonResponse {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    input: params.input,
    answer: params.answer,
    confidence: params.confidence,
    llmUsed: params.llmUsed,
    llmProvider: params.llmProvider ?? null,
    llmError: params.llmError ?? null,
    processingTimeMs: params.processingTimeMs,
  };
}
