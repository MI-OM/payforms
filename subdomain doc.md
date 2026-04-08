Production env and deploy checklist

Rotate exposed secrets first

- The workspace currently contains a real-looking [apps/backend/.env](apps/backend/.env) file with Paystack and Mailgun credentials.
- If that file was ever committed, uploaded, or shared, rotate those secrets before deploy.

Vercel production envs

Required:

```env
NEXT_PUBLIC_APP_URL=https://payforms.com.ng
NEXT_PUBLIC_API_URL=https://api.payforms.com.ng
NEXT_PUBLIC_APP_NAME=Payforms
BACKEND_URL=https://api.payforms.com.ng
NODE_ENV=production
```

Notes:

- `BACKEND_URL` is required for the Next.js API proxy routes under `pages/api/public/*`.
- `NEXT_PUBLIC_APP_URL` stays on the apex domain, while runtime callback logic keeps tenant users on their active subdomain.

Render backend production envs

Required:

```env
NODE_ENV=production
PORT=3001

DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=...

JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=https://payforms.com.ng
PUBLIC_API_BASE_URL=https://api.payforms.com.ng
TENANT_BASE_DOMAIN=payforms.com.ng
AUTH_COOKIE_DOMAIN=payforms.com.ng

AUTH_ACCESS_TOKEN_TTL=15m
AUTH_REFRESH_TOKEN_TTL=30d
CONTACT_ACCESS_TOKEN_TTL=8h

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=120

EMAIL_PROVIDER=mailgun
EMAIL_FROM=contact@yourdomain.com
EMAIL_FROM_NAME=Payforms
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
MAILGUN_BASE_URL=https://api.mailgun.net/v3
MAILGUN_FROM=contact@yourdomain.com
```

Conditional:

```env
CACHE_REDIS_ENABLED=true
REDIS_URL=...
REDIS_TLS=true
REDIS_CONNECT_TIMEOUT_MS=10000
```

Optional:

```env
ENABLE_SWAGGER=false
DB_POOL_MAX=50
DB_POOL_MIN=5
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
```

Notes:

- `AUTH_COOKIE_DOMAIN=payforms.com.ng` allows auth cookies to work on both `payforms.com.ng` and `*.payforms.com.ng`.
- `PUBLIC_API_BASE_URL` keeps embed/widget URLs stable behind Render proxying.
- `ENABLE_SWAGGER` should stay unset or `false` in production.
- The backend code does not require global Paystack env keys for runtime tenant payments if organizations store their own keys, but keeping old test keys in env is a liability.

Domains and DNS

In Vercel add:

- `payforms.com.ng`
- `*.payforms.com.ng`

In DNS add:

```dns
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com.
CNAME  *      cname.vercel-dns.com.
```

Tight deploy checklist

1. Rotate any Paystack and Mailgun secrets that may have been exposed from [apps/backend/.env](apps/backend/.env).
2. In Render, set all required backend env vars, especially `JWT_SECRET`, `FRONTEND_URL`, `PUBLIC_API_BASE_URL`, `TENANT_BASE_DOMAIN`, and `AUTH_COOKIE_DOMAIN`.
3. In Vercel, set all required frontend env vars, especially `BACKEND_URL` in addition to `NEXT_PUBLIC_*` values.
4. In Vercel, confirm both domains exist: apex and wildcard.
5. In DNS, confirm the wildcard `CNAME *` exists and has propagated.
6. Redeploy backend first so CORS, cookies, and tenant host resolution are live.
7. Redeploy frontend second so public routes and callback handling use the right env values.
8. Open `https://payforms.com.ng` and verify the main app loads.
9. Open a tenant host such as `https://om.payforms.com.ng` and verify it resolves without `NXDOMAIN`.
10. Log in as admin on a tenant host and confirm login, refresh, and logout work without storing tokens in local storage.
11. Run one public payment flow and confirm Paystack returns to the same tenant host.
12. Confirm webhook verification updates the payment record to paid.
13. Trigger one outbound email flow and confirm Mailgun sends successfully.
14. If Redis is enabled, verify the backend starts cleanly with no Redis connection errors.

Fast failure map

- `DNS_PROBE_FINISHED_NXDOMAIN`: wildcard domain or wildcard DNS missing.
- `CORS blocked for origin`: backend origin allowlist or env mismatch.
- login works on apex but fails on tenant host: `AUTH_COOKIE_DOMAIN` missing or wrong.
- public form proxy routes fail on Vercel: `BACKEND_URL` missing.
- widget/embed links point to wrong host: `PUBLIC_API_BASE_URL` missing or wrong.
- payment callback lands on wrong domain: `FRONTEND_URL` wrong or stale frontend build.
- email flow fails: `EMAIL_PROVIDER` or provider-specific keys/from-address mismatch.