# BleuJS Reasoning Lab

[![CI](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml/badge.svg)](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

> **What it is:** an open-source TypeScript harness for *measuring* LLM reasoning — fixed datasets, exact graders, and reasoning-mode cost curves.
> **Live:** https://agi.bleujs.org · **Repo:** https://github.com/HelloblueAI/bleujs-reasoning-lab · **Worker API:** https://agi-primary.morning-star-e026.workers.dev

This lab **measures** reasoning; it does not produce it. The reasoning quality it reports belongs to the hosted model under test. Every number the API returns is either a counter this Worker incremented, a duration it timed, or a benchmark score from a committed run at a recorded git SHA — there are no heuristic "capability" scores.

> **Removed in v6.0.0.** Earlier versions shipped a hand-rolled neural network, a regex concept extractor, an autonomous-goal system, and capability scores named `understandingDepth` / `adaptability` / `systemDepth`. Those scores were formulas over request counters, clamped to 0.95 so they could never resolve to a real value, and none of that code affected a single user-facing answer. It has all been deleted, along with the `POST /learn`, `POST /create`, and `GET /goals` endpoints that exposed it. [`tests/unit/measuredMetrics.test.ts`](tests/unit/measuredMetrics.test.ts) fails if any of it returns.

> **Note on naming:** the project is the *reasoning lab*. The live infrastructure still uses legacy `agi.*` identifiers (custom domain `agi.bleujs.org`, Worker `agi-primary`, KV `AGI_CACHE`) that are intentionally left unchanged so production does not break. They are deployment names, not a product claim.

---

## Quick start

```bash
pnpm install
pnpm run worker:dev   # local Cloudflare Worker at http://localhost:8787
pnpm run eval         # offline benchmarks over fixed datasets
pnpm run check        # format + lint + type-check + unit tests + eval harness
```

`pnpm run check` is the single gate CI enforces on every pull request.

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
| `GET /metrics` | Request counters, measured latency percentiles, and `llmRouting` provider shares |
| `GET /capabilities` | Benchmark scores from the last committed eval run, with dataset path and git SHA |
| `GET /eval` | Run the offline benchmark suite live (deterministic — matches the committed run at the same commit) |
| `POST /reason` | Answer-first reasoning via BleuJS API, with NVIDIA Nemotron → Anthropic → OpenAI fallback; simple arithmetic is answered locally |

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
# → {"data":{"answer":"144 ÷ 12 = 12","llmUsed":false,...}}
```

`llmProvider` identifies which backend answered: `bleujs`, `nvidia`, `anthropic`, or `openai`. Set `BLEUJS_API_KEY` via `wrangler secret put BLEUJS_API_KEY --env production` for live reasoning; fallbacks activate when `ALLOW_LLM_FALLBACK=true`. See [docs/deployment/API_ACCESS.md](docs/deployment/API_ACCESS.md) if the custom domain returns a bot challenge.

---

## Evaluations: offline baselines vs. model-in-the-loop

The lab separates two very different things:

- **Offline benchmarks** ([`src/evals/benchmarks/`](src/evals/benchmarks/), served by `GET /eval`) score **deterministic baselines** against **fixed datasets** with **exact grading**: arithmetic, a constraint logic puzzle, retrieval top-1, tool selection, provider routing rates, and abstention. No API keys, no sampling — the same commit always yields the same numbers, written to [`src/evals/results/latest.json`](src/evals/results/latest.json).

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

This path is **evaluation only**. It reads `NVIDIA_EVAL_API_KEY` / `NVIDIA_EVAL_CHAT_MODEL`, which the Worker never reads, so an eval model can never be served by production `/reason` (that chain uses `NVIDIA_API_KEY` / `NVIDIA_CHAT_MODEL`). Per-variant results land in `src/evals/results/model-<model>-thinking-<mode>.json`.

### Scope and known limitations

State these before citing any number from this repo:

- **Datasets are small** — tens of items per benchmark, and a strong model in thinking-on mode already saturates several of them. A one- or two-item difference between configurations is sampling noise, not a result.
- **No confidence intervals yet.** Differences are reported without significance testing, so treat close scores as ties.
- **Latency is shared-endpoint latency**, not a dedicated deployment, and is only comparable between variants recorded at the same concurrency.
- **Cost metrics are the reliable ones.** Completion-token counts and latency percentiles are measured over hundreds of requests; accuracy deltas on a saturated dataset are not.
- **Single vendor so far.** Committed model results are all NVIDIA variants; cross-vendor baselines are not yet recorded.

Nothing here is evidence of general intelligence, and the project does not train models.

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
| `pnpm run deploy:worker:prod` | Deploy the Worker (maintainer-only) |

See [docs/LAB_PLAN.md](docs/LAB_PLAN.md) for the measurable roadmap.

---

## Contributing

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and pick an [open good first issue](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
2. Run `pnpm run check` before opening a PR.
3. CI runs the same checks on every pull request ([`.github/workflows/lab-ci.yml`](.github/workflows/lab-ci.yml)).

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md). For help see [SUPPORT.md](SUPPORT.md); report vulnerabilities per [SECURITY.md](SECURITY.md) rather than public issues. Production deploy is maintainer-only — you do not need Cloudflare access to contribute.

---

<div align="center">

[![Live](https://img.shields.io/badge/Live-BleuJS%20Reasoning-brightgreen?style=for-the-badge)](https://agi.bleujs.org)

</div>
