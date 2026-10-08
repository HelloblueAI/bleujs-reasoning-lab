import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateCandidate,
  NOT_QUALIFIED,
  QUALIFIED,
} from "@/evals/contracts/contract";
import {
  buildContractReport,
  loadRecordedCandidates,
  REASONING_LAB_MVP,
} from "@/evals/contracts/mvp";
import type { CandidateMeasurement } from "@/evals/contracts/contract";

const contract = REASONING_LAB_MVP;
const baselineHardScore = 0.9555555555555556;

function candidate(
  overrides: Partial<CandidateMeasurement> = {},
): CandidateMeasurement {
  return {
    model: "example/model",
    reasoning: "on",
    gitSha: "abc1234",
    concurrency: 3,
    hardScore: 0.96,
    latencyP50Ms: 1000,
    toolSelectionHardScore: 0.9,
    ...overrides,
  };
}

describe("capability contract qualification", () => {
  it("qualifies a configuration that meets every requirement", () => {
    const result = evaluateCandidate(contract, candidate(), baselineHardScore);
    expect(result.status).toBe(QUALIFIED);
    expect(result.requirements.every((requirement) => requirement.pass)).toBe(
      true,
    );
  });

  it("fails quality and regression when the hard-tier score drops", () => {
    const result = evaluateCandidate(
      contract,
      candidate({ hardScore: 0.8 }),
      baselineHardScore,
    );
    expect(result.status).toBe(NOT_QUALIFIED);
    expect(
      result.requirements.find(
        (requirement) => requirement.id === "hard-tier-score",
      )?.pass,
    ).toBe(false);
    expect(
      result.requirements.find(
        (requirement) => requirement.id === "no-regression",
      )?.pass,
    ).toBe(false);
    expect(
      result.requirements.find(
        (requirement) => requirement.id === "latency-p50",
      )?.pass,
    ).toBe(true);
  });

  it("fails latency only when p50 is above the maximum at the required concurrency", () => {
    const result = evaluateCandidate(
      contract,
      candidate({ latencyP50Ms: 8000 }),
      baselineHardScore,
    );
    expect(result.status).toBe(NOT_QUALIFIED);
    expect(result.basis).toBe("measured");
    const latency = result.requirements.find(
      (requirement) => requirement.id === "latency-p50",
    );
    expect(latency?.pass).toBe(false);
    expect(latency?.compared).toBe(true);
    expect(latency?.measured).toBe(8000);
    expect(
      result.requirements.filter((requirement) => requirement.pass),
    ).toHaveLength(3);
  });

  it("does not treat an unrecorded concurrency as a slow p50", () => {
    const result = evaluateCandidate(
      contract,
      candidate({
        concurrency: null,
        latencyP50Ms: 23327,
        hardScore: null,
        toolSelectionHardScore: null,
      }),
      baselineHardScore,
    );
    expect(result.status).toBe(NOT_QUALIFIED);
    expect(result.basis).toBe("incomplete-record");
    expect(result.summary).toContain("not a finding");
    const latency = result.requirements.find(
      (requirement) => requirement.id === "latency-p50",
    );
    expect(latency?.pass).toBe(false);
    expect(latency?.compared).toBe(false);
    expect(latency?.measured).toBe(23327);
    expect(latency?.detail).toContain("not compared");
    expect(
      result.requirements.find(
        (requirement) => requirement.id === "hard-tier-score",
      )?.measured,
    ).toBeNull();
  });
});

describe("recorded NVIDIA configurations", () => {
  const report = buildContractReport();

  it("qualifies Super reasoning-on and reasoning-low only", () => {
    const status = Object.fromEntries(
      report.results.map((result) => [
        `${result.model.split("/").pop()}:${result.reasoning}`,
        result.status,
      ]),
    );
    expect(status).toEqual({
      "nemotron-3-super-120b-a12b:on": QUALIFIED,
      "nemotron-3-super-120b-a12b:low": QUALIFIED,
      "nemotron-3-super-120b-a12b:off": NOT_QUALIFIED,
      "nemotron-3.5-lightning-30b-a3b:on": NOT_QUALIFIED,
      "nemotron-3.5-lightning-30b-a3b:off": NOT_QUALIFIED,
    });
  });

  it("fails Lightning because the hard tier was not recorded, not because a threshold was invented", () => {
    const lightning = report.results.find(
      (result) =>
        result.model.endsWith("lightning-30b-a3b") && result.reasoning === "on",
    );
    const hard = lightning?.requirements.find(
      (requirement) => requirement.id === "hard-tier-score",
    );
    const latency = lightning?.requirements.find(
      (requirement) => requirement.id === "latency-p50",
    );
    expect(lightning?.basis).toBe("incomplete-record");
    expect(lightning?.summary).toContain("not a finding");
    expect(hard?.measured).toBeNull();
    expect(hard?.compared).toBe(false);
    expect(hard?.detail).toContain("not recorded");
    expect(latency?.compared).toBe(false);
    expect(latency?.detail).toContain("not compared");
    const superOff = report.results.find(
      (result) =>
        result.model.endsWith("super-120b-a12b") && result.reasoning === "off",
    );
    expect(superOff?.basis).toBe("measured");
  });

  it("matches the committed contract report", () => {
    const committed = JSON.parse(
      readFileSync(
        resolve("src/evals/results/capability-contract-mvp.json"),
        "utf8",
      ),
    );
    expect(committed).toEqual(report);
    expect(loadRecordedCandidates()).toHaveLength(report.results.length);
  });
});
