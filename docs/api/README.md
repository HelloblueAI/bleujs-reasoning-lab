# API reference

The Worker exposes a small REST API. Base URLs:

- Custom domain: `https://agi.bleujs.org`
- Worker: `https://agi-primary.morning-star-e026.workers.dev`
- Local: `http://localhost:8787` (via `pnpm run worker:dev`)

All responses are JSON. CORS is open for GET and POST. No authentication is
required for the read endpoints. Every metric is derived from measured
learning-engine state — there is no simulated telemetry.

---

## `GET /health`

Liveness probe.

```json
{ "status": "healthy", "system": "BleuJS Reasoning Lab", "version": "5.1.0" }
```

## `GET /metrics`

Request counters, measured latency percentiles, and LLM routing counts
(`bleujs` / `nvidia` / `anthropic` / `openai` / `local` / `none`) with a
`fallbackRate`. Routing counts are global when the `AGI_CACHE` KV binding is set.

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
prompts use the configured provider chain (BleuJS → NVIDIA → Anthropic → OpenAI).

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
    "llmProvider": null
  }
}
```

`llmProvider` identifies which backend answered (`bleujs`, `nvidia`, `anthropic`,
or `openai`); it is `null` when the local arithmetic path is used.

---

## Errors

```json
{ "success": false, "error": "Invalid input" }
```

Requests over 1 MB return `413`; malformed JSON returns `400`; unavailable
subsystems return `503`.
