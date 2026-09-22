# Project structure

The default branch contains a single application path: a Cloudflare Worker that
exposes a reasoning API, plus an evaluation harness. Legacy experiments were
removed from the working tree (they remain in git history).

## Root

```
.
├── README.md
├── LICENSE
├── package.json            # scripts + dependencies (openai is the only runtime dep)
├── pnpm-lock.yaml
├── tsconfig.json           # base TS config (includes src/**)
├── tsconfig.test.json      # extends base; adds tests/**
├── vitest.config.ts
├── wrangler.toml           # local dev + CI Worker config (no production IDs)
├── wrangler.example.toml   # template for your own deployment (copy to wrangler.production.toml)
├── .github/workflows/lab-ci.yml
├── docs/
├── src/
└── tests/
```

## Source (`src/`)

```
src/
├── worker/
│   └── index.ts            # Worker entry (HTTP routes + embedded dashboard)
├── tools/
│   └── ToolSystem.ts       # keyword baseline for the tool-selection benchmark
├── routing/
│   ├── RealLLMIntegration.ts      # BleuJS → NVIDIA → Anthropic → OpenAI
│   ├── reasonPrompt.ts / reasonResponse.ts
│   ├── arithmeticReason.ts        # local math (no LLM round-trip)
│   └── llmRoutingMetrics.ts
├── retrieval/
│   ├── embeddingProvider.ts       # LearnedEmbeddingProvider interface
│   ├── NVIDIAEmbeddingProvider.ts / OpenAIEmbeddingProvider.ts
│   └── semanticRetrieval.ts       # bag-of-words + provider ranking
├── metrics/
│   ├── labStatus.ts / endpointResponses.ts     # API payloads (measured only)
│   ├── benchmarkSummary.ts                     # reads committed eval results
│   └── requestCounters.ts                      # counters + latency samples
├── evals/
│   ├── logicPuzzle.ts                          # constraint puzzle + solver
│   ├── schema.ts                               # benchmark result types
│   ├── cli.ts / modelCli.ts                    # `pnpm run eval` / `eval:model`
│   ├── benchmarks/                             # fixed-dataset benchmarks
│   │   ├── datasets.ts
│   │   ├── runner.ts                           # offline, deterministic
│   │   └── modelRunner.ts                      # model-in-the-loop, sampled
│   ├── model/                                  # eval-only provider config
│   └── results/                                # committed benchmark output
└── utils/
    └── Logger.ts / uuid.ts
```

Import aliases use `@/*` → `src/*` (see `tsconfig.json`).

## Tests (`tests/`)

```
tests/
├── setup.ts                # mocks the openai SDK only
├── unit/                   # routing, retrieval, metrics, arithmetic, eval model
│                           # incl. measuredMetrics.test.ts — guards that no
│                           # payload reports an unmeasured "capability" score
└── eval/                   # benchmark suite
```

## Docs (`docs/`)

```
docs/
├── LAB_PLAN.md             # measurable roadmap
├── GOOD_FIRST_ISSUES.md    # index of labeled starter issues
├── PROJECT_STRUCTURE.md    # this file
├── api/README.md
├── architecture/README.md
├── deployment/             # Cloudflare domain + worker deployment notes
└── development/GITHUB_ACTIONS.md
```
