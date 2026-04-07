# ⚡ 5-Minute Vercel + Render Setup

**Everything is ready. Just 4 quick actions:**

---

## Action 1: Verify Code is Deployed ✅

Your code changes are **already in the repo**:
```
✅ apps/frontend/.env.local
✅ apps/frontend/.env.production  
✅ apps/frontend/src/utils/config.ts
✅ apps/frontend/src/pages/public/forms/[slug].tsx (updated)
✅ apps/frontend/vercel.json
```

Push to GitHub if not done:
```bash
git add .
git commit -m "fix: environment-based callback URLs for Vercel deployment"
git push
```

**Done** ✅

---

## Action 2: Set Vercel Environment Variables (2 minutes) 

**Go to**: https://vercel.com/dashboard

1. Click your project
2. **Settings** → **Environment Variables**
3. **Add Variable** (Production environment):
   - Name: `NEXT_PUBLIC_APP_URL`
   - Value: `https://payforms.com.ng`
   - Environments: **Production** (checked)
   
4. **Add Variable** (Production environment):
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://api.payforms.com.ng`
   - Environments: **Production** (checked)

5. Save and go to **Deployments**
6. Click latest deployment → Three dots → **Redeploy**

**Done** ✅

---

## Action 3: Update Backend CORS (2 minutes)

**File**: `apps/backend/src/main.ts`

Find this section:
```typescript
const corsOptions = {
  origin: [
    'http://localhost:5701',
    // ADD THESE TWO LINES:
    'https://payforms.com.ng',
    /https:\/\/.*\.vercel\.app$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
```

Save and push:
```bash
git add apps/backend/src/main.ts
git commit -m "fix: add Vercel domain to CORS whitelist"
git push
```

Then **redeploy on Render** (trigger build).

**Done** ✅

---

## Action 4: Test Payment Flow (3 minutes)

1. Go to `https://payforms.com.ng`
2. Fill out a form that requires payment
3. Click submit
4. Should redirect to Paystack
5. After payment, callback should go to `https://payforms.com.ng/payment/success`
6. Email should be received with payment confirmation

**Done** ✅

---

## If Anything Breaks

| Error | Fix |
|-------|-----|
| Callback goes to localhost | Vercel env vars not set. Check Vercel dashboard. Redeploy. |
| CORS blocked error | Backend CORS not updated. Add domain and redeploy. |
| 404 on payment/success | Check Vercel env var `NEXT_PUBLIC_APP_URL` is correct. Hard refresh (Ctrl+Shift+R). |
| Email not sent | Check backend logs on Render for mailer errors. |

---

## Files You Modified

```
apps/frontend/
  ├── .env.local                  ← NEW
  ├── .env.production             ← NEW
  ├── .env.example                ← UPDATED
  ├── vercel.json                 ← NEW
  ├── src/utils/config.ts         ← NEW
  └── src/pages/public/forms/[slug].tsx  ← UPDATED

apps/backend/
  └── src/main.ts                 ← TO UPDATE (add CORS)
```

---

## Reference

Quick docs if you need them:
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Overview
- [VERCEL_SETUP_CHECKLIST.md](./VERCEL_SETUP_CHECKLIST.md) - Detailed steps
- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) - Visual diagrams

---

## That's It!

You're 4 actions away from production. Go! 🚀

```
Set Vercel Vars → Redeploy FE → Update CORS → Redeploy BE → 🎉
```
