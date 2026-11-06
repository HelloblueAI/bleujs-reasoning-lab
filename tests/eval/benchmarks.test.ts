import { describe, expect, it } from "vitest";
import { runBenchmarkSuite } from "@/evals/benchmarks/runner";
import { ROUTING_EXPECTED } from "@/evals/benchmarks/datasets";

describe("benchmark suite", () => {
  it("passes every benchmark on the fixed datasets (offline, deterministic)", async () => {
    const result = await runBenchmarkSuite("test");
    expect(result.suite).toBe("benchmark");
    for (const b of result.benchmarks) {
      expect(b.passed, `${b.id} scored ${b.correct}/${b.total}`).toBe(true);
    }
    expect(result.passRate).toBe(1);
  });

  it("is deterministic across repeated runs", async () => {
    const a = await runBenchmarkSuite("test");
    const b = await runBenchmarkSuite("test");
    const scores = (r: Awaited<ReturnType<typeof runBenchmarkSuite>>) =>
      r.benchmarks.map((x) => `${x.id}:${x.correct}/${x.total}`).join("|");
    expect(scores(a)).toBe(scores(b));
  });

  it("computes exact routing success and fallback rates", async () => {
    const result = await runBenchmarkSuite("test");
    const routing = result.benchmarks.find((b) => b.id === "routing");
    const success = routing?.items.find((i) => i.id === "success-rate");
    const fallback = routing?.items.find((i) => i.id === "fallback-rate");
    expect(success?.got).toBe(ROUTING_EXPECTED.successRate.toFixed(2));
    expect(fallback?.got).toBe(ROUTING_EXPECTED.fallbackRate.toFixed(2));
  });

  it("abstains on non-arithmetic prompts instead of fabricating numbers", async () => {
    const result = await runBenchmarkSuite("test");
    const abstention = result.benchmarks.find((b) => b.id === "abstention");
    expect(abstention?.correct).toBe(abstention?.total);
  });

  it("resolves evidence conflicts only when the fixture policy supports it", async () => {
    const result = await runBenchmarkSuite("test");
    const evidence = result.benchmarks.find(
      (b) => b.id === "evidence-resolution",
    );
    expect(evidence?.correct).toBe(6);
    expect(evidence?.total).toBe(6);
    expect(
      evidence?.items.find(
        (item) => item.id === "microgrant-unresolved-authority-conflict",
      )?.got,
    ).toBe("UNSUPPORTED");
  });
});
