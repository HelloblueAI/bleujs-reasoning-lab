# Contributing to BleuJS Reasoning

Thank you for helping improve this project. BleuJS Reasoning is an **MIT-licensed research lab** for measurable reasoning—not a claim of AGI or machine consciousness.

**Repository:** https://github.com/HelloblueAI/neural-quantum-consciousness-framework

---

## Where to start

| I want to… | Start here |
|------------|------------|
| Understand the roadmap | [docs/AGI_LAB_PLAN.md](docs/AGI_LAB_PLAN.md) |
| Run the live worker locally | [README.md](README.md#quick-start) |
| Find starter tasks | [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) |
| See what not to touch | [src/archive/README.md](src/archive/README.md) |

**Production code path (edit here):**

- `src/primary-agi-worker.ts` — Cloudflare Worker + dashboard
- `src/lab/` — honest metrics, API payloads
- `src/eval/` — benchmark tasks and runner
- `src/core/RealLLMIntegration.ts`, `UltimateAGIOrchestrator.ts` — reasoning pipeline

**Do not deploy or extend** without good reason: `src/archive/` (legacy workers and consciousness engines).

---

## Development setup

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io/) 8+

```bash
git clone https://github.com/HelloblueAI/neural-quantum-consciousness-framework.git
cd neural-quantum-consciousness-framework
pnpm install
```

### Verify your environment

```bash
pnpm run test:eval    # eval harness (required for PRs)
pnpm run test:unit    # unit tests
pnpm run eval         # CLI eval suite
pnpm run worker:dev   # local worker (Wrangler)
```

Optional: `pnpm run type-check` (may report errors in archived paths—focus on files you change).

### LLM features locally

Reasoning with Claude requires API keys. For local Wrangler dev:

```bash
npx wrangler secret put ANTHROPIC_API_KEY --env production   # deploy secrets
# or use .dev.vars for local dev (do not commit)
```

Eval tests run **offline** without keys.

---

## Making changes

1. **Fork** the repo and create a branch from `main`:
   - `feat/short-description` — new behavior
   - `fix/short-description` — bug fixes
   - `docs/short-description` — documentation only
   - `chore/short-description` — tooling, deps, CI

2. **Keep scope focused** — one logical change per PR. Avoid reviving archived consciousness/quantum modules.

3. **Add or update tests** when behavior changes:
   - Eval tasks: `src/eval/tasks.ts`, `tests/eval/`
   - Lab logic: `tests/unit/`
   - Prefer measurable assertions over vanity metrics.

4. **Match existing style** — TypeScript strict mode, minimal comments, no simulated API telemetry.

5. **Open a pull request** against `main` and fill out the PR template.

---

## What we welcome

- Eval tasks and pass-rate improvements
- Honest metrics and API clarity (`/capabilities`, `/metrics`, `/reason`)
- Autonomous goal loop (Phase 2 in [AGI_LAB_PLAN.md](docs/AGI_LAB_PLAN.md))
- Documentation, deployment guides, contributor experience
- Bug fixes in the **primary worker path**

## What we will likely decline

- New “consciousness”, “quantum”, or fake AGI marketing in live APIs
- New worker variants without clearing the consolidation plan
- `Math.random()` or hardcoded capability scores in production responses
- Large refactors unrelated to an open issue or plan phase

---

## CI

Pull requests run [.github/workflows/lab-ci.yml](.github/workflows/lab-ci.yml):

- `pnpm run test:eval`
- `pnpm run test:unit`

Fix failing checks before requesting review.

---

## Deployment

**Only maintainers** deploy to production:

```bash
pnpm run deploy:worker:prod
```

Contributors do not need Cloudflare access to submit PRs. Describe manual test steps in the PR if you exercised `worker:dev`.

---

## Code of conduct

Be respectful and constructive. Critique code and ideas, not people. We are building a credible lab others can trust.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
