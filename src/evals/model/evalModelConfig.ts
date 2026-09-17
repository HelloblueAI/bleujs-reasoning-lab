/**
 * Evaluation-only model configuration for the Reasoning Lab.
 *
 * Deliberately reads its own environment variables. `NVIDIA_API_KEY` /
 * `NVIDIA_CHAT_MODEL` drive the Worker's production `/reason` fallback chain and
 * are never consulted here, so adding an eval model cannot change what
 * production serves.
 */

export const EVAL_ENV_API_KEY = "NVIDIA_EVAL_API_KEY";
export const EVAL_ENV_MODEL = "NVIDIA_EVAL_CHAT_MODEL";
export const EVAL_ENV_CHAT_URL = "NVIDIA_EVAL_CHAT_URL";

/** NVIDIA's reasoning/agentic model in this tier: 120B total, ~12B active. */
export const DEFAULT_EVAL_MODEL = "nvidia/nemotron-3-super-120b-a12b";

/**
 * NVIDIA's documented reasoning settings for Nemotron 3 Super. The token budget
 * matches NVIDIA's own examples — a 1k budget truncates the thinking trace and
 * leaves no room for the answer.
 */
export const NVIDIA_REASONING_TEMPERATURE = 1.0;
export const NVIDIA_REASONING_TOP_P = 0.95;
export const DEFAULT_EVAL_MAX_TOKENS = 16000;

export type ReasoningMode = "on" | "off";

export interface EvalModelConfig {
  provider: "nvidia";
  model: string;
  chatUrl: string | undefined;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoning: ReasoningMode;
  /** Repeats per item; sampled decoding is not deterministic. */
  runs: number;
}

export interface ResolvedEvalModel {
  apiKey: string;
  config: EvalModelConfig;
}

export interface EvalModelOverrides {
  model?: string | undefined;
  reasoning?: ReasoningMode | undefined;
  maxTokens?: number | undefined;
  runs?: number | undefined;
  temperature?: number | undefined;
  topP?: number | undefined;
}

/** Human-readable label for reports, e.g. "…-super-120b-a12b (thinking on)". */
export function describeEvalModel(config: EvalModelConfig): string {
  return `${config.model} (thinking ${config.reasoning})`;
}

export function resolveEvalModel(
  env: Record<string, string | undefined>,
  overrides: EvalModelOverrides = {},
): ResolvedEvalModel {
  const apiKey = env[EVAL_ENV_API_KEY]?.trim();
  if (!apiKey) {
    throw new Error(
      `${EVAL_ENV_API_KEY} is not set. The evaluation model uses its own ` +
        `credential and never falls back to NVIDIA_API_KEY (production routing).`,
    );
  }

  const runs = overrides.runs ?? 1;
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`runs must be a positive integer, got ${overrides.runs}`);
  }

  return {
    apiKey,
    config: {
      provider: "nvidia",
      model:
        overrides.model?.trim() ||
        env[EVAL_ENV_MODEL]?.trim() ||
        DEFAULT_EVAL_MODEL,
      chatUrl: env[EVAL_ENV_CHAT_URL]?.trim() || undefined,
      temperature: overrides.temperature ?? NVIDIA_REASONING_TEMPERATURE,
      topP: overrides.topP ?? NVIDIA_REASONING_TOP_P,
      maxTokens: overrides.maxTokens ?? DEFAULT_EVAL_MAX_TOKENS,
      reasoning: overrides.reasoning ?? "on",
      runs,
    },
  };
}
