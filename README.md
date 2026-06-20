### BleuJS Reasoning

> **Product:** BleuJS Reasoning — live at https://agi.bleujs.org  
> **Project (research lab):** BleuJS Autonomous Reasoning Lab — see [docs/AGI_LAB_PLAN.md](docs/AGI_LAB_PLAN.md)  
> **API (workers.dev):** https://agi-primary.morning-star-e026.workers.dev  
> **Mission:** Measurable reasoning—not simulated AGI theater.

> **v5.1** (June 2026) — Removed simulated consciousness/quantum API payloads; honest `/capabilities` endpoint.

| Endpoint | Purpose |
|----------|---------|
| `GET /metrics` | Measured system state (no random telemetry); includes `llmRouting` provider counts |
| `GET /capabilities` | Capability scores from learning engine (replaces `/consciousness`) |
| `GET /eval` | Run evaluation suite, return pass rate |
| `GET /goals` | Active autonomous goals |
| `POST /reason` | Reasoning via BleuJS API (`bleujs-chat`); Anthropic/OpenAI fallback |

See [docs/AGI_LAB_PLAN.md](docs/AGI_LAB_PLAN.md) for the 90-day roadmap and [docs/deployment/API_ACCESS.md](docs/deployment/API_ACCESS.md) if the custom domain returns a bot challenge.

---

## Quick start

```bash
pnpm install
pnpm run worker:dev          # local Cloudflare worker
pnpm run eval                # benchmark suite (CLI)
pnpm run test:eval           # vitest eval harness
pnpm run deploy:worker:prod  # deploy primary worker
```

### Example API calls

```bash
# Health & metrics
curl https://agi-primary.morning-star-e026.workers.dev/health
curl https://agi-primary.morning-star-e026.workers.dev/metrics
# data.llmRouting: bleujs / anthropic / openai / local / none counts + fallbackRate (global when AGI_CACHE KV is bound)

# Capabilities & reasoning
curl https://agi-primary.morning-star-e026.workers.dev/capabilities
curl -X POST https://agi-primary.morning-star-e026.workers.dev/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "where is tehran"}'
```

Example response (BleuJS primary path):

```json
{
  "success": true,
  "data": {
    "system": "BleuJS Reasoning",
    "answer": "Tehran is the capital city of Iran...",
    "llmUsed": true,
    "llmProvider": "bleujs"
  }
}
```

`llmProvider` identifies which backend answered: `bleujs` (BleuJS API / `api.bleujs.org`), `anthropic`, or `openai`. Simple arithmetic may use local math instead (`llmUsed: false`).

Set `BLEUJS_API_KEY` via `npx wrangler secret put BLEUJS_API_KEY --env production` for live reasoning. BleuJS is the primary LLM; Anthropic and OpenAI are optional fallbacks when BleuJS is unavailable or returns a non-answer.

---

## What this is

A **research lab** for orchestrated reasoning: multi-agent pipelines, BleuJS API as the primary LLM (`bleujs-chat` via `api.bleujs.org`), Anthropic/OpenAI fallback, learning-engine state, and an eval harness with honest pass rates. It is **not** a claim of artificial general intelligence or machine consciousness.

**Active production path:** `primary-agi-worker.ts` → `UltimateAGIOrchestrator`, `RealLLMIntegration`, `CapabilityDisplayMetrics` (honest capability scores from the learning engine).

**Archived (reference only):** legacy workers, quantum/consciousness engines, and pre-v5 entry points live under [`src/archive/`](src/archive/README.md). Do not deploy from there.

---

## Architecture (v5.0)

```
primary-agi-worker.ts
├── UltimateAGIOrchestrator   # reasoning / learning / creative agents
├── RealLLMIntegration        # BleuJS API primary; Anthropic/OpenAI fallback
├── AutonomousGoalSystem      # goals API (execution loop: planned)
├── lab/honestMetrics         # measured counters, no Math.random()
├── lab/reasonResponse        # slim /reason payload
└── eval/                     # tasks, runner, CLI
```

---

## Development

| Script | Purpose |
|--------|---------|
| `pnpm run worker:dev` | Wrangler dev for primary worker |
| `pnpm run eval` | Run eval tasks locally |
| `pnpm run test:eval` | Vitest eval tests |
| `pnpm run test:unit` | Unit tests |
| `pnpm run type-check` | TypeScript check |

Legacy `enhanced-agi` scripts now point at the primary worker (`worker:dev`). Old Express server and consciousness engines are archived.

---

## Contributing

We welcome PRs for eval tasks, honest API improvements, docs, and lab features aligned with [docs/AGI_LAB_PLAN.md](docs/AGI_LAB_PLAN.md).

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and pick a task from [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md)
2. Run `pnpm run test:eval` and `pnpm run test:unit` before opening a PR
3. CI runs the same checks on every pull request ([`.github/workflows/lab-ci.yml`](.github/workflows/lab-ci.yml))

Production deploy is maintainer-only; you do not need Cloudflare access to contribute.

---

<div align="center">

[![Live](https://img.shields.io/badge/Live-BleuJS%20Reasoning-brightgreen?style=for-the-badge)](https://agi.bleujs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[![Contributors](https://img.shields.io/github/contributors/HelloblueAI/neural-quantum-consciousness-framework?style=flat-square)](https://github.com/HelloblueAI/neural-quantum-consciousness-framework/graphs/contributors)
[![Issues](https://img.shields.io/github/issues/HelloblueAI/neural-quantum-consciousness-framework?style=flat-square)](https://github.com/HelloblueAI/neural-quantum-consciousness-framework/issues)

</div>
