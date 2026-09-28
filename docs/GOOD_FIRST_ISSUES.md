# Good first issues

Pick an **open labeled issue**, comment that you are taking it, then open a PR
that references the number (`Closes #N`). This page is an index. The GitHub
issue is the source of truth.

**Open good first issues:**
https://github.com/HelloblueAI/bleujs-reasoning-lab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22

Ask questions on the issue if you are stuck. Run `pnpm run check` before you
open a PR. You do not need API keys or Cloudflare access for the benchmark and
docs tasks.

---

## How to claim

1. Comment on the issue (`I'll take this`) so two people do not start the same
   task.
2. Fork and branch from `main` (`feat/…`, `fix/…`, or `docs/…`).
3. Keep the change to that issue only.
4. Fill in the pull request template and mention the issue number.

If nobody has replied after a few days, you can still open the PR — just say so
in the description.

---

## Open starter tasks

No API key and no Cloudflare access. Each issue names the file and the test that
will check the change.

| Issue                                                                | Labels           | Task                                                                 |
| -------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| [#69](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/69) | good first issue | One hard retrieval query the word-overlap baseline misses            |
| [#70](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/70) | good first issue | One hard tool-selection request the keyword router gets wrong        |
| [#34](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/34) | good first issue | One routing fixture where OpenAI is the provider that succeeds       |
| [#71](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/71) | help wanted      | Completion tokens per correct hard-tier item, from committed results |

Docs-only PRs that keep `README.md` and `docs/api/README.md` curl examples in
sync with `POST /reason` are also welcome — no issue required.

---

## Already shipped (do not reopen)

- Arithmetic benchmark expansion — [#35](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/35) / [#46](https://github.com/HelloblueAI/bleujs-reasoning-lab/pull/46) ([Saubhagya Chopra](https://github.com/saubhagya-chopra))
- Retrieval query — [#33](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/33) / [#54](https://github.com/HelloblueAI/bleujs-reasoning-lab/pull/54) ([Saubhagya Chopra](https://github.com/saubhagya-chopra))
- First held-out logic puzzle — [#9](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/9) ([Kartavya Dikshit](https://github.com/KartavyaDikshit))
- Second logic puzzle (hard-tier 5×5) — [#28](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/28), landed with the difficulty tiers
- Dashboard `GET /eval` pass rate — [#29](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/29)
- Hosted-model benchmarks — [#36](https://github.com/HelloblueAI/bleujs-reasoning-lab/issues/36), shipped as `pnpm run eval:model` instead of inside the offline suite
- Eval result persistence — `pnpm run eval` writes `src/evals/results/latest.json`

---

## Before you start

- Read [CONTRIBUTING.md](../CONTRIBUTING.md).
- Run `pnpm run check` locally; CI runs the same gate.
- Keep claims measurable — say what a change proves, not what it "feels" like.
