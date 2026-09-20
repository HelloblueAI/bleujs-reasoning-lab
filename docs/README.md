# Documentation

Documentation for the **BleuJS Reasoning Lab** — an open-source TypeScript
laboratory for evaluating LLM reasoning, provider routing, retrieval, tool
selection, and agent orchestration. It is an emerging, measurable lab, not a
mature AGI framework.

## Index

| Doc | Description |
|-----|-------------|
| [LAB_PLAN.md](LAB_PLAN.md) | Measurable roadmap and north star |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Repository layout |
| [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md) | Index of labeled starter issues |
| [api/README.md](api/README.md) | HTTP API reference |
| [architecture/README.md](architecture/README.md) | Worker + orchestrator design |
| [development/GITHUB_ACTIONS.md](development/GITHUB_ACTIONS.md) | CI pipeline |
| [deployment/](deployment/) | Cloudflare domain and Worker deployment notes |

## Evaluations

The lab separates **offline benchmarks** (deterministic baselines on fixed
datasets in `src/evals/benchmarks/runner.ts`, served by `GET /eval`, saved to
`src/evals/results/latest.json`) from **model-in-the-loop benchmarks** (the same
datasets sent to a hosted model in `modelRunner.ts`, scored by majority vote
over repeated sampled runs). Neither is evidence of general intelligence, and
the lab does not train models.

```bash
pnpm run eval          # offline benchmarks, refresh results/latest.json
pnpm run eval:model    # hosted-model scores on the same datasets
```
