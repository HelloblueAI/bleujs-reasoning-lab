# Serving your instance on a custom domain

By default a deployed Worker is reachable at
`https://<worker-name>.<your-subdomain>.workers.dev`. To serve it on your own
domain instead:

1. Add the domain as a zone in your Cloudflare account and make sure a proxied
   DNS record exists for the hostname you want to use.
2. In your `wrangler.production.toml` (copied from
   [`wrangler.example.toml`](../../wrangler.example.toml)), set the route:

   ```toml
   [env.production]
   name = "<your-worker-name>"
   routes = ["<your-hostname>/*"]
   ```

3. Deploy:

   ```bash
   pnpm run deploy:worker:prod
   ```

## Verify

```bash
curl https://<your-hostname>/health
curl https://<your-hostname>/capabilities
```

If these return an HTML challenge page instead of JSON, see
[API_ACCESS.md](API_ACCESS.md).
