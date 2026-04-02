# Load Testing

This folder contains baseline k6 scripts for backend capacity checks.

## Public Form Read Burst

Simulates burst traffic against `GET /public/forms/:slug` up to 1000 virtual users.

```bash
k6 run \
  -e BASE_URL=http://localhost:3001 \
  -e FORM_SLUG=your-form-slug \
  scripts/loadtest/public-form.k6.js
```

Suggested target thresholds:
- `http_req_failed < 1%`
- `p95 < 500ms`
- `p99 < 1000ms`

