/**
 * Guards the property that makes this lab citable: every number in a public
 * payload is traceable to a measurement.
 *
 * Earlier versions published heuristic "capability" scores — formulas over
 * request counters, named `understandingDepth` / `adaptability` / `systemDepth`,
 * clamped to 0.95 so they never resolved to a real value. They were removed.
 * These tests fail if they are reintroduced.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { runBenchmarkSuite } from "@/evals/benchmarks/runner";
import { getOfflineBenchmarkSummary } from "@/metrics/benchmarkSummary";
import { buildCapabilitiesEndpointPayload } from "@/metrics/endpointResponses";
import {
  buildLabMetricsPayload,
  buildLabStatusPayload,
} from "@/metrics/labStatus";
import {
  getLatencySummary,
  getRequestCounters,
  incrementEval,
  incrementReasoning,
  recordLatency,
  resetRequestCountersForTests,
} from "@/metrics/requestCounters";
import { buildHonestReasonResponse } from "@/routing/reasonResponse";

/** Names of the removed heuristic scores. */
const UNMEASURED_KEYS = [
  "understandingDepth",
  "reasoningQuality",
  "systemDepth",
  "adaptability",
  "crossDomainIntegration",
  "learningComplexity",
  "learningEfficiency",
  "conceptsAcquired",
  "tasksLearned",
];

function collectKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, found);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      found.push(key);
      collectKeys(nested, found);
    }
  }
  return found;
}

beforeEach(() => {
  resetRequestCountersForTests();
});

describe("public payloads contain no unmeasured capability scores", () => {
  const cases = {
    "/status": () =>
      buildLabStatusPayload({
        llmAvailable: true,
        benchmarks: getOfflineBenchmarkSummary(),
      }),
    "/metrics": () =>
      buildLabMetricsPayload({
        llmAvailable: true,
        counters: getRequestCounters(),
        latency: getLatencySummary(),
        benchmarks: getOfflineBenchmarkSummary(),
      }),
    "/capabilities": () =>
      buildCapabilitiesEndpointPayload(getOfflineBenchmarkSummary(), true),
  };

  for (const [endpoint, build] of Object.entries(cases)) {
    it(`${endpoint} exposes no heuristic score keys`, () => {
      const keys = collectKeys(build());
      for (const banned of UNMEASURED_KEYS) {
        expect(keys).not.toContain(banned);
      }
    });
  }

  it("/reason returns the answer, not a self-assessment", () => {
    const response = buildHonestReasonResponse({
      input: "2 + 2",
      answer: "4",
      llmUsed: false,
      llmProvider: "local",
      processingTimeMs: 3,
    });

    expect(response.answer).toBe("4");
    expect(response.answerSource).toBe("local-arithmetic");
    expect(collectKeys(response)).not.toContain("understanding");
    // Hardcoded per-provider constants, not measurements — and they fingerprint
    // which provider answered.
    expect(collectKeys(response)).not.toContain("confidence");
  });
});

describe("a live benchmark run is not attributed to a commit", () => {
  it("returns a null gitSha when no SHA is supplied", async () => {
    // The Worker cannot know its own build commit. Borrowing the SHA from the
    // committed results would misattribute live scores after a deploy that did
    // not refresh that file.
    const suite = await runBenchmarkSuite(null);
    expect(suite.gitSha).toBeNull();
    expect(suite.total).toBeGreaterThan(0);
  });

  it("records the SHA it was given, for the committed CLI run", async () => {
    const suite = await runBenchmarkSuite("abc1234");
    expect(suite.gitSha).toBe("abc1234");
  });
});

describe("latency percentiles come from recorded samples", () => {
  it("reports null until something is measured", () => {
    expect(getLatencySummary()).toEqual({
      count: 0,
      p50Ms: null,
      p95Ms: null,
      maxMs: null,
    });
  });

  it("computes percentiles over the samples it was given", () => {
    for (const ms of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
      recordLatency(ms);
    }
    const summary = getLatencySummary();
    expect(summary.count).toBe(10);
    expect(summary.p50Ms).toBe(60);
    expect(summary.p95Ms).toBe(100);
    expect(summary.maxMs).toBe(100);
  });

  it("ignores impossible durations instead of reporting them", () => {
    recordLatency(-1);
    recordLatency(Number.NaN);
    expect(getLatencySummary().count).toBe(0);
  });

  it("counts only requests that happened", () => {
    incrementReasoning();
    incrementReasoning();
    incrementEval();
    expect(getRequestCounters()).toEqual({ reasoning: 2, eval: 1 });
  });
});

describe("benchmark scores are reproducible, not computed at request time", () => {
  it("cites a committed run with a git SHA so a reader can re-run it", () => {
    const summary = getOfflineBenchmarkSummary();
    expect(summary).not.toBeNull();
    expect(summary!.gitSha).toBeTruthy();
    expect(summary!.source).toContain("src/evals/results/latest.json");
    expect(summary!.total).toBeGreaterThan(0);
    expect(summary!.passRate).toBeGreaterThanOrEqual(0);
    expect(summary!.passRate).toBeLessThanOrEqual(1);
  });

  it("returns the same value on every call (no per-request drift)", () => {
    const first = getOfflineBenchmarkSummary();
    const second = getOfflineBenchmarkSummary();
    expect(first!.scores).toEqual(second!.scores);
    expect(first!.passRate).toBe(second!.passRate);
  });

  it("never clamps a score below a perfect result", () => {
    // The old `clampMetric` capped every score at 0.95, so a genuine 100% was
    // unreportable. A real 1.0 must survive.
    const summary = getOfflineBenchmarkSummary()!;
    const perfect = Object.values(summary.scores).filter((s) => s === 1);
    expect(perfect.length).toBeGreaterThan(0);
  });
});

describe("capabilities endpoint states its own limits", () => {
  it("publishes the dataset path and the small-sample caveat", () => {
    const payload = buildCapabilitiesEndpointPayload(
      getOfflineBenchmarkSummary(),
      true,
    );
    expect(payload.datasets).toContain("datasets.ts");
    expect(payload.limitations.join(" ")).toMatch(/statistically meaningful/i);
  });
});
