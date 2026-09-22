#!/usr/bin/env tsx
/**
 * CLI for model-in-the-loop benchmarks (Reasoning Lab evaluation only).
 *
 *   pnpm run eval:model -- --smoke                 # 1 item per benchmark
 *   pnpm run eval:model -- --thinking both --runs 3
 *
 * Credentials come from NVIDIA_EVAL_API_KEY (see .dev.vars.example). This never
 * touches production routing config: NVIDIA_API_KEY / NVIDIA_CHAT_MODEL are not
 * read here.
 *
 * Results are written to src/evals/results/model-<model>-thinking-<mode>.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runModelBenchmarkSuite } from "./benchmarks/modelRunner";
import { getGitSha } from "./gitSha";
import {
  describeEvalModel,
  REASONING_MODES,
  resolveEvalModel,
  type EvalModelOverrides,
  type ReasoningMode,
} from "./model/evalModelConfig";
import type { ModelBenchmarkSuiteResult } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

/** Loads .dev.vars so the CLI shares the wrangler dev secrets file. */
function loadDevVars(): void {
  const path = resolve(repoRoot, ".dev.vars");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function numberFlag(name: string): number | undefined {
  const raw = flag(name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} expects a number, got "${raw}"`);
  }
  return value;
}

function variantPath(model: string, reasoning: string): string {
  const slug = model.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return resolve(here, "results", `model-${slug}-thinking-${reasoning}.json`);
}

/**
 * Collects whichever reasoning variants exist on disk for this model into one
 * comparison file. Each variant keeps its own timestamp and gitSha, since they
 * are recorded in separate runs.
 */
/**
 * A result file on disk, which may predate fields the current runner writes.
 * Kept separate from `ModelBenchmarkSuiteResult` so fresh runs stay strictly
 * typed while old recordings are still readable.
 */
type RecordedSuite = Omit<
  ModelBenchmarkSuiteResult,
  "tierScores" | "benchmarks"
> & {
  tierScores?: ModelBenchmarkSuiteResult["tierScores"];
  benchmarks: Array<
    Omit<ModelBenchmarkSuiteResult["benchmarks"][number], "tierScores"> & {
      tierScores?: ModelBenchmarkSuiteResult["benchmarks"][number]["tierScores"];
    }
  >;
};

function writeComparison(model: string): string | null {
  const variants = REASONING_MODES.map((reasoning) => {
    const path = variantPath(model, reasoning);
    if (!existsSync(path)) return null;
    // Variants recorded before tiers existed have no `tierScores`, so the
    // parsed shape is deliberately weaker than the current result type.
    const suite = JSON.parse(readFileSync(path, "utf8")) as RecordedSuite;
    // Recount from the per-attempt records rather than trusting the stored
    // totals: runs recorded before timeouts were tracked separately lumped
    // stalls in with throttling. `timedOut` is absent on those, so fall back to
    // the attempt's own error text.
    const lost = suite.benchmarks
      .flatMap((b) => b.items.flatMap((i) => i.attempts))
      .filter((a) => a.inconclusive);
    const timedOut = lost.filter(
      (a) => a.timedOut ?? /timed out/i.test(a.error ?? ""),
    ).length;
    return {
      reasoning: suite.reasoning,
      recordedAt: new Date(suite.timestamp).toISOString(),
      gitSha: suite.gitSha,
      config: suite.config,
      benchmarksPassed: suite.passed,
      benchmarksTotal: suite.total,
      itemScore: suite.itemScore,
      // Absent on runs recorded before tiers existed. Reported as null rather
      // than zero so an old variant cannot look like a failure on the hard tier
      // it was never scored against.
      tierScores: suite.tierScores ?? null,
      latencyMs: suite.latencyMs,
      completionTokens: suite.completionTokens,
      durationMs: suite.durationMs,
      rateLimited: lost.length - timedOut,
      timedOut,
      benchmarkScores: Object.fromEntries(
        suite.benchmarks.map((b) => [b.id, b.score]),
      ),
      benchmarkHardScores: Object.fromEntries(
        suite.benchmarks.map((b) => [b.id, b.tierScores?.hard.score ?? null]),
      ),
    };
  }).filter((v) => v !== null);

  if (variants.length < 2) return null;

  const outPath = resolve(
    here,
    "results",
    `model-${model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-comparison.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        provider: "nvidia",
        model,
        generatedAt: new Date().toISOString(),
        note:
          "Same fixed items, same graders, majority vote over repeated runs; " +
          "only the reasoning setting differs.",
        caveats: [
          "Read tierScores.hard, not itemScore. The core tier is saturated for " +
            "strong models — every variant scored 1.000 on retrieval and the " +
            "3x3 puzzle — so a blended itemScore hides whether the reasoning " +
            "setting mattered. The hard tier is where configurations separate.",
          "Hard items are built so that pattern matching fails: the offline " +
            "baselines score 0/20 on hard arithmetic, 0/5 on hard retrieval, " +
            "and 0/9 on hard tool selection. A model beating those numbers is " +
            "doing something a regex cannot.",
          "Latency is shared free-endpoint latency, not a dedicated deployment.",
          "Latency is only comparable between variants recorded at the same " +
            "concurrency (config.concurrency): the endpoint queues under load, " +
            "and requests that hit config.timeoutMs are dropped as inconclusive.",
          "Cost columns (completionTokens, latency) are measured over hundreds " +
            "of requests and are reliable. Small accuracy gaps still are not: " +
            "there is no significance testing yet, so treat a one- or two-item " +
            "difference within a tier as a tie until confidence intervals land.",
        ],
        variants,
      },
      null,
      2,
    ) + "\n",
  );
  return outPath;
}

