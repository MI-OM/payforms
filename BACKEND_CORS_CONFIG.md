# Backend CORS Configuration for Vercel + Render

## Current Issue
Backend running on Render needs to allow requests from Vercel Frontend.

## What Vercel Domains Look Like

| Type | Example |
|------|---------|
| Main Domain | `https://payforms.com.ng` |
| Preview Deployments | `https://payforms-git-feature-name-yourname.vercel.app` |
| All Vercel Domains Pattern | `*.vercel.app` |

## Backend CORS Config

**File**: `apps/backend/src/main.ts`

Update the CORS configuration to allow Vercel domains:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  const corsOptions = {
    origin: [
      'http://localhost:5701',           // Local development
      'http://localhost:3001',           // Local development (if FE/BE on same host)
      'https://payforms.com.ng',         // Production domain
      /https:\/\/.*\.vercel\.app$/,      // All Vercel preview domains (regex)
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.enableCors(corsOptions);

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);
  console.log(`Backend running on port ${PORT}`);
}

bootstrap();
```

## Testing CORS

After updating backend and redeploying:

### 1. Local Test (should work)
```bash
# Terminal 1: Start backend
cd apps/backend && npm run start

# Terminal 2: Start frontend  
cd apps/frontend && npm run dev

# Visit http://localhost:5701/public/forms/[slug]
# Form submission should work without CORS errors
```

### 2. Production Test
```bash
# Navigate to https://payforms.com.ng/public/forms/[slug]
# Open DevTools Console
# Submit form
# Check Network tab - should see successful requests to backend API
# No CORS errors should appear
```

### 3. Debug CORS Errors

If you see CORS error in browser console:
```
Access to XMLHttpRequest at 'https://api.payforms.com.ng/public/forms/...' 
from origin 'https://payforms.com.ng' has been blocked by CORS policy
```

**Solution:**
1. Check `corsOptions.origin` includes the domain
2. Backend must be redeployed after CORS changes
3. Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Environment Variables

Make sure backend on Render has:
- `NODE_ENV=production`
- `DATABASE_URL=...` (PostgreSQL connection)
- `SENDGRID_API_KEY=...` or email provider credentials
- Any other required env vars

## Verification

After CORS update, check backend logs:
```
curl -H "Origin: https://payforms.com.ng" \
     -H "Access-Control-Request-Method: GET" \
     https://api.payforms.com.ng/health
```

Should return:
```json
{ "status": "ok" }
```

Without CORS errors.

## Complete Deployment Flow

```
1. Update backend CORS in main.ts
   ↓
2. Redeploy backend to Render
   ↓
3. Set env vars in Vercel dashboard
   ↓
4. Redeploy frontend to Vercel
   ↓
5. Test payment flow: FE → Paystack → Callback → Email
```

## Related Files
- Backend: `apps/backend/src/main.ts`
- Frontend Config: `apps/frontend/src/utils/config.ts`
- API Client: `apps/frontend/src/services/api.ts`
