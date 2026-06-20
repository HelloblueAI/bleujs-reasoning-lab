# BleuJS Autonomous Reasoning Lab — 90-Day Plan

**Start:** June 2026  
**Live site:** https://agi.bleujs.org  
**Canonical code:** `src/primary-agi-worker.ts` + `src/core/UltimateAGIOrchestrator.ts`

## North star

Build **one measurable autonomous reasoning loop** that improves on eval scores over time—not more modules or simulated consciousness percentages.

AGI is the long-term goal. The 90-day deliverable is a **credible research lab** with public, honest progress.

---

## Phase 1: Foundation (Days 1–14) ✅ Started

### Done in v5.0 consolidation

- [x] Single production worker (`primary-agi-worker.ts`)
- [x] Legacy workers archived to `src/archive/workers/`
- [x] Honest metrics module (`src/lab/honestMetrics.ts`)
- [x] Request counters for real history sizes
- [x] Eval harness (`src/eval/`) — 8 tasks, offline-capable
- [x] New API: `GET /metrics`, `GET /eval`, `GET /goals`
- [x] Removed `Math.random()` from live worker responses and dashboard

### Remaining (Week 2)

- [ ] Deploy v5.0 to production (`pnpm run deploy:worker:prod`)
- [ ] Pin eval baseline in repo: `pnpm run eval > eval-baseline.json`
- [ ] Add GitHub Action step: `pnpm run test:eval` on every PR
- [ ] Trim README badges that claim "Consciousness 1.0 Maximum"

---

## Phase 2: Autonomous goal loop (Days 15–45)

**Focus:** The system sets sub-goals, acts, evaluates, and updates strategy.

### Build

1. **Goal execution pipeline** — `AutonomousGoalSystem` → pick top goal → call orchestrator → record outcome → `updateGoalProgress()`
2. **Wire `/goals/execute`** — POST runs one autonomous cycle (safe, rate-limited)
3. **Goal generation from eval failures** — failed eval tasks become `performanceWeaknesses` in `generateGoals()`
4. **Persistent goal state** — Cloudflare KV binding `AGI_STATE` for goals + eval history across requests

### Measure

| Metric | Target (Day 45) |
|--------|-----------------|
| Eval pass rate (offline) | ≥ 85% |
| Goals completed autonomously | ≥ 10/week (logged) |
| Reasoning eval (with LLM) | Subjective review + 5 fixed prompts |

---

## Phase 3: Cross-domain reasoning depth (Days 46–70)

**Focus:** Reason over a knowledge graph, not just LLM fluency.

### Build

1. **Concept graph persistence** — store `RealUnderstandingEngine` concepts in KV
2. **Logic-first path** — for factual queries, try `RealReasoningEngine` + graph before LLM
3. **Benchmark suite expansion** — add 10 ARC-style / logic puzzles (no LLM required)
4. **Public `/eval/history`** — weekly pass-rate trend on the dashboard

### Measure

- Logic-only tasks pass without LLM
- Cross-domain task identifies ≥ 3 domains on standard prompts
- Document 5 cases where graph+logic beats LLM-only (case study)

---

## Phase 4: Self-improvement loop (Days 71–90)

**Focus:** System rewrites its own routing policy based on measured outcomes.

### Build

1. **Strategy registry** — `SelfImprovementLoop` chooses: direct LLM / multi-agent / tool / logic-only
2. **A/B on eval** — run each strategy on eval suite, keep best per task category
3. **Weekly eval report** — auto-generated markdown in `docs/eval-reports/`
4. **BleuJS integration story** — one blog post: what the lab proves, what's next

### Measure

- Eval pass rate improves ≥ 10% from Day-14 baseline
- At least one strategy change logged with before/after eval
- Zero simulated metrics in any public API field

---

## What we are NOT doing (90 days)

- Claiming consciousness or AGI achievement
- Adding new worker variants or "quantum consciousness" modules
- Expanding simulated multi-language execution (Python/Julia/Haskell)
- Chasing vanity node/connection counts

---

## Commands

```bash
# Local eval suite
pnpm run eval

# Dev worker
pnpm run worker:dev

# Production deploy
pnpm run deploy:worker:prod

# Run eval tests in CI
pnpm run test:eval
```

## API quick reference

```bash
curl https://agi.bleujs.org/metrics
curl https://agi.bleujs.org/eval
curl https://agi.bleujs.org/goals
curl -X POST https://agi.bleujs.org/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "If all humans are mortal and Socrates is human, what follows?"}'
```

---

## Success criteria (Day 90)

1. **One worker, one story** — agi.bleujs.org is the lab, not a demo graveyard
2. **Published eval trend** — weekly numbers, honest methodology
3. **Autonomous loop works** — goals generated, executed, scored without manual wiring
4. **Something novel** — logic+graph path or self-improving routing that isn't "another ChatGPT wrapper"

That is not AGI—but it is a foundation someone could build on, and it is honest.
