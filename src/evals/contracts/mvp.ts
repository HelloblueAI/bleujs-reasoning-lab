import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateContract,
  requirementRules,
  type CandidateMeasurement,
  type CapabilityContract,
  type Qualification,
} from "./contract";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(here, "../results");

/**
 * First contract. Thresholds are deliberately few and come from measurements
 * this repo already commits:
 * - 0.90 hard-tier score was set from the earlier Super run. It is not moved
 *   after a rerun.
 * - 5000ms p50 was above that earlier Super reasoning-on measurement (3799ms).
 *   It is applied only when concurrency was recorded as 3, and it is not
 *   raised if a later run is slower.
 * - 0.80 hard tool-selection is the structured-result bar. The keyword router
 *   scores 0 on these hard items.
 * - 0.05 is the regression tolerance (about two items on this hard tier).
 */
export const REASONING_LAB_MVP: CapabilityContract = {
  id: "reasoning-lab-mvp",
  baseline: {
    model: "nvidia/nemotron-3-super-120b-a12b",
    reasoning: "on",
  },
  minHardScore: 0.9,
  maxLatencyP50Ms: 5000,
  requiredConcurrency: 3,
  minToolSelectionScore: 0.8,
  maxHardScoreDrop: 0.05,
};

export const CONTRACT_NOTE =
  "Computed from committed comparison files. No provider was called. " +
  "status NOT QUALIFIED with basis incomplete-record means the run is missing measurements, not that the model failed a quality or latency bar. " +
  "Super and Lightning were both scored on the current 46-item hard tier, including trap-h4, at concurrency 3. " +
  "The thresholds were not changed for this rerun. " +
  "The replaced Super files were labelled gitSha 519a226a; see the README provenance note.";

const COMPARISON_FILES = [
  "model-nvidia-nemotron-3-super-120b-a12b-comparison.json",
  "model-nvidia-nemotron-3-5-lightning-30b-a3b-comparison.json",
] as const;

interface RecordedVariant {
  reasoning?: unknown;
  gitSha?: unknown;
  config?: { concurrency?: unknown };
  tierScores?: { hard?: { score?: unknown } } | null;
  latencyMs?: { p50?: unknown };
  benchmarkHardScores?: { "tool-selection"?: unknown } | null;
}

interface RecordedComparison {
  model?: unknown;
  variants?: RecordedVariant[];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function measurementFromVariant(
  model: string,
  variant: RecordedVariant,
): CandidateMeasurement {
  return {
    model,
    reasoning: typeof variant.reasoning === "string" ? variant.reasoning : "",
    gitSha: typeof variant.gitSha === "string" ? variant.gitSha : null,
    concurrency: numberOrNull(variant.config?.concurrency),
    hardScore: numberOrNull(variant.tierScores?.hard?.score),
    latencyP50Ms: numberOrNull(variant.latencyMs?.p50),
    toolSelectionHardScore: numberOrNull(
      variant.benchmarkHardScores?.["tool-selection"],
    ),
  };
}

export function loadRecordedCandidates(
  dir: string = resultsDir,
): CandidateMeasurement[] {
  return COMPARISON_FILES.flatMap((file) => {
    const parsed = JSON.parse(
      readFileSync(resolve(dir, file), "utf8"),
    ) as RecordedComparison;
    if (typeof parsed.model !== "string" || !Array.isArray(parsed.variants)) {
      throw new Error(`${file} is missing model or variants`);
    }
    return parsed.variants.map((variant) =>
      measurementFromVariant(parsed.model as string, variant),
    );
  });
}

export interface ContractReport {
  contractId: string;
  note: string;
  baseline: {
    model: string;
    reasoning: string;
    gitSha: string | null;
    hardScore: number;
  };
  requirements: Array<{ id: string; rule: string }>;
  results: Qualification[];
}

export function buildContractReport(
  candidates: readonly CandidateMeasurement[] = loadRecordedCandidates(),
): ContractReport {
  const contract = REASONING_LAB_MVP;
  const baseline = candidates.find(
    (candidate) =>
      candidate.model === contract.baseline.model &&
      candidate.reasoning === contract.baseline.reasoning,
  );
  if (!baseline || baseline.hardScore === null) {
    throw new Error(
      "Baseline hard-tier score is not in the recorded candidates",
    );
  }
  return {
    contractId: contract.id,
    note: CONTRACT_NOTE,
    baseline: {
      model: baseline.model,
      reasoning: baseline.reasoning,
      gitSha: baseline.gitSha,
      hardScore: baseline.hardScore,
    },
    requirements: requirementRules(contract),
    results: evaluateContract(contract, candidates),
  };
}
