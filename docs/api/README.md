# API reference

The Worker exposes a small REST API. Locally it runs at `http://localhost:8787`
(via `pnpm run worker:dev`); a public demo runs at https://agi.bleujs.org.

All responses are JSON. CORS is open for GET and POST. Public endpoints need no
authentication and return research results only; operational telemetry is
served solely by the token-gated `GET /metrics`.

---

## `GET /health`

Liveness probe.

```json
{ "status": "healthy", "system": "BleuJS Reasoning Lab", "version": "5.1.0" }
```

## `GET /status`

Version, feature flags, and the committed benchmark summary.

## `GET /metrics` (operator-only)

Request counters, latency percentiles, and per-provider routing counts for the
instance operator. Requires `Authorization: Bearer <METRICS_TOKEN>`; without a
valid token (or when `METRICS_TOKEN` is unset) it returns the same `404` as an
unknown path.

## `GET /capabilities`

Benchmark scores from the last committed offline run, with the dataset path, the
git SHA to reproduce them, and a `limitations` list. These are not self-assessed
capability scores: run `pnpm run eval` at the recorded SHA to get the same
numbers.

Heuristic scores (`understandingDepth`, `adaptability`, `systemDepth`) were
removed in v6.0.0 — they were formulas over request counters that measured
nothing.

## `GET /eval`

Runs the offline benchmark suite and returns per-benchmark scores. The suite is
deterministic, so the response matches the committed run at the same commit. For
hosted-model scores on the same datasets, use `pnpm run eval:model`.

## `POST /reason`

Answer-first reasoning. Simple arithmetic is answered locally (no LLM); other
prompts go to the configured hosted model (see `src/routing/`).

```bash
curl -X POST http://localhost:8787/reason \
  -H "Content-Type: application/json" \
  -d '{"input": "144 / 12"}'
```

```json
{
  "success": true,
  "data": {
    "system": "BleuJS Reasoning Lab",
    "input": "144 / 12",
    "answer": "144 ÷ 12 = 12",
    "llmUsed": false,
    "answerSource": "local-arithmetic",
    "error": null
  }
}
```

`answerSource` is `local-arithmetic` or `model`. When no answer could be
produced, `error` is `{ "code": ..., "retryable": ... }` with one of
`model_not_configured`, `model_rate_limited`, `model_temporarily_unavailable`,
or `model_unavailable`. Upstream error details are logged server-side and never
returned.

---

## Errors

```json
{ "success": false, "error": "Invalid input" }
```

Requests over 1 MB return `413`; malformed JSON returns `400`; clients over the
optional `/reason` rate limit get `429`.
