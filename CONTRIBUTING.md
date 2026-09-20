# Contributing to BleuJS Reasoning Lab

Thank you for helping improve this project. BleuJS Reasoning Lab is an
**MIT-licensed lab** for measurable LLM reasoning, routing, retrieval, tool
selection, and agent orchestration — not a claim of AGI or machine consciousness.

**Repository:** https://github.com/HelloblueAI/bleujs-reasoning-lab

---

## Where to start

| I want to… | Start here |
|------------|------------|
| Understand the roadmap | [docs/LAB_PLAN.md](docs/LAB_PLAN.md) |
| Run the Worker locally | [README.md](README.md#quick-start) |
| Find starter tasks | [Open good first issues](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) ([index](docs/GOOD_FIRST_ISSUES.md)) |
| Learn the layout | [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) |

**Where the code lives:**

- `src/worker/index.ts` — Cloudflare Worker (HTTP API + dashboard)
- `src/evals/` — offline and model-in-the-loop benchmarks, datasets, committed results
- `src/routing/` — LLM provider integration, prompt shaping, routing metrics
- `src/retrieval/` — embedding providers + semantic ranking
- `src/tools/` — keyword tool router used as the tool-selection baseline
- `src/metrics/` — request counters, latency samples, API payloads

**One rule worth knowing before you add a metric:** every number in an API
response must trace to a counter the Worker incremented, a duration it timed, or
a benchmark score from a committed run. Heuristic "capability" scores are not
accepted — [`tests/unit/measuredMetrics.test.ts`](tests/unit/measuredMetrics.test.ts)
enforces this.

---

## Development setup

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io/) 10+

```bash
git clone https://github.com/HelloblueAI/bleujs-reasoning-lab.git
cd bleujs-reasoning-lab
pnpm install
pnpm run check   # format + lint + type-check + unit tests + eval harness
```

`pnpm run check` is the single gate CI enforces. Run it before opening a PR.

### Claim an issue

Comment `I'll take this` on the GitHub issue before you start, then open one
focused PR that says `Closes #N`. The issue is the source of truth; the
[starter index](docs/GOOD_FIRST_ISSUES.md) is only a map.

### LLM features locally

Evaluations and benchmarks run **offline** without API keys. To exercise
`/reason` and the dashboard against a live provider:

```bash
cp .dev.vars.example .dev.vars
# set BLEUJS_API_KEY (primary). Optional fallbacks require ALLOW_LLM_FALLBACK=true
pnpm run worker:dev   # http://localhost:8787
```

---

## Making changes

1. **Fork** and branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
2. **Keep scope focused** — one logical change per PR.
3. **Add or update tests** when behavior changes:
   - Smoke evaluations: `src/evals/tasks.ts`, `src/evals/runner.ts`
   - Benchmarks: `src/evals/benchmarks/`, `tests/eval/`
   - Unit logic: `tests/unit/`
   - Prefer exact, measurable assertions.
4. **Match existing style** — TypeScript strict mode, no simulated telemetry.
5. **Open a pull request** against `main` and fill out the template.

## What we welcome

- New benchmark items with fixed datasets and exact scoring
- Honest metrics and API clarity (`/capabilities`, `/metrics`, `/reason`)
- The autonomous goal execution loop (see [docs/LAB_PLAN.md](docs/LAB_PLAN.md))
- Documentation and contributor-experience improvements

## What we will likely decline

- "Consciousness", "quantum", or AGI marketing in code, APIs, or docs
- `Math.random()` or hardcoded capability scores in production responses
- Large refactors unrelated to an open issue or roadmap phase

---

## CI

Pull requests run [.github/workflows/lab-ci.yml](.github/workflows/lab-ci.yml),
which executes `format:check`, `lint`, `type-check`, unit tests, the eval/benchmark
harness, and a Worker bundle dry-run. Fix failing checks before requesting review.

## Deployment

**Only maintainers** deploy to production (`pnpm run deploy:worker:prod`).
Contributors do not need Cloudflare access to submit PRs.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Report
conduct issues to **info@helloblue.ai**.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
