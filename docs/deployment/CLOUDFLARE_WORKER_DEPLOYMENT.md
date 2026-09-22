# Deploying your own instance

The lab is a single Cloudflare Worker with entry point `src/worker/index.ts`.

Two config files are involved:

- [`wrangler.toml`](../../wrangler.toml) — local development and CI. No routes,
  IDs, or production settings.
- `wrangler.production.toml` — your real deployment config. It is gitignored;
  create it from the template:

  ```bash
  cp wrangler.example.toml wrangler.production.toml
  # replace every <placeholder>
  ```

## Deploy

```bash
pnpm install
pnpm run check                 # optional: run the full gate first
pnpm run deploy:worker:dry-run # validate the bundle and bindings
pnpm run deploy:worker:prod    # wrangler deploy --config wrangler.production.toml --env production
```

## Secrets

Set provider keys as Wrangler secrets (never commit them):

```bash
CFG="--config wrangler.production.toml --env production"
npx wrangler secret put BLEUJS_API_KEY $CFG
# optional additional providers (tried when ALLOW_LLM_FALLBACK="true")
npx wrangler secret put NVIDIA_API_KEY $CFG
npx wrangler secret put ANTHROPIC_API_KEY $CFG
npx wrangler secret put OPENAI_API_KEY $CFG
# optional: enables operator-only GET /metrics
npx wrangler secret put METRICS_TOKEN $CFG
```

## Verify endpoints

```bash
BASE=https://<your-worker-url>
curl $BASE/health
curl $BASE/capabilities
curl $BASE/eval
curl -X POST $BASE/reason -H "Content-Type: application/json" -d '{"input":"2 + 2"}'
curl -H "Authorization: Bearer $METRICS_TOKEN" $BASE/metrics
```

## Logs

```bash
pnpm run worker:tail
```
