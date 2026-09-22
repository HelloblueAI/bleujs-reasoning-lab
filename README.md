# BleuJS Reasoning Lab

[![CI](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml/badge.svg)](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

> **What it is:** an open-source TypeScript harness for *measuring* LLM reasoning — fixed datasets, exact graders, and reasoning-mode cost curves.
> **Live demo:** https://agi.bleujs.org · **Repo:** https://github.com/HelloblueAI/bleujs-reasoning-lab

This lab **measures** reasoning; it does not produce it. The reasoning quality it reports belongs to the hosted model under test. Every score the API returns is a benchmark result from a committed run at a recorded git SHA, or a deterministic run you can reproduce locally — there are no heuristic "capability" scores.

## Research purpose

The lab studies one question: **what does a model's reasoning mode buy on tasks with exactly checkable answers, and what does it cost?** Model results are usually reported as accuracy alone, without the token and latency bill. Here the same fixed datasets are sent to a hosted model with reasoning on, at low effort, and off, and each run records accuracy alongside completion tokens and latency. Deterministic baselines score the same items, so a result shows how far the model gets past pattern matching.

**Current focus.** The datasets now carry a `hard` tier that the baselines fail by construction, and the reasoning-mode comparison has been recorded for one model, NVIDIA Nemotron 3 Super ([current result](#current-result-what-reasoning-mode-costs)). The next steps on the [roadmap](docs/LAB_PLAN.md) are confidence intervals, so that close scores become computed ties rather than judgement calls, and the same comparison across other vendors. Until those land, the results are a single-model measurement on small datasets — see [Scope and known limitations](#scope-and-known-limitations).

> **Removed in v6.0.0.** Earlier versions shipped a hand-rolled neural network, a regex concept extractor, an autonomous-goal system, and capability scores named `understandingDepth` / `adaptability` / `systemDepth`. Those scores were formulas over request counters, clamped to 0.95 so they could never resolve to a real value, and none of that code affected a single user-facing answer. It has all been deleted, along with the `POST /learn`, `POST /create`, and `GET /goals` endpoints that exposed it. [`tests/unit/measuredMetrics.test.ts`](tests/unit/measuredMetrics.test.ts) fails if any of it returns.

---

## Quick start

```bash
pnpm install
pnpm run worker:dev   # local Cloudflare Worker at http://localhost:8787
pnpm run eval         # offline benchmarks over fixed datasets
pnpm run check        # format + lint + type-check + unit tests + eval harness
```

Requires Node.js 22.12+ and pnpm 10+. `pnpm run check` runs everything CI checks on a pull request except the Worker bundle dry-run and the secret scan.

---

## Repository layout

One application path, organized by responsibility:

```
src/
├── worker/      # Cloudflare Worker entry point (HTTP API + dashboard)
├── evals/       # benchmarks (offline + model-in-the-loop), datasets, committed results
├── routing/     # LLM provider integration, prompt shaping, arithmetic, routing metrics
├── retrieval/   # embedding providers + semantic ranking
├── tools/       # keyword tool router — the baseline for the tool-selection benchmark
├── metrics/     # request counters, latency samples, status/endpoint payloads
└── utils/       # logger, id helpers
```

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for details.

---

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness probe |
| `GET /status` | Version, feature flags, and the committed benchmark summary |
| `GET /capabilities` | Benchmark scores from the last committed eval run, with dataset path and git SHA |
| `GET /eval` | Run the offline benchmark suite live (deterministic — matches the committed run at the same commit) |
| `POST /reason` | Answer-first reasoning via a configured hosted model; simple arithmetic is answered locally |

```bash
# Benchmark scores from the last committed run (no API key required)
curl http://localhost:8787/capabilities
# → {"success":true,"data":{"benchmarks":{"passed":6,"total":6,"passRate":1,
#      "gitSha":"...","scores":{"arithmetic":1,"tool-selection":1,...}},
#      "limitations":["Datasets are small (tens of items per benchmark)...]}}

# Answer-first reasoning; simple arithmetic is answered locally, no LLM call
curl -X POST http://localhost:8787/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "144 / 12"}'
# → {"data":{"answer":"144 ÷ 12 = 12","llmUsed":false,"answerSource":"local-arithmetic",...}}
```

`answerSource` is `local-arithmetic` or `model`. Provider keys are optional (see [`.dev.vars.example`](.dev.vars.example)); provider selection and fallback logic live in [`src/routing/`](src/routing/). Operational counters are served at `GET /metrics` only to callers holding `METRICS_TOKEN`. To run your own instance, see [docs/deployment/](docs/deployment/).

---

## Evaluations: offline baselines vs. model-in-the-loop

The lab separates two very different things:

- **Offline benchmarks** ([`src/evals/benchmarks/`](src/evals/benchmarks/), served by `GET /eval`) score **deterministic baselines** against **fixed datasets** with **exact grading**: arithmetic, constraint logic puzzles, retrieval top-1, tool selection, provider routing rates, and abstention. No API keys, no sampling — the same commit always yields the same numbers, written to [`src/evals/results/latest.json`](src/evals/results/latest.json).

```bash
pnpm run eval   # refreshes results/latest.json
```

- **Model-in-the-loop benchmarks** ([`src/evals/benchmarks/modelRunner.ts`](src/evals/benchmarks/modelRunner.ts)) send the *same* fixed datasets to a hosted model so its score is directly comparable to the offline baseline. Decoding is sampled, so every item runs `--runs` times and is scored by majority vote; rate-limited attempts are excluded from scoring rather than counted as wrong answers.

```bash
pnpm run eval:model -- --smoke                   # 1 item per benchmark
pnpm run eval:model -- --thinking all --runs 3   # reasoning on / low / off
pnpm run eval:model -- --summary-only            # rebuild the comparison file
```

`--thinking low` uses NVIDIA's low reasoning-effort instruction, which keeps the
reasoning channel active rather than disabling it.

### Difficulty tiers

Every dataset item is tagged `core` or `hard`, because the original datasets were
saturated: every model variant scored 1.000 on retrieval and on the 3x3 logic
puzzle, so the benchmarks could not answer the question the lab exists to ask.

| Tier | Built for | Offline baseline scores |
|------|-----------|-------------------------|
| `core` | What the deterministic baselines handle: two-operand arithmetic, lexically obvious retrieval, literal tool keywords | 100% — it is a regression test |
| `hard` | Defeating pattern matching: order of operations, percentages, unit conversion, multi-step word problems, near-miss passages where the correct answer shares *fewer* words with the query, tool requests with no trigger word, and arithmetic-shaped questions that are unanswerable | 0/20 arithmetic, 0/5 retrieval, 0/9 tool selection |

`pnpm run eval` scores the core tier only, so it stays a clean regression test.
`pnpm run eval:model` runs both and reports `tierScores` per benchmark and per
suite. [`tests/unit/datasetTiers.test.ts`](tests/unit/datasetTiers.test.ts)
enforces both directions: baselines must pass every core item and fail every hard
one, so a hard item cannot silently degrade into an easy one.

### Current result: what reasoning mode costs

Nemotron 3 Super 120B A12B, 84 items, 3 runs per item, majority vote,
concurrency 3 ([full record](src/evals/results/model-nvidia-nemotron-3-super-120b-a12b-comparison.json)):

| Reasoning | Hard tier | Completion tokens | Latency p50 |
|-----------|-----------|-------------------|-------------|
| `on` | 43/45 (96%) | 97,125 | 3.8s |
| `low` | 43/45 (96%) | 19,145 | 1.0s |
| `off` | 36/45 (80%) | 9,287 | 0.5s |

Two things worth noting. Turning reasoning off costs 16 points on the hard tier,
and most of that loss is concentrated in the 5x5 logic puzzle (100% → 40%) and
hard arithmetic (100% → 80%) — the tasks that need more than one step. But `low`
matched `on` exactly while spending **5x fewer completion tokens** and answering
**~4x faster**, which says the expensive full reasoning channel bought nothing
measurable on these datasets.

Treat the `on`/`low` tie as a tie, not as evidence `low` is better: there are no
confidence intervals yet, and 45 hard items cannot resolve a 2-item difference.

This path is **evaluation only**. It reads `NVIDIA_EVAL_API_KEY` / `NVIDIA_EVAL_CHAT_MODEL`, which the Worker never reads, so an eval model can never be served by `/reason`. Per-variant results land in `src/evals/results/model-<model>-thinking-<mode>.json`.

### Scope and known limitations

State these before citing any number from this repo:

- **Read the hard tier, not the blended score.** The core tier is saturated for strong models, so `itemScore` hides whether a configuration change mattered. `tierScores.hard` is the number that separates variants.
- **Retrieval and tool selection are saturated even on the hard tier.** Nemotron 3 Super scores 5/5 and 9/9 on hard retrieval and hard tool selection in every mode, so those two benchmarks currently discriminate between *baselines*, not between model configurations. Arithmetic, the logic puzzles, and abstention are where the reasoning setting shows up.
- **Datasets are still small** — 84 items across five benchmarks. Enough to separate reasoning-off from reasoning-on, not enough to rank two close configurations.
- **No confidence intervals yet.** Differences are reported without significance testing, so treat close scores as ties.
- **Latency is shared-endpoint latency**, not a dedicated deployment, and is only comparable between variants recorded at the same concurrency.
- **Cost metrics are the reliable ones.** Completion-token counts and latency percentiles are measured over hundreds of requests; small accuracy deltas are not.
- **Single vendor so far.** Committed model results are all NVIDIA variants; cross-vendor baselines are not yet recorded.

Nothing here is evidence of general intelligence, and the project does not train models.

---

## Reproducing the published results

Everything below runs from a public clone. It needs no Helloblue account, no Cloudflare account, and no production configuration; `wrangler.production.toml` is only for deploying your own instance.

**Offline benchmarks (exact).** Deterministic, so a clean checkout reproduces the committed numbers exactly:

```bash
git clone https://github.com/HelloblueAI/bleujs-reasoning-lab.git
cd bleujs-reasoning-lab
pnpm install --frozen-lockfile
pnpm run eval
git diff src/evals/results/latest.json   # only gitSha, timestamps, and durationMs change
pnpm run check                           # the full test gate
```

**Model-in-the-loop (statistical).** Needs an API key for NVIDIA's hosted model API ([build.nvidia.com](https://build.nvidia.com)); the defaults for model, temperature, top-p, token budget, and timeout match the committed run.

```bash
cp .dev.vars.example .dev.vars   # set NVIDIA_EVAL_API_KEY
pnpm run eval:model -- --smoke   # 1 item per benchmark, to check the key works
pnpm run eval:model -- --thinking all --runs 3 --concurrency 3
```

The committed run took about 32 minutes for all three variants. Decoding is sampled, so expect scores close to the published ones rather than identical: compare the hard-tier scores and completion-token totals, and treat one- or two-item differences as noise. Latency depends on load on NVIDIA's shared endpoint and will not match exactly.

**Provenance of the committed files:**
- The Nemotron 3 Super files record `gitSha` `519a226a`, but they were produced with the tiered datasets that were committed next, in `97fc486c`. Datasets, graders, and runners are unchanged from `97fc486c` to current `main` (later commits only change how the SHA is recorded), so reproduce from either — not from `519a226a`, which has only the original 39 items. Runs recorded from now on append `-dirty` to the SHA when the working tree had uncommitted changes.
- The Nemotron 3.5 Lightning files predate the difficulty tiers (39 items, no `tierScores`) and are not comparable with the table above.

---

## Development

| Script | Purpose |
|--------|---------|
| `pnpm run worker:dev` | Wrangler dev server for the Worker |
| `pnpm run eval` | Offline benchmarks over fixed datasets (CLI) |
| `pnpm run eval:model` | Model-in-the-loop benchmarks (needs `NVIDIA_EVAL_API_KEY`) |
| `pnpm run test:unit` | Unit tests (Vitest) |
| `pnpm run test:eval` | Benchmark tests (Vitest) |
| `pnpm run lint` / `format` | ESLint / Prettier |
| `pnpm run type-check` | TypeScript, no emit |
| `pnpm run check` | All of the above in one command |
| `pnpm run deploy:worker:prod` | Deploy using your `wrangler.production.toml` (see [`wrangler.example.toml`](wrangler.example.toml)) |

See [docs/LAB_PLAN.md](docs/LAB_PLAN.md) for the measurable roadmap.

---

## Contributing

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and pick an [open good first issue](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
2. Run `pnpm run check` before opening a PR.
3. CI runs the same checks on every pull request ([`.github/workflows/lab-ci.yml`](.github/workflows/lab-ci.yml)).

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md). For help see [SUPPORT.md](SUPPORT.md); report vulnerabilities per [SECURITY.md](SECURITY.md) rather than public issues. You do not need Cloudflare access to contribute.

---

<div align="center">

[![Live](https://img.shields.io/badge/Live-BleuJS%20Reasoning-brightgreen?style=for-the-badge)](https://agi.bleujs.org)

</div>
