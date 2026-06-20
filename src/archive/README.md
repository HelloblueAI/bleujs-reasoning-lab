# Archive

Legacy code kept for reference after the **BleuJS Autonomous Reasoning Lab** v5.0 consolidation. **Do not deploy from here** unless you explicitly intend to restore a legacy variant.

## Canonical production

| Item | Path |
|------|------|
| Worker | `src/primary-agi-worker.ts` |
| Config | `wrangler.toml` |
| Live URL | https://agi.bleujs.org (workers.dev fallback in docs) |

## `workers/`

Former Cloudflare Worker entry points with overlapping APIs and simulated metrics.

| File | Notes |
|------|-------|
| `enhanced-agi-worker.ts` | Former api.agi route |
| `advanced-agi-worker.ts` | Former advanced-agi route |
| `real-agi-worker.ts` | Former real-agi route |
| `agi-worker-hybrid*.ts` | Hybrid system experiments |
| Others | Dev / experimental variants |

## `engines/`

Pre-v5 consciousness and quantum-themed engines (not used by the primary worker):

- `QuantumConsciousnessEngine.ts`
- `TrueConsciousnessEngine.ts`
- `AdvancedConsciousnessEngine.ts`
- `ConsciousnessEmergenceEngine.ts`
- `enhanced-consciousness-engine.ts`
- `real-consciousness-engine.ts`

**Still in `src/core/` (active):** `ConsciousnessDisplayMetrics.ts` (dashboard mapping from real stats), `ConsciousnessSimulator.ts` (used by tests and `SystemMonitor`).

## `legacy/`

Former Node/Express entry points and orchestrators that depended on archived engines:

- `EnhancedAGI.ts`, `enhanced-api-server.ts`
- `ultimate-hybrid-agi-system.ts`, `hybrid-agi-system.ts`
- `SelfModifyingAGICore.ts`

## `demo/`

- `EnhancedAGIDemonstration.ts` — demo for archived `EnhancedAGI`
