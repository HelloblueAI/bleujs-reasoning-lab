### BleuJS Autonomous Reasoning Lab

> **LIVE:** https://agi.bleujs.org — canonical worker: `src/primary-agi-worker.ts`  
> **API (workers.dev):** https://agi-primary.morning-star-e026.workers.dev  
> **Mission:** Measurable autonomous reasoning—not simulated AGI theater. Metrics come from learning engine state and request performance.

> **v5.0** (June 2026) — Lab consolidation: one worker, honest metrics, eval harness, goals API.

| Endpoint | Purpose |
|----------|---------|
| `GET /metrics` | Measured system state (no random telemetry) |
| `GET /eval` | Run evaluation suite, return pass rate |
| `GET /goals` | Active autonomous goals |
| `POST /reason` | Multi-agent reasoning (LLM when keys configured) |

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

# Reasoning (slim response by default)
curl -X POST https://agi-primary.morning-star-e026.workers.dev/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "What is 17 × 23?"}'

# Legacy verbose JSON
curl -X POST .../reason -H "Content-Type: application/json" \
  -d '{"input": "...", "verbose": true}'
```

Set `ANTHROPIC_API_KEY` via `npx wrangler secret put ANTHROPIC_API_KEY --env production` for live LLM reasoning.

---

## What this is

A **research lab** for orchestrated reasoning: multi-agent pipelines, optional Claude/GPT integration, learning-engine state, and an eval harness with honest pass rates. It is **not** a claim of artificial general intelligence or machine consciousness.

**Active production path:** `primary-agi-worker.ts` → `UltimateAGIOrchestrator`, `RealLLMIntegration`, `ConsciousnessDisplayMetrics` (dashboard labels mapped from real ML stats—not a consciousness engine).

**Archived (reference only):** legacy workers, quantum/consciousness engines, and pre-v5 entry points live under [`src/archive/`](src/archive/README.md). Do not deploy from there.

---

## Architecture (v5.0)

```
primary-agi-worker.ts
├── UltimateAGIOrchestrator   # reasoning / learning / creative agents
├── RealLLMIntegration        # Claude when API key present
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

1. Fork and create a feature branch
2. Add tests for behavior changes (`tests/eval`, `tests/unit`)
3. Open a pull request

---

<div align="center">

[![Live Lab](https://img.shields.io/badge/Live-Autonomous%20Reasoning%20Lab-brightgreen?style=for-the-badge)](https://agi.bleujs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[![Contributors](https://img.shields.io/github/contributors/HelloblueAI/neural-quantum-consciousness-framework?style=flat-square)](https://github.com/HelloblueAI/neural-quantum-consciousness-framework/graphs/contributors)
[![Issues](https://img.shields.io/github/issues/HelloblueAI/neural-quantum-consciousness-framework?style=flat-square)](https://github.com/HelloblueAI/neural-quantum-consciousness-framework/issues)

</div>