/** "core 12/12 100% · hard 9/20 45%" — null score renders as "n/a". */
function formatTiers(tiers: {
  core: { total: number; correct: number; score: number | null };
  hard: { total: number; correct: number; score: number | null };
}): string {
  const one = (
    label: string,
    t: { total: number; correct: number; score: number | null },
  ) =>
    t.total === 0
      ? `${label} n/a`
      : `${label} ${t.correct}/${t.total} ${((t.score ?? 0) * 100).toFixed(0)}%`;
  return `${one("core", tiers.core)} · ${one("hard", tiers.hard)}`;
}

function report(suite: ModelBenchmarkSuiteResult): void {
  console.log(
    `\n${suite.model} — thinking ${suite.reasoning} ` +
      `(temp ${suite.config.temperature}, top_p ${suite.config.topP}, ` +
      `max_tokens ${suite.config.maxTokens}, ${suite.config.runs} run(s)/item)`,
  );
  for (const benchmark of suite.benchmarks) {
    const icon = benchmark.passed ? "✓" : "✗";
    const notes = [
      benchmark.unstableItems ? `${benchmark.unstableItems} unstable` : "",
      benchmark.truncations ? `${benchmark.truncations} truncated` : "",
      benchmark.errors ? `${benchmark.errors} bad format` : "",
      benchmark.inconclusiveItems
        ? `${benchmark.inconclusiveItems} items unscored (rate limited)`
        : "",
    ].filter(Boolean);
    console.log(
      `  ${icon} ${benchmark.name} — ${benchmark.correct}/${benchmark.total} ` +
        `${benchmark.metric} (${(benchmark.score * 100).toFixed(1)}%) ` +
        `[${formatTiers(benchmark.tierScores)}] ` +
        `p50 ${benchmark.latencyMs.p50}ms p95 ${benchmark.latencyMs.p95}ms` +
        (notes.length ? ` [${notes.join(", ")}]` : ""),
    );
  }
  console.log(
    `  → ${suite.passed}/${suite.total} benchmarks passed, ` +
      `item accuracy ${(suite.itemScore * 100).toFixed(1)}% ` +
      `(${formatTiers(suite.tierScores)}), ` +
      `latency p50 ${suite.latencyMs.p50}ms / p95 ${suite.latencyMs.p95}ms, ` +
      `${suite.completionTokens} completion tokens, ` +
      `${(suite.durationMs / 1000).toFixed(1)}s total`,
  );
  const lost = [
    suite.rateLimited ? `${suite.rateLimited} to 429/503 throttling` : "",
    suite.timedOut
      ? `${suite.timedOut} to the ${suite.config.timeoutMs ?? "?"}ms timeout`
      : "",
  ].filter(Boolean);
  if (lost.length > 0) {
    console.log(
      `  note: lost ${lost.join(" and ")} after retries; ` +
        `excluded from scores and latency`,
    );
  }
}

