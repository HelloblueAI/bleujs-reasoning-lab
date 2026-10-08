/**
 * Capability contract: compare one recorded model configuration to a few
 * numeric requirements. This does not call a provider, deploy, or repair
 * anything. A missing measurement fails that requirement.
 */

export const QUALIFIED = "QUALIFIED";
export const NOT_QUALIFIED = "NOT QUALIFIED";

export type QualificationStatus = typeof QUALIFIED | typeof NOT_QUALIFIED;

export type RequirementId =
  "hard-tier-score" | "latency-p50" | "tool-selection" | "no-regression";

export interface CapabilityContract {
  id: string;
  /** Recorded configuration whose hard-tier score is the regression baseline. */
  baseline: { model: string; reasoning: string };
  /** Minimum `tierScores.hard.score`. */
  minHardScore: number;
  /** Maximum latency p50, applied only at `requiredConcurrency`. */
  maxLatencyP50Ms: number;
  requiredConcurrency: number;
  /** Minimum hard-tier tool-selection score. */
  minToolSelectionScore: number;
  /**
   * Largest drop from the baseline hard-tier score that still passes.
   * One or two items on a 45-item tier is about 0.05, which this lab already
   * treats as a tie.
   */
  maxHardScoreDrop: number;
}

/** Fields read from a committed comparison variant. Null means not recorded. */
export interface CandidateMeasurement {
  model: string;
  reasoning: string;
  gitSha: string | null;
  concurrency: number | null;
  hardScore: number | null;
  latencyP50Ms: number | null;
  toolSelectionHardScore: number | null;
}

export interface RequirementResult {
  id: RequirementId;
  pass: boolean;
  /**
   * False when this run does not contain the measurement, so the threshold
   * was not applied. A false pass is then a gap in the record, not a miss.
   */
  compared: boolean;
  measured: number | null;
  rule: string;
  detail: string;
}

export type QualificationBasis = "measured" | "incomplete-record";

export interface Qualification {
  model: string;
  reasoning: string;
  gitSha: string | null;
  status: QualificationStatus;
  /**
   * `measured` means every failed requirement was compared with a recorded
   * value. `incomplete-record` means the run is NOT QUALIFIED because those
   * measurements were never recorded, not because the model missed a bar.
   */
  basis: QualificationBasis;
  summary: string;
  requirements: RequirementResult[];
}

export function requirementRules(
  contract: CapabilityContract,
): Array<{ id: RequirementId; rule: string }> {
  return [
    {
      id: "hard-tier-score",
      rule: `tierScores.hard.score >= ${contract.minHardScore}`,
    },
    {
      id: "latency-p50",
      rule: `latencyMs.p50 <= ${contract.maxLatencyP50Ms} at concurrency ${contract.requiredConcurrency}`,
    },
    {
      id: "tool-selection",
      rule: `hard tool-selection score >= ${contract.minToolSelectionScore}`,
    },
    {
      id: "no-regression",
      rule: `hard-tier score drops by at most ${contract.maxHardScoreDrop} from the baseline`,
    },
  ];
}

function hardScoreRequirement(
  contract: CapabilityContract,
  candidate: CandidateMeasurement,
): RequirementResult {
  const rule = requirementRules(contract)[0]!.rule;
  if (candidate.hardScore === null) {
    return {
      id: "hard-tier-score",
      pass: false,
      compared: false,
      measured: null,
      rule,
      detail: "hard-tier score was not recorded for this run",
    };
  }
  const pass = candidate.hardScore >= contract.minHardScore;
  return {
    id: "hard-tier-score",
    pass,
    compared: true,
    measured: candidate.hardScore,
    rule,
    detail: pass
      ? "meets the minimum hard-tier score"
      : "below the minimum hard-tier score",
  };
}

function latencyRequirement(
  contract: CapabilityContract,
  candidate: CandidateMeasurement,
): RequirementResult {
  const rule = requirementRules(contract)[1]!.rule;
  if (candidate.concurrency !== contract.requiredConcurrency) {
    return {
      id: "latency-p50",
      pass: false,
      compared: false,
      measured: candidate.latencyP50Ms,
      rule,
      detail:
        candidate.concurrency === null
          ? `concurrency was not recorded, so p50 was not compared with ${contract.maxLatencyP50Ms}ms`
          : `recorded at concurrency ${candidate.concurrency}, so p50 was not compared with the concurrency-${contract.requiredConcurrency} threshold`,
    };
  }
  if (candidate.latencyP50Ms === null) {
    return {
      id: "latency-p50",
      pass: false,
      compared: false,
      measured: null,
      rule,
      detail: "latency p50 was not recorded for this run",
    };
  }
  const pass = candidate.latencyP50Ms <= contract.maxLatencyP50Ms;
  return {
    id: "latency-p50",
    pass,
    compared: true,
    measured: candidate.latencyP50Ms,
    rule,
    detail: pass
      ? "p50 is within the maximum at the required concurrency"
      : "p50 is above the maximum at the required concurrency",
  };
}

