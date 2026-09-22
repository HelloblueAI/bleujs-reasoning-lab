# API access behind an edge / WAF

If you put your instance behind a CDN or WAF (for example Cloudflare on a custom
domain), bot-protection features may challenge scripted clients such as `curl`
before a request reaches the Worker. A challenge usually looks like an HTML page
with HTTP 403 instead of the JSON the API returns.

Configure your edge so the API clients you intend to support can reach the API,
while keeping appropriate protections in place:

- Scope any exceptions as narrowly as you can (specific hostnames, paths, or
  authenticated clients) instead of lowering security for a whole zone.
- Keep rate limiting on `POST /reason`: it calls a paid model on every request.
  The Worker also supports an optional per-client limiter (`REASON_RATE_LIMITER`
  in [`wrangler.example.toml`](../../wrangler.example.toml)).
- If you disable `workers_dev`, all traffic must pass through your edge rules.
  If you leave it enabled, the `*.workers.dev` URL is not covered by zone rules.
- `GET /metrics` is operator-only and requires `Authorization: Bearer
  <METRICS_TOKEN>`; it does not need to be reachable by the public.

Refer to your provider's documentation for the specific rule syntax.

## Verify

```bash
BASE=https://<your-hostname>
curl -sS "$BASE/health"
curl -sS "$BASE/capabilities"
curl -sS -X POST "$BASE/reason" -H "Content-Type: application/json" -d '{"input":"2 + 2"}'
```

Each should return JSON. If you get HTML, the request was stopped at the edge.
