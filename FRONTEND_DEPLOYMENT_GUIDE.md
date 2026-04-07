# Frontend Deployment Configuration Guide

## Architecture
- **Frontend**: Vercel (payforms.com.ng or Vercel preview domain)
- **Backend API**: Render (needs CORS configured)
- **Payment Gateway**: Paystack

## Environment Setup

### 1. Local Development (localhost)

Files already created:
- `apps/frontend/.env.local` - For `npm run dev`

Default values:
```
NEXT_PUBLIC_APP_URL=http://localhost:5701
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**To use locally:**
```bash
cd apps/frontend
npm run dev
# Access at http://localhost:5701
```

### 2. Vercel Production Deployment

#### Step 1: Create Vercel Project
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Select `apps/frontend` as the root directory

#### Step 2: Set Environment Variables in Vercel Dashboard

In Project Settings → Environment Variables, add:

**For Production Environment** (payforms.com.ng):
```
NEXT_PUBLIC_APP_URL = https://payforms.com.ng
NEXT_PUBLIC_API_URL = https://api.payforms.com.ng
NODE_ENV = production
```

**For Preview/Staging** (optional, for preview branches):
```
NEXT_PUBLIC_APP_URL = https://yourdomain-staging.vercel.app
NEXT_PUBLIC_API_URL = https://api.payforms.com.ng
NODE_ENV = preview
```

**For Development** (local, use .env.local):
```
NEXT_PUBLIC_APP_URL = http://localhost:5701
NEXT_PUBLIC_API_URL = http://localhost:3001
```

#### Step 3: Configure Custom Domain
1. In Vercel dashboard → Project → Settings → Domains
2. Add custom domain: `payforms.com.ng`
3. Follow DNS instructions to point domain to Vercel
4. Wait for SSL certificate (automatic)

#### Step 4: Build Settings
- Framework: Next.js (auto-detected)
- Build Command: `npm run build`
- Output Directory: `.next`
- Root Directory: `apps/frontend`

### 3. Backend Configuration on Render

#### CORS Settings

The backend needs to allow Vercel domain:

**File**: `apps/backend/src/main.ts`

Update CORS whitelist:
```typescript
const corsOptions = {
  origin: [
    'http://localhost:5701',  // Local dev
    'https://payforms.com.ng', // Production
    /https:\/\/.*\.vercel\.app$/, // All Vercel preview domains
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
```

### 4. Verified Setup Checklist

- [ ] `apps/frontend/.env.local` exists with localhost URLs
- [ ] `apps/frontend/.env.production` exists with production URLs
- [ ] `apps/frontend/src/utils/config.ts` created with `getCallbackUrl()`
- [ ] `apps/frontend/src/pages/public/forms/[slug].tsx` updated to import and use `getCallbackUrl()`
- [ ] Vercel project created and linked to GitHub
- [ ] Environment variables set in Vercel dashboard
- [ ] Custom domain (payforms.com.ng) configured in Vercel
- [ ] Backend CORS configured for `payforms.com.ng` and Vercel previews
- [ ] Payment callback flow verified in production

### 5. Deployment Flow

```
Local Dev (localhost:5701)
  ↓
Push to GitHub
  ↓
Vercel auto-deploys
  ↓
Uses NEXT_PUBLIC_* env vars from dashboard
  ↓
Form submission → Paystack redirect → https://payforms.com.ng/paystack/callback
  ↓
Payment verified → Email sent → /payment/success
```

### 6. Testing Payment Flow

1. **Local Test**:
```bash
cd apps/frontend && npm run dev
# Visit http://localhost:5701/public/forms/[slug]
# Submit form → Should redirect to Paystack → Callback to localhost:5701/paystack/callback
```

2. **Production Test**:
   - Visit https://payforms.com.ng (after domain config)
   - Submit form → Should redirect to Paystack → Callback to payforms.com.ng/paystack/callback
   - Email should be sent to contact

### 7. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Callback 404 | Wrong domain in callback URL | Verify `NEXT_PUBLIC_APP_URL` in Vercel env vars |
| CORS error | Backend doesn't allow Vercel domain | Update `corsOptions` in backend `main.ts` |
| Email not sent | Backend can't reach Render API | Check `NEXT_PUBLIC_API_URL` points to correct Render domain |
| Preview stuck | Using localhost URL in production | Ensure `.env.production` values are set in Vercel |

### 8. Environment Variable Priority

Next.js loads variables in this order:
1. `.env.production` (Vercel automatically uses this for production builds)
2. `.env.local` (Local development, NOT deployed to Vercel)
3. `.env` (Fallback)
4. Vercel dashboard env vars (override all above)

**Important**: Vercel dashboard env vars take precedence - set them there for production!

## Quick Reference: API URLs

| Environment | App URL | API URL |
|-------------|---------|---------|
| Local Dev | `http://localhost:5701` | `http://localhost:3001` |
| Vercel Preview | `https://payforms-*.vercel.app` | `https://api.payforms.com.ng` |
| Production | `https://payforms.com.ng` | `https://api.payforms.com.ng` |

## Debugging

Check which env vars are loaded:
1. In `apps/frontend/src/utils/config.ts`, see `appConfig` object
2. In browser DevTools Console, test:
   ```javascript
   fetch(`${process.env.NEXT_PUBLIC_APP_URL}/payment/success`).then(r => r.text())
   ```
3. Check Vercel build logs at https://vercel.com/dashboard to see which env vars were used during build