function toolRequirement(
  contract: CapabilityContract,
  candidate: CandidateMeasurement,
): RequirementResult {
  const rule = requirementRules(contract)[2]!.rule;
  if (candidate.toolSelectionHardScore === null) {
    return {
      id: "tool-selection",
      pass: false,
      compared: false,
      measured: null,
      rule,
      detail: "hard-tier tool-selection score was not recorded for this run",
    };
  }
  const pass =
    candidate.toolSelectionHardScore >= contract.minToolSelectionScore;
  return {
    id: "tool-selection",
    pass,
    compared: true,
    measured: candidate.toolSelectionHardScore,
    rule,
    detail: pass
      ? "meets the minimum hard-tier tool-selection score"
      : "below the minimum hard-tier tool-selection score",
  };
}

function regressionRequirement(
  contract: CapabilityContract,
  candidate: CandidateMeasurement,
  baselineHardScore: number,
): RequirementResult {
  const rule = requirementRules(contract)[3]!.rule;
  if (candidate.hardScore === null) {
    return {
      id: "no-regression",
      pass: false,
      compared: false,
      measured: null,
      rule,
      detail:
        "hard-tier score was not recorded, so regression was not computed",
    };
  }
  const drop = baselineHardScore - candidate.hardScore;
  const pass = drop <= contract.maxHardScoreDrop;
  return {
    id: "no-regression",
    pass,
    compared: true,
    measured: candidate.hardScore,
    rule,
    detail: pass
      ? "hard-tier score is within the allowed drop from the baseline"
      : "hard-tier score drops more than the allowed amount from the baseline",
  };
}

const INCOMPLETE_RECORD_SUMMARY =
  "NOT QUALIFIED because this committed run does not include measurements the contract requires. This is not a finding that the model missed a quality or latency bar.";

const MEASURED_MISS_SUMMARY =
  "NOT QUALIFIED because a recorded measurement missed a contract threshold.";

export function qualificationBasis(
  requirements: readonly RequirementResult[],
): QualificationBasis {
  const failures = requirements.filter((requirement) => !requirement.pass);
  if (
    failures.length > 0 &&
    failures.every((requirement) => !requirement.compared)
  ) {
    return "incomplete-record";
  }
  return "measured";
}

export function evaluateCandidate(
  contract: CapabilityContract,
  candidate: CandidateMeasurement,
  baselineHardScore: number,
): Qualification {
  const requirements = [
    hardScoreRequirement(contract, candidate),
    latencyRequirement(contract, candidate),
    toolRequirement(contract, candidate),
    regressionRequirement(contract, candidate, baselineHardScore),
  ];
  const status = requirements.every((requirement) => requirement.pass)
    ? QUALIFIED
    : NOT_QUALIFIED;
  const basis = qualificationBasis(requirements);
  return {
    model: candidate.model,
    reasoning: candidate.reasoning,
    gitSha: candidate.gitSha,
    status,
    basis,
    summary:
      status === QUALIFIED
        ? "Every recorded requirement met the contract."
        : basis === "incomplete-record"
          ? INCOMPLETE_RECORD_SUMMARY
          : MEASURED_MISS_SUMMARY,
    requirements,
  };
}

export function baselineHardScore(
  contract: CapabilityContract,
  candidates: readonly CandidateMeasurement[],
): number {
  const baseline = candidates.find(
    (candidate) =>
      candidate.model === contract.baseline.model &&
      candidate.reasoning === contract.baseline.reasoning,
  );
  if (!baseline || baseline.hardScore === null) {
    throw new Error(
      `Baseline ${contract.baseline.model} (${contract.baseline.reasoning}) has no hard-tier score`,
    );
  }
  return baseline.hardScore;
}

export function evaluateContract(
  contract: CapabilityContract,
  candidates: readonly CandidateMeasurement[],
): Qualification[] {
  const baseline = baselineHardScore(contract, candidates);
  return candidates.map((candidate) =>
    evaluateCandidate(contract, candidate, baseline),
  );
}
