# Archived Workers

Legacy Cloudflare Worker entry points moved here during the **BleuJS Autonomous Reasoning Lab** consolidation (v5.0).

## Canonical production worker

**Use only:** `src/primary-agi-worker.ts` via `wrangler.toml` → https://agi.bleujs.org

## Archived files

These workers duplicated overlapping functionality with simulated metrics and divergent APIs. They are kept for reference, not deployment.

| File | Former route |
|------|----------------|
| `enhanced-agi-worker.ts` | api.agi.bleujs.org |
| `advanced-agi-worker.ts` | advanced-agi.bleujs.org |
| `real-agi-worker.ts` | real-agi.bleujs.org |
| Others | dev / experimental |

Do not deploy from this folder without explicit intent to restore a legacy variant.
