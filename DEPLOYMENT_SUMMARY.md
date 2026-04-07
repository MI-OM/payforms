# Payforms: Vercel + Render Deployment Tidyup

**Status**: Code changes complete ✅ | Awaiting Vercel configuration 🚀

---

## What Was Done

### 1. **Environment Configuration** ✅
- Created `apps/frontend/.env.local` → `http://localhost:5701` 
- Created `apps/frontend/.env.production` → `https://payforms.com.ng`
- Created `apps/frontend/src/utils/config.ts` → Central config utility

### 2. **Code Updates** ✅
- Updated form submission in `[slug].tsx` to use `getCallbackUrl()` from config
- Removed hardcoded `window.location.origin` (which varies in Vercel previews)
- Added proper import for callback URL generation

### 3. **Build Config** ✅
- Created `apps/frontend/vercel.json` → Tells Vercel how to build the app

### 4. **Backend** ✅
- Audit logs: Clean business actions logged ✅
- Notifications: GET endpoint added ✅  
- Email: Implemented for payment confirmations ✅
- Tests: All passing (32/32 suites) ✅

---

## What You Need to Do NOW

### Step 1: Vercel Dashboard Setup (2 minutes)
Go to: https://vercel.com/dashboard

1. **Click your project**
2. **Settings → Environment Variables**
3. **Add these variables** with scope **Production**:
   - `NEXT_PUBLIC_APP_URL` → `https://payforms.com.ng`
   - `NEXT_PUBLIC_API_URL` → `https://api.payforms.com.ng`
   - `NODE_ENV` → `production`

4. **Redeploy**: Go to Deployments → Click latest → Three dots → Redeploy

### Step 2: Backend CORS (if not done) (2 minutes)
Update: `apps/backend/src/main.ts`

Add to `corsOptions.origin`:
```typescript
'https://payforms.com.ng',        // Your production domain
/https:\/\/.*\.vercel\.app$/,    // All Vercel preview domains
```

Then redeploy backend to Render.

### Step 3: Test Payment Flow (5 minutes)
1. Visit `https://payforms.com.ng/public/forms/[slug]`
2. Submit a form requiring payment
3. Should redirect to Paystack → Success page with email

---

## Files Summary

### Created
| File | Purpose |
|------|---------|
| `apps/frontend/.env.local` | Local development URLs (localhost) |
| `apps/frontend/.env.production` | Production URLs (Vercel + Render) |
| `apps/frontend/src/utils/config.ts` | Config utility & getCallbackUrl() |
| `apps/frontend/vercel.json` | Vercel build configuration |
| `VERCEL_SETUP_CHECKLIST.md` | Step-by-step Vercel setup |
| `FRONTEND_DEPLOYMENT_GUIDE.md` | Detailed deployment reference |
| `BACKEND_CORS_CONFIG.md` | Backend CORS setup guide |

### Updated
| File | Change |
|------|--------|
| `apps/frontend/src/pages/public/forms/[slug].tsx` | Uses `getCallbackUrl()` instead of `window.location.origin` |

---

## How It Works Now

```
Local Development:
  localhost:5701/public/forms/[slug]
    → Callback: http://localhost:5701/payment/success
    → Api: http://localhost:3001

Production (Vercel):
  payforms.com.ng/public/forms/[slug]
    → Callback: https://payforms.com.ng/payment/success
    → Api: https://api.payforms.com.ng

Preview (Vercel):
  payforms-xxx.vercel.app/public/forms/[slug]
    → Callback: https://payforms-xxx.vercel.app/payment/success
    → Api: https://api.payforms.com.ng
```

No more hardcoded `window.location.origin` confusion!

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Callback fails (404) | Did you set `NEXT_PUBLIC_APP_URL` in Vercel? Did you redeploy? |
| CORS error | Is `payforms.com.ng` in backend's `corsOptions`? Is backend redeployed? |
| Email not sent | Check backend logs on Render for email provider errors |
| Still using localhost | Hard refresh browser (Ctrl+Shift+R), check Vercel env vars took effect |

---

## Next Steps

1. ✅ Code done
2. ⏳ **You**: Set Vercel env vars (2 min)
3. ⏳ **You**: Update backend CORS (2 min)
4. ✅ Test payment flow (5 min)

**Total time to production**: ~5 minutes

---

## Reference Docs
- [VERCEL_SETUP_CHECKLIST.md](./VERCEL_SETUP_CHECKLIST.md) ← **Start here**
- [FRONTEND_DEPLOYMENT_GUIDE.md](./FRONTEND_DEPLOYMENT_GUIDE.md) → Detailed reference
- [BACKEND_CORS_CONFIG.md](./BACKEND_CORS_CONFIG.md) → Backend CORS setup
