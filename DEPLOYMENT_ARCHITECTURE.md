# Deployment Architecture: Vercel + Render

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Browser                                                   │
│      ↓                                                           │
│  https://payforms.com.ng  (Vercel Frontend)                    │
│      ├─ .env.production vars loaded                            │
│      ├─ NEXT_PUBLIC_APP_URL=https://payforms.com.ng            │
│      └─ NEXT_PUBLIC_API_URL=https://api.payforms.com.ng        │
│                                                                  │
│      ↓ Form Submit                                             │
│                                                                  │
│  https://api.payforms.com.ng (Render Backend)                  │
│      ├─ CORS allows https://payforms.com.ng                    │
│      ├─ Database: PostgreSQL                                   │
│      ├─ Mailer: SendGrid/Mailgun/Brevo                         │
│      └─ Paystack Integration                                   │
│                                                                  │
│      ↓ Payment Request                                         │
│                                                                  │
│  https://checkout.paystack.com (Paystack)                      │
│      └─ Redirects to: https://payforms.com.ng/paystack/callback│
│           (callback URL from NEXT_PUBLIC_APP_URL)              │
│                                                                  │
│      ↓ Verify Payment                                          │
│                                                                  │
│  Backend verifies with Paystack & sends email                  │
│      ↓                                                           │
│  User redirected to: https://payforms.com.ng/payment/success   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT (Local)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  http://localhost:5701 (Next.js Frontend)                       │
│      ├─ .env.local vars loaded                                 │
│      ├─ NEXT_PUBLIC_APP_URL=http://localhost:5701              │
│      └─ NEXT_PUBLIC_API_URL=http://localhost:3001              │
│                                                                  │
│      ↓ Form Submit                                             │
│                                                                  │
│  http://localhost:3001 (NestJS Backend)                        │
│      ├─ CORS allows http://localhost:5701                      │
│      ├─ Database: PostgreSQL (local)                           │
│      └─ Paystack Integration                                   │
│                                                                  │
│      ↓ Payment Request                                         │
│                                                                  │
│  https://checkout.paystack.com (Paystack)                      │
│      └─ Redirects to: http://localhost:5701/paystack/callback  │
│                                                                  │
│      ↓ Verify Payment                                          │
│                                                                  │
│  http://localhost:3001 verifies & sends email                  │
│      ↓                                                           │
│  User redirected to: http://localhost:5701/payment/success     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables Flow

```
Frontend (.env files)
  ↓
.env.local (dev)              .env.production (Vercel)
  ↓                           ↓
NEXT_PUBLIC_APP_URL       NEXT_PUBLIC_APP_URL
=localhost:5701           =payforms.com.ng
  ↓                           ↓
Loaded during npm run dev  Loaded during Vercel build
  ↓                           ↓
process.env.NEXT_PUBLIC_APP_URL
  ↓
src/utils/config.ts → appConfig
  ↓
getCallbackUrl() → Used in form submission
```

## File Structure

```
apps/frontend/
├── .env.local              ← Local development (git-ignored)
├── .env.production         ← Production (Vercel will use)
├── .env.example            ← Template for developers
├── vercel.json             ← Vercel build config (git-tracked)
├── next.config.js          ← Next.js config
├── package.json            ← Dependencies
├── tsconfig.json           ← TypeScript config
└── src/
    ├── utils/
    │   └── config.ts       ← NEW: Config utility (getCallbackUrl)
    ├── services/
    │   └── api.ts          ← API client (uses NEXT_PUBLIC_API_URL)
    └── pages/
        └── public/forms/
            └── [slug].tsx  ← UPDATED: Uses getCallbackUrl()
```

## Deployment Checklist

### Frontend (Vercel)
```
Step 1: Files Already in Repo
  ✅ apps/frontend/.env.local
  ✅ apps/frontend/.env.production
  ✅ apps/frontend/src/utils/config.ts
  ✅ apps/frontend/vercel.json
  ✅ apps/frontend/.env.example (updated)
  ✅ apps/frontend/src/pages/public/forms/[slug].tsx (updated)

Step 2: Vercel Dashboard
  ⏳ Set environment variables
  ⏳ Configure custom domain
  ⏳ Redeploy

Step 3: Verify
  ⏳ Test at https://payforms.com.ng
```

### Backend (Render)
```
Step 1: Update CORS
  ⏳ apps/backend/src/main.ts
     - Add 'https://payforms.com.ng'
     - Add /https:\/\/.*\.vercel\.app$/
  
Step 2: Redeploy
  ⏳ Push to GitHub or redeploy on Render

Step 3: Verify
  ⏳ Check logs for CORS allowed origins
```

## Key Improvements

| Before | After |
|--------|-------|
| Hardcoded `window.location.origin` | Environment-based `getCallbackUrl()` |
| Inconsistent across Vercel previews | Consistent across all environments |
| Callback URL mismatch issues | Proper domain routing |
| Manual domain configuration | .env.production handles it |
| Localhost URLs in production | Production URLs from env vars |

## Testing Progression

```
1. Local Development (npm run dev)
   - Uses .env.local
   - Callback: http://localhost:5701/...
   - ✅ Should work

2. Vercel Preview (PR/branch)
   - Uses .env.production values
   - Callback: https://payforms.com.ng/...
   - ✅ Should work after env vars set

3. Vercel Production (main branch)
   - Uses .env.production values
   - Callback: https://payforms.com.ng/...
   - Domain: Custom domain configured
   - ✅ Should work after domain DNS updated
```

## Environment Variable Resolution

When code runs `process.env.NEXT_PUBLIC_API_URL`:

**Local (npm run dev)**
```
1. Check .env.local
2. Check .env
3. Use fallback 'http://localhost:3001'
```

**Vercel Build**
```
1. Check Vercel dashboard env vars (highest priority)
2. Check .env.production in repo
3. Use fallback 'http://localhost:3001'
```

**Important**: Vercel dashboard env vars override .env files!

## Deployment Flow

```
Developer commits code
    ↓
Push to GitHub (main or PR branch)
    ↓
Vercel auto-detects → Starts build
    ↓
Vercel loads env vars from dashboard
    ↓
Next.js builds with those env vars baked in
    ↓
Build artifacts deployed to Vercel
    ↓
Frontend available at custom domain
    ↓
Traffic flows through Cloudflare/DNS to Vercel
    ↓
Vercel proxies to backend on Render
    ↓
🎉 Payment flow works!
```

## Quick Reference

| Scenario | Frontend | Backend |
|----------|----------|---------|
| **Local Dev** | `localhost:5701` | `localhost:3001` |
| **Vercel Preview** | `payforms-xxx.vercel.app` | `api.payforms.com.ng` |
| **Production** | `payforms.com.ng` | `api.payforms.com.ng` |

---

See [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) for step-by-step next actions.