async function main(): Promise<void> {
  loadDevVars();

  const thinking = flag("thinking") ?? "on";
  if (!["on", "low", "off", "both", "all"].includes(thinking)) {
    throw new Error(
      `--thinking expects on | low | off | both | all, got "${thinking}"`,
    );
  }
  const modes: ReasoningMode[] =
    thinking === "all"
      ? [...REASONING_MODES]
      : thinking === "both"
        ? ["on", "off"]
        : [thinking as ReasoningMode];

  // Rebuild the comparison from recorded variants without spending API calls.
  if (process.argv.includes("--summary-only")) {
    const { config } = resolveEvalModel(process.env, {
      ...(flag("model") ? { model: flag("model") } : {}),
    });
    const path = writeComparison(config.model);
    console.log(
      path
        ? `Combined comparison → ${path}`
        : `Need at least two recorded variants for ${config.model}`,
    );
    return;
  }

  const smoke = process.argv.includes("--smoke");
  const limitPerBenchmark = smoke ? 1 : numberFlag("limit");
  const gitSha = getGitSha();

  const overrides: EvalModelOverrides = {
    ...(flag("model") ? { model: flag("model") } : {}),
    ...(numberFlag("runs") ? { runs: numberFlag("runs") } : {}),
    ...(numberFlag("max-tokens")
      ? { maxTokens: numberFlag("max-tokens") }
      : {}),
    ...(numberFlag("timeout")
      ? { timeoutMs: (numberFlag("timeout") as number) * 1000 }
      : {}),
  };

  console.log("BleuJS Reasoning Lab — model-in-the-loop benchmarks");
  console.log("(evaluation only; not wired into Helloblue production routing)");

  const suites: ModelBenchmarkSuiteResult[] = [];
  let failed = 0;

  for (const reasoning of modes) {
    const model = resolveEvalModel(process.env, { ...overrides, reasoning });
    console.log(`\nRunning ${describeEvalModel(model.config)}…`);

    const suite = await runModelBenchmarkSuite(model, {
      gitSha,
      limitPerBenchmark,
      ...(numberFlag("concurrency")
        ? { concurrency: numberFlag("concurrency") }
        : {}),
      // Reasoning runs take minutes; without this the CLI looks hung.
      onProgress: ({
        benchmark,
        itemId,
        tier,
        passed,
        done,
        total,
        latencyMs,
      }) => {
        const icon = passed === null ? "○" : passed ? "✓" : "✗";
        console.log(
          `  ${icon} ${benchmark} ${done}/${total} — ${itemId} (${tier}) ` +
            `[${(latencyMs / 1000).toFixed(1)}s]`,
        );
      },
    });

    report(suite);
    const outPath = variantPath(suite.model, suite.reasoning);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(suite, null, 2) + "\n");
    console.log(`  results → ${outPath}`);

    suites.push(suite);
    failed += suite.failed;
  }

  const comparisonPath = writeComparison(
    suites[0]?.model ?? resolveEvalModel(process.env, overrides).config.model,
  );
  if (comparisonPath) {
    console.log(`\nCombined comparison → ${comparisonPath}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
