# BleuJS Reasoning Lab

[![CI](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml/badge.svg)](https://github.com/HelloblueAI/bleujs-reasoning-lab/actions/workflows/lab-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

> **What it is:** an open-source TypeScript laboratory for evaluating LLM reasoning, provider routing, retrieval, tool selection, and agent orchestration.
> **Live:** https://agi.bleujs.org · **Repo:** https://github.com/HelloblueAI/bleujs-reasoning-lab · **Worker API:** https://agi-primary.morning-star-e026.workers.dev

This is an emerging, measurable reasoning lab — **not** a mature AGI framework and not a claim of machine consciousness. Every capability number the API returns is derived from measured learning-engine state, never simulated telemetry.

> **Note on naming:** the project is the *reasoning lab*. The live infrastructure still uses legacy `agi.*` identifiers (custom domain `agi.bleujs.org`, Worker `agi-primary`, KV `AGI_CACHE`) that are intentionally left unchanged so production does not break. They are deployment names, not a product claim.

---

## Quick start

```bash
pnpm install
pnpm run worker:dev   # local Cloudflare Worker at http://localhost:8787
pnpm run eval         # component/smoke evaluations + reproducible benchmarks
pnpm run check        # format + lint + type-check + unit tests + eval harness
```

`pnpm run check` is the single gate CI enforces on every pull request.

---

## Repository layout

One application path, organized by responsibility:

```
src/
├── worker/      # Cloudflare Worker entry point (HTTP API + dashboard)
├── reasoning/   # ReasoningOrchestrator + learning/understanding/goal/tool/memory engines
├── routing/     # LLM provider integration, prompt shaping, arithmetic, routing metrics
├── retrieval/   # embedding providers + semantic ranking
├── metrics/     # capability + request metrics, status/endpoint payloads
├── evals/       # smoke evaluations, reproducible benchmarks, saved results
└── utils/       # logger, id helpers
```

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for details.

---

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness probe |
| `GET /metrics` | Measured system state (no random telemetry); includes `llmRouting` provider counts |
| `GET /capabilities` | Capability scores derived from the learning engine |
| `GET /eval` | Run the smoke evaluation suite, return pass rate |
| `GET /goals` | Active self-generated goals |
| `POST /reason` | Answer-first reasoning via BleuJS API, with NVIDIA Nemotron Lightning → Anthropic → OpenAI fallback; simple arithmetic is answered locally |

```bash
# Capability scores derived from the learning engine (no API key required)
curl http://localhost:8787/capabilities
# → {"success":true,"data":{"measured":true,"capabilities":{
#      "reasoningQuality":0.7,"understandingDepth":0.6,"adaptability":0.65,...}}}

# Answer-first reasoning; simple arithmetic is answered locally, no LLM call
curl -X POST http://localhost:8787/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "144 / 12"}'
# → {"data":{"answer":"144 ÷ 12 = 12","llmUsed":false,...}}
```

`llmProvider` identifies which backend answered: `bleujs`, `nvidia`, `anthropic`, or `openai`. Set `BLEUJS_API_KEY` via `wrangler secret put BLEUJS_API_KEY --env production` for live reasoning; fallbacks activate when `ALLOW_LLM_FALLBACK=true`. See [docs/deployment/API_ACCESS.md](docs/deployment/API_ACCESS.md) if the custom domain returns a bot challenge.

---

## Evaluations: smoke vs. benchmarks

The lab separates two very different things:

- **Component / smoke evaluations** ([`src/evals/`](src/evals/), served by `GET /eval`) confirm that each component executes and returns sane output. They are execution checks, **not** evidence of intelligence.
- **Reproducible benchmarks** ([`src/evals/benchmarks/`](src/evals/benchmarks/)) score the system against **fixed datasets** with **exact scoring**: arithmetic, a constraint logic puzzle, retrieval top-1, tool selection, provider routing rates, and abstention. They run offline (no API keys) and results are written to [`src/evals/results/latest.json`](src/evals/results/latest.json).

```bash
pnpm run eval   # prints both suites and refreshes results/latest.json
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

Neither suite is presented as evidence of general intelligence.

---

## Development

| Script | Purpose |
|--------|---------|
| `pnpm run worker:dev` | Wrangler dev server for the Worker |
| `pnpm run eval` | Smoke evaluations + benchmarks (CLI) |
| `pnpm run eval:model` | Model-in-the-loop benchmarks (needs `NVIDIA_EVAL_API_KEY`) |
| `pnpm run test:unit` | Unit tests (Vitest) |
| `pnpm run test:eval` | Eval + benchmark tests (Vitest) |
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
