# Quick Setup: Fix Payment Redirects on Vercel

## Problem
FE on Vercel + Backend on Render causes callback URL mismatches. Hardcoded `window.location.origin` points to inconsistent domains across preview/production builds.

## Solution
Use environment variables to configure URLs based on deployment environment.

---

## ✅ What's Been Done

**Backend ready:**
- ✅ Audit logs fixed (business actions logged)
- ✅ GET /notifications/scheduled endpoint added
- ✅ Email notifications implemented (triggered on payment success)
- ✅ Tests passing (32/32 suites)

**Frontend fixes applied:**
- ✅ `apps/frontend/.env.local` - Local dev config
- ✅ `apps/frontend/.env.production` - Production config  
- ✅ `apps/frontend/src/utils/config.ts` - Config utility
- ✅ `apps/frontend/src/pages/public/forms/[slug].tsx` - Uses env-based callback URL
- ✅ `apps/frontend/vercel.json` - Vercel build config

---

## 🚀 What You Need to Do in Vercel Dashboard

### 1. Open Your Vercel Project
Go to: https://vercel.com/dashboard

### 2. Navigate to Project Settings
- Click your project name
- Go to **Settings** → **Environment Variables**

### 3. Add These Variables (Production)

For your **Production** environment (payforms.com.ng):

| Key | Value | Environment |
|-----|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `https://payforms.com.ng` | Production |
| `NEXT_PUBLIC_API_URL` | `https://api.payforms.com.ng` | Production |
| `NODE_ENV` | `production` | Production |

For **Preview** deployments (optional, for development branches):

| Key | Value | Environment |
|-----|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `https://payforms-staging.vercel.app` | Preview |
| `NEXT_PUBLIC_API_URL` | `https://api.payforms.com.ng` | Preview |

### 4. Re-deploy
- Go to **Deployments** tab
- Click the latest deployment's three-dot menu
- Select **Redeploy** (or push a new commit to trigger auto-deploy)

---

## 🌐 Domain Setup (if not done)

### 1. Add Custom Domain to Vercel
1. In Project → **Settings** → **Domains**
2. Click "Add Domain"
3. Enter `payforms.com.ng`
4. Update your domain registrar's DNS to point to Vercel:
   - CNAME: `cname.vercel-dns.com`
   - (or follow Vercel's specific DNS instructions)
5. Wait 5-10 minutes for SSL (automatic)

### 2. Update Backend CORS (Render)

Contact the backend operations team or update yourself:

**File**: `apps/backend/src/main.ts`

Add to `corsOptions`:
```typescript
origin: [
  'http://localhost:5701',      // Local dev
  'https://payforms.com.ng',    // Your production domain
  /https:\/\/.*\.vercel\.app$/, // All Vercel preview domains
]
```

Then redeploy backend to Render.

---

## 🧪 Test After Deployment

### Local (should still work as-is)
```bash
cd apps/frontend && npm run dev
# Visit http://localhost:5701/public/forms/[slug]
```

### Production
1. Go to `https://payforms.com.ng`
2. Submit a form with payment
3. Should redirect to Paystack → Success page at `https://payforms.com.ng/payment/success`
4. Check email for payment confirmation

### Debug Vercel Build
- Go to Vercel dashboard **Deployments** → Click latest build → **Logs**
- Should see environment variables loaded

---

## 🔗 Files Modified

| File | Change |
|------|--------|
| `apps/frontend/.env.local` | **NEW** - Local development URLs |
| `apps/frontend/.env.production` | **NEW** - Production URLs |
| `apps/frontend/src/utils/config.ts` | **NEW** - Config utility with `getCallbackUrl()` |
| `apps/frontend/src/pages/public/forms/[slug].tsx` | **UPDATED** - Uses `getCallbackUrl()` instead of `window.location.origin` |
| `apps/frontend/vercel.json` | **NEW** - Vercel build config |

---

## 📋 Verification Checklist

Before testing production:

- [ ] Vercel environment variables set (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_URL)
- [ ] Vercel project redeployed after setting env vars
- [ ] Custom domain (payforms.com.ng) configured and SSL active
- [ ] Backend CORS allows `payforms.com.ng`
- [ ] Backend redeployed with CORS changes
- [ ] Local dev still works with `npm run dev`

---

## 🆘 If Payment Still Fails

1. **Check the callback URL being sent**
   - Open DevTools Network tab
   - Submit form → POST /public/forms/[slug]/submit
   - Check `callback_url` query param in request
   - Should be `https://payforms.com.ng/payment/success` (not localhost)

2. **Check Vercel env vars**
   - Deployments → Click build → see logs
   - Should show env vars being loaded
   - If missing, env vars weren't set in Vercel dashboard

3. **Check CORS**
   - Submit form on payforms.com.ng
   - Open DevTools Console
   - If CORS error, backend doesn't allow the domain
   - Update `corsOptions` in backend and redeploy

---

## 📚 Reference Docs
- [FRONTEND_DEPLOYMENT_GUIDE.md](./FRONTEND_DEPLOYMENT_GUIDE.md) - Detailed setup
- [README.md](./README.md) - Project overview
- Vercel Docs: https://vercel.com/docs/environment-variables
