# Good first issues

Starter tasks for new contributors. Pick one, comment on the issue (or open a PR referencing it), and ask questions if stuck.

Create GitHub issues from these titles if they do not exist yet.

---

## Easy (docs & tests)

1. **Fix stale docs** — Search `docs/` for “consciousness 1.0”, quantum hype, or `:8080` URLs; update or mark archived.
2. **Add eval task** — Add one logic puzzle to `src/eval/tasks.ts` with expected pass criteria in `tests/eval/`.
3. **README API examples** — Add `GET /capabilities` curl example to README.
4. **WAF access doc** — Expand [deployment/API_ACCESS.md](deployment/API_ACCESS.md) with screenshots or step-by-step for Cloudflare skip rules.

---

## Medium (lab features)

5. **Phase 2: POST /goals/execute** — Wire `AutonomousGoalSystem` to run one goal via orchestrator (see [AGI_LAB_PLAN.md](AGI_LAB_PLAN.md)).
6. **Eval baseline file** — Script to write `eval-baseline.json` from `pnpm run eval` for trend tracking.
7. **Dashboard: eval pass rate** — Show latest `GET /eval` result on the embedded dashboard (small fetch + display).
8. **ToolSystem: Brave Search** — Optional real web search when `BRAVE_SEARCH_API_KEY` is set (keep honest failure when missing).

---

## Hard (core reasoning)

9. **Logic-first routing** — For factual queries, try `RealReasoningEngine` before LLM in `UltimateAGIOrchestrator`.
10. **KV goal persistence** — Persist goals across requests with `AGI_STATE` binding in `wrangler.toml`.
11. **Expand eval suite** — 5+ ARC-style or syllogism tasks that pass without LLM keys.

---

## Before you start

- Read [CONTRIBUTING.md](../CONTRIBUTING.md)
- Run `pnpm run test:eval && pnpm run test:unit`
- Do **not** modify `src/archive/` unless fixing import paths for reference builds
