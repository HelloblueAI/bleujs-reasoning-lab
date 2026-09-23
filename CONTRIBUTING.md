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

- `src/worker/` — Cloudflare Worker (HTTP API + dashboard) and access checks
- `src/evals/` — benchmark CLIs (`cli.ts`, `modelCli.ts`) and the logic puzzles
  - `src/evals/benchmarks/` — datasets (`datasets.ts`), offline runner, model-in-the-loop runner
  - `src/evals/model/` — evaluation-only model config and client
  - `src/evals/results/` — committed results served by the API
- `src/routing/` — LLM provider integration, prompt shaping, local arithmetic, routing metrics
- `src/retrieval/` — embedding providers + semantic ranking
- `src/tools/` — keyword tool router used as the tool-selection baseline
- `src/metrics/` — request counters, latency samples, status/endpoint payloads
- `src/utils/` — logger, id helpers

**One rule worth knowing before you add a metric:** every number in an API
response must trace to a counter the Worker incremented, a duration it timed, or
a benchmark score from a committed run. Heuristic "capability" scores are not
accepted — [`tests/unit/measuredMetrics.test.ts`](tests/unit/measuredMetrics.test.ts)
enforces this.

**Provenance notes stay.** When a published result turns out to be mislabelled or
flawed, add a correction next to the original disclosure; never delete the
disclosure to make the history look cleaner. The README's provenance note for the
Nemotron 3 Super run is guarded by
[`tests/unit/reproducibilityRecord.test.ts`](tests/unit/reproducibilityRecord.test.ts).

---

## Development setup

**Requirements:** Node.js 22.12+, [pnpm](https://pnpm.io/) 10+

```bash
git clone https://github.com/HelloblueAI/bleujs-reasoning-lab.git
cd bleujs-reasoning-lab
pnpm install
pnpm run check   # format + lint + type-check + unit tests + eval harness
```

`pnpm run check` runs everything CI checks except the Worker bundle dry-run and
the secret scan. Run it before opening a PR.

### Claim an issue

Comment `I'll take this` on the GitHub issue before you start, then open one
focused PR that says `Closes #N`. The issue is the source of truth; the
[starter index](docs/GOOD_FIRST_ISSUES.md) is only a map.

### LLM features locally

Offline benchmarks (`pnpm run eval`) need no API keys. To exercise `/reason`
and the dashboard against a live provider:

```bash
cp .dev.vars.example .dev.vars
# set at least one provider key; fallback between providers needs ALLOW_LLM_FALLBACK=true
pnpm run worker:dev   # http://localhost:8787
```

Model-in-the-loop benchmarks (`pnpm run eval:model`) read their own key,
`NVIDIA_EVAL_API_KEY`, from the same `.dev.vars` file — see
[Reproducing the published results](README.md#reproducing-the-published-results).

---

## Making changes

1. **Fork** and branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
2. **Keep scope focused** — one logical change per PR.
3. **Add or update tests** when behavior changes:
   - Dataset items: `src/evals/benchmarks/datasets.ts` (tag each `core` or `hard`;
     `tests/unit/datasetTiers.test.ts` checks baselines pass core and fail hard)
   - Benchmark runners: `src/evals/benchmarks/`, tested in `tests/eval/`
   - Unit logic: `tests/unit/`
   - Prefer exact, measurable assertions.
4. **Match existing style** — TypeScript strict mode, no simulated telemetry.
5. **Open a pull request** against `main` and fill out the template.

## What we welcome

- New benchmark items with fixed datasets and exact scoring — especially hard
  retrieval and tool-selection items, which are still saturated
- Confidence intervals and cost-per-correct-answer reporting
  ([Phase 3](docs/LAB_PLAN.md#phase-3-report-results-with-real-statistics))
- Cross-vendor model runs on the same datasets
  ([Phase 4](docs/LAB_PLAN.md#phase-4-cross-vendor-baselines))
- API clarity for `/status`, `/capabilities`, `/eval`, and `/reason`
- Documentation and contributor-experience improvements

## What we will likely decline

- "Consciousness", "quantum", or AGI marketing in code, APIs, or docs
- `Math.random()` or hardcoded capability scores in production responses
- Large refactors unrelated to an open issue or roadmap phase

---

## CI

Pull requests run [.github/workflows/lab-ci.yml](.github/workflows/lab-ci.yml),
which executes `format:check`, `lint`, `type-check`, unit tests, the eval/benchmark
harness, a Worker bundle dry-run, and a gitleaks secret scan of the new commits.
Fix failing checks before requesting review.

## Deployment

Contributors do not need Cloudflare access to submit PRs. To run your own
instance, copy `wrangler.example.toml` to `wrangler.production.toml` (gitignored)
and follow [docs/deployment/](docs/deployment/).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Report
conduct issues to **info@helloblue.ai**.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
