# API Access — agi.bleujs.org

## Symptom

`curl https://agi.bleujs.org/metrics` returns HTML titled **"Just a moment..."** with HTTP **403**.

That is **Cloudflare's Managed Challenge** (Bot Fight Mode / Super Bot Fight Mode), not your Worker. The deploy succeeded; the zone proxy blocks scripted clients before the request reaches `agi-primary`.

Browsers pass the challenge; `curl` does not.

---

## Fix 1: WAF skip rule for API paths (recommended)

In [Cloudflare Dashboard](https://dash.cloudflare.com) → zone for **bleujs.org** (or **agi.bleujs.org** if separate):

1. **Security** → **WAF** → **Custom rules** → **Create rule**
2. **Rule name:** `AGI Lab API — skip bot challenge`
3. **Expression (Edit expression):**

```
(http.host eq "agi.bleujs.org" and (
  starts_with(http.request.uri.path, "/health") or
  starts_with(http.request.uri.path, "/metrics") or
  starts_with(http.request.uri.path, "/eval") or
  starts_with(http.request.uri.path, "/goals") or
  starts_with(http.request.uri.path, "/status") or
  starts_with(http.request.uri.path, "/consciousness") or
  starts_with(http.request.uri.path, "/reason") or
  starts_with(http.request.uri.path, "/learn") or
  starts_with(http.request.uri.path, "/create")
))
```

4. **Choose action:** **Skip**
5. Under **WAF components to skip**, enable:
   - Super Bot Fight Mode (if present)
   - Bot Fight Mode (if present)
   - All remaining custom rules (optional — only if other rules also block APIs)
6. **Deploy**

Wait ~30 seconds, then:

```bash
curl -sS https://agi.bleujs.org/health | jq .
curl -sS https://agi.bleujs.org/metrics | jq .
curl -sS https://agi.bleujs.org/eval | jq '.data.passRate'
```

---

## Fix 2: Lower security for the subdomain (broader)

**Rules** → **Configuration Rules** → **Create rule**

- **When:** Hostname equals `agi.bleujs.org`
- **Then:** Security Level = **Essentially Off**

Use only if Fix 1 is insufficient. Keeps the rest of `bleujs.org` unchanged if the rule is host-scoped.

---

## Fix 3: Disable Bot Fight Mode (zone-wide — not recommended)

**Security** → **Bots** → turn off **Bot Fight Mode** / **Super Bot Fight Mode**.

Affects the whole zone. Prefer Fix 1.

---

## Fix 4: Test via workers.dev (bypasses zone WAF)

`wrangler.toml` sets `workers_dev = true` for production. After redeploy:

```bash
pnpm run deploy:worker:prod
```

Find the URL in deploy output or:

**Workers & Pages** → **agi-primary** → **Triggers** → `*.workers.dev`

```bash
curl -sS "https://agi-primary.<your-subdomain>.workers.dev/health"
curl -sS "https://agi-primary.<your-subdomain>.workers.dev/metrics"
```

`workers.dev` does not go through `agi.bleujs.org` zone bot settings. Good for CI and `curl`; use the custom domain for the public site after Fix 1.

---

## Verify Worker is deployed

```bash
npx wrangler deployments list --env production
npx wrangler tail --env production
# In another terminal:
curl https://agi.bleujs.org/health   # after WAF fix
```

Tail should show JSON log lines when requests reach the Worker.

---

## Optional: API key for write endpoints

`/reason`, `/learn`, `/create` are public POST endpoints. For production hardening (Phase 2), add a `Authorization: Bearer` check in `primary-agi-worker.ts` and store the secret with:

```bash
npx wrangler secret put AGI_API_KEY --env production
```

Not required to fix the current 403 challenge issue.
