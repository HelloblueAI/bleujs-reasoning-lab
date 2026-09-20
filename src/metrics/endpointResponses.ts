/**
 * API payloads for the production worker.
 *
 * Scope note: this used to also build `/learn`, `/create` and `/goals`
 * responses. Those endpoints were removed because nothing behind them learned,
 * created, or pursued a goal — they reported state from an in-process toy
 * network that never touched a user's answer.
 */

import type { BenchmarkSummary } from "@/metrics/labStatus";
import { LAB_NAME, LAB_VERSION } from "./labStatus";

export function buildCapabilitiesEndpointPayload(
  benchmarks: BenchmarkSummary | null,
  llmAvailable: boolean,
) {
  return {
    system: LAB_NAME,
    version: LAB_VERSION,
    timestamp: Date.now(),
    note: "Capabilities are reported as scores on fixed, published datasets. Reproduce with `pnpm run eval` at the recorded gitSha.",
    llmAvailable,
    benchmarks,
    datasets: "src/evals/benchmarks/datasets.ts",
    limitations: [
      "The offline suite scores deterministic baselines, not a hosted model. Model scores come from `pnpm run eval:model` and are committed per variant under src/evals/results/.",
      "Datasets are small (tens of items per benchmark), so differences of one or two items are not statistically meaningful.",
    ],
  };
}
