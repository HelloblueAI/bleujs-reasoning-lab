/**
 * Honest /reason response — answer-first, no quantum theater.
 */

import { LAB_NAME, LAB_VERSION } from './labStatus';

export type HonestReasonResponse = {
  system: string;
  version: string;
  measured: true;
  input: string;
  answer: string | null;
  confidence: number;
  llmUsed: boolean;
  processingTimeMs: number;
  understanding: {
    conceptCount: number;
    domains: string[];
    relationshipCount: number;
    insights: string[];
  } | null;
};

export function buildHonestReasonResponse(params: {
  input: string;
  answer: string | null;
  confidence: number;
  llmUsed: boolean;
  processingTimeMs: number;
  understanding: {
    concepts: { name: string }[];
    domains: string[];
    relationships: unknown[];
    insights: string[];
  } | null;
}): HonestReasonResponse {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    measured: true,
    input: params.input,
    answer: params.answer,
    confidence: params.confidence,
    llmUsed: params.llmUsed,
    processingTimeMs: params.processingTimeMs,
    understanding: params.understanding
      ? {
          conceptCount: params.understanding.concepts.length,
          domains: params.understanding.domains,
          relationshipCount: params.understanding.relationships.length,
          insights: params.understanding.insights.slice(0, 5),
        }
      : null,
  };
}
