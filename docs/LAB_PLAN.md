# BleuJS Reasoning Lab — measurable roadmap

**Live site:** https://agi.bleujs.org
**Canonical code:** `src/worker/index.ts` + `src/evals/`

## North star

Answer one question well: **what does reasoning mode actually buy you, per task
type, and what does it cost?** Labs publish accuracy and omit the token and
latency bill. This lab measures both on the same fixed datasets, so the tradeoff
is visible.

The deliverable is a **citable measurement**, not a new model and not a claim of
general intelligence.

---

## Phase 1: Foundation (done)

- [x] Single production Worker (`src/worker/index.ts`)
- [x] Legacy consciousness/quantum/true-AGI code removed from `main` (history retained)
- [x] Offline benchmarks over fixed datasets with exact grading
- [x] Benchmark results committed to `src/evals/results/latest.json`
- [x] `pnpm check` (format + lint + type-check + tests + evals) enforced in CI
- [x] Model-in-the-loop benchmarks: same datasets, sampled decoding, majority vote
- [x] Reasoning on / low / off variants recorded with token and latency cost
- [x] Eval provider config isolated from production routing (`NVIDIA_EVAL_API_KEY`)

## Phase 1.5: Unmeasured claims removed (done, v6.0.0)

Deleted the hand-rolled neural network, regex concept extractor, cross-domain
"insight" generator, autonomous goal system, self-improvement loop, and the
heuristic capability scores (`understandingDepth`, `adaptability`, `systemDepth`)
that were formulas over request counters clamped to 0.95. Removed the `/learn`,
`/create`, and `/goals` endpoints that published them.

None of it ever affected a user-facing answer. `tests/unit/measuredMetrics.test.ts`
fails if any of it returns.

---

## Phase 2: Make the datasets able to discriminate (done)

**Problem:** every model variant scored 1.000 on retrieval and the 3x3 puzzle, so
the harness could not separate the configurations it exists to compare.

- [x] Difficulty tiers (`core` / `hard`) on every item, reported as `tierScores`
- [x] Hard arithmetic: order of operations, percentages, exponents, unit
      conversion, multi-step word problems (20 items)
- [x] A 5x5 logic puzzle requiring chained elimination plus ordering constraints
- [x] Near-miss retrieval where the correct passage shares *fewer* words with the
      query than the distractors do
- [x] Adversarial abstention: arithmetic-shaped questions that are unanswerable
      because they need an external fact, live data, or are undefined
- [x] Dataset grew from 39 to 84 items; a test enforces that baselines pass every
      core item and fail every hard one

**Result:** reasoning-off separates from reasoning-on by 16 points on the hard
tier (80% vs 96%), concentrated in the 5x5 puzzle (40% vs 100%) and hard
arithmetic (80% vs 100%). `low` matched `on` at 5x fewer completion tokens.

**Still saturated:** hard retrieval and hard tool selection score 100% in every
mode, so they discriminate between baselines but not between model
configurations. Making those discriminate is open work.

---

## Phase 3: Report results with real statistics

1. Bootstrap confidence intervals on every reported score.
2. State the minimum detectable difference for each dataset size.
3. Flag saturated benchmarks automatically instead of relying on a prose caveat.
4. Publish a cost-per-correct-answer column (completion tokens ÷ items correct).

**Measure:** no score is published without an interval, and "these two configs
are tied" becomes a computed claim rather than a judgement call.

---

## Phase 4: Cross-vendor baselines

Committed model results are currently all NVIDIA variants, so a comparative lab
has nothing to compare. Record the same datasets against Anthropic and OpenAI
reasoning models at matched concurrency, then publish the reasoning-mode cost
curve across vendors.

**Measure:** one table, three vendors, identical datasets and graders, with
intervals and token cost.

---

## What we are NOT doing

- Claiming consciousness, sentience, or AGI achievement
- Training or fine-tuning models — this lab measures hosted models
- Scoring our own "understanding", "adaptability", or "depth"
- Publishing any number that cannot be traced to a counter, a timer, or a
  reproducible benchmark run at a recorded git SHA

## Commands

```bash
pnpm run eval                 # offline benchmarks, refresh results/latest.json
pnpm run eval:model           # hosted-model scores on the same datasets
pnpm run worker:dev           # local worker
pnpm run deploy:worker:prod   # production deploy (maintainers)
pnpm run check                # full CI gate locally
```

## Success criteria

1. One worker, one story — `agi.bleujs.org` is the lab, not a demo graveyard.
2. Every published number is reproducible from a git SHA.
3. Datasets hard enough that reasoning-mode differences are statistically real.
4. A reasoning-mode cost curve across at least three vendors that someone else
   would cite.

This is not AGI. It is an honest measurement someone could build on.
