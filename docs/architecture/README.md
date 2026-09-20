# Architecture

The lab runs as a **single Cloudflare Worker** with process-scoped engines. There
is one request entry point and no external database; optional Cloudflare KV is
used only for caching and routing counters.

## Request path

```
HTTP request
   │
   ▼
src/worker/index.ts            # routing, validation, dashboard, CORS
   │
   ├── routing/RealLLMIntegration     # BleuJS → NVIDIA → Anthropic → OpenAI
   ├── routing/arithmeticReason       # local math, no LLM round-trip
   ├── tools/ToolSystem               # keyword baseline for tool selection
   ├── retrieval/semanticRetrieval (+ embedding providers)
   ├── metrics/* (counters, latency samples, status payloads)
   └── evals/benchmarks/runner (GET /eval)
```

## Design principles

- **One application path.** No alternate workers or entry points on `main`.
- **Measured, not scored.** Every number in an API response is a counter this
  Worker incremented, a duration it timed, or a benchmark score from a committed
  run at a recorded git SHA. The lab never grades its own "understanding" —
  heuristic capability scores were removed in v6.0.0 and are guarded by
  `tests/unit/measuredMetrics.test.ts`.
- **Offline-capable core.** Arithmetic, retrieval, tool selection, routing, and
  the benchmark suite run without any API keys. LLM calls are strictly optional.
- **Almost no request-time state.** The only per-isolate state is the provider
  client, request counters, and a bounded ring buffer of latency samples.
  Cross-isolate provider counts live in Cloudflare KV.

## Provider routing

`RealLLMIntegration` tries providers in order and records which one answered so
`/metrics` can report per-provider counts and a fallback rate:

1. BleuJS API (`BLEUJS_API_KEY`)
2. NVIDIA Nemotron Lightning (fallback, when `ALLOW_LLM_FALLBACK=true`)
3. Anthropic
4. OpenAI

Simple arithmetic short-circuits the chain entirely via `arithmeticReason`.

## Evaluations

- **Offline benchmarks** (`src/evals/benchmarks/runner.ts`) score deterministic
  baselines on fixed datasets and write `src/evals/results/latest.json`.
- **Model-in-the-loop benchmarks** (`src/evals/benchmarks/modelRunner.ts`) send
  the same datasets to a hosted model, repeating each item and scoring by
  majority vote because decoding is sampled.

See [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) for the full file layout.
