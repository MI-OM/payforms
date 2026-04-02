# Payforms - Multi-Tenant Payment Collection Platform

A lean, scalable SaaS platform for organizations to create custom payment forms, manage contacts, and collect payments through Paystack.

## 🎯 Features

- **Multi-tenant Architecture**: Complete tenant isolation with single database
- **Custom Forms**: Drag-and-drop form builder with flexible field types
- **Contact Management**: Bulk import, grouping, and optional login for payees
- **Payment Processing**: Integrated Paystack payment gateway (organization-owned keys)
- **Payment Tracking**: Real-time payment status with webhook verification
- **Audit Trail**: Complete activity logging and payment history
- **Email Notifications**: Payment confirmations and reminders
- **Reporting**: Dashboard summaries and CSV exports
- **Caching**: Redis-backed cache for hot read paths (with memory fallback)
- **Branding**: Custom logos and organization settings

## 🏗️ Tech Stack

- **Backend**: NestJS 11, TypeORM, PostgreSQL 16
- **Frontend**: Next.js 14, React 19, Tailwind CSS, Zustand
- **Authentication**: JWT (separate tokens for admin/contact)
- **Deployment**: Docker + Cloud (AWS/GCP/DigitalOcean)
- **Package Manager**: npm

## 📁 Project Structure

```
payforms/
├── apps/
│   ├── backend/              (NestJS API)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── organization/
│   │   │   │   ├── contact/
│   │   │   │   ├── group/
│   │   │   │   ├── form/
│   │   │   │   ├── submission/
│   │   │   │   ├── payment/
│   │   │   │   └── audit/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env
│   ├── frontend/             (Next.js Dashboard)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   └── styles/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/               (Shared Types)
│       └── types.ts
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Local Development

1. **Clone and Install**
```bash
git clone <repo>
cd payforms

# Install root dependencies
npm install

# Install backend
cd apps/backend
npm install

# Install frontend
cd ../frontend
npm install
cd ../..
```

2. **Setup Environment**
```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env
```

3. **Run with Docker Compose**
```bash
docker-compose -f docker/docker-compose.yml up
```

Services will be available at:
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs
- **Frontend**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Manual Development (without Docker)

1. **Start PostgreSQL**
```bash
# Update connection details in apps/backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payforms
DB_USER=postgres
DB_PASSWORD=postgres
```

2. **Start Backend**
```bash
cd apps/backend
# Apply pending schema changes when running with NODE_ENV=production
npm run migration:run
npm run start:dev
# API available at http://localhost:3001
```

3. **Start Frontend** (new terminal)
```bash
cd apps/frontend
npm run dev
# Dashboard available at http://localhost:3000
```

## 📚 API Endpoints

### Authentication (Admin)
- `POST /auth/register` - Register new organization + admin (`organization_name`, `email`, `password`, `title?`, `designation?`)
- `POST /auth/login` - Admin login
- `POST /auth/password-reset/request` - Request admin/staff password reset
- `POST /auth/password-reset/confirm` - Confirm admin/staff password reset
- `POST /auth/organization-email/verify` - Verify organization email with token
- `POST /auth/organization-email/request-verification` - Resend organization verification email (ADMIN)
- `GET /auth/organization-email/status` - Check organization email verification status
- `GET /auth/me` - Current user info (requires JWT)

### Frontend Auth Routes
- `/forgot-password` - Request password reset email
- `/reset-password?token=...` - Set a new password from reset email
- `/verify-organization-email?token=...` - Verify organization email from email link

### Organization
- `GET /organization` - Fetch org details
- `PATCH /organization` - Update org info
- `PATCH /organization/settings` - Update settings
- `POST /organization/logo` - Upload logo

### Contacts
- `POST /contacts` - Create contact
- `GET /contacts` - List contacts (paginated)
- `GET /contacts/export` - Export contacts as CSV
- `GET /contacts/:id` - Get contact details
- `PATCH /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact
- `POST /contacts/import` - Bulk import from CSV/JSON rows (`name`, `email`, `phone?`, `external_id?`, `group_ids?`, `groups?`, `group_paths?`, `require_login?`, `is_active?`, `must_reset_password?`)
- `GET /contacts/:id/transactions?format=csv` - Export contact transaction history as CSV

### Groups
- `POST /groups` - Create group (`name`, `description?`, `note?`)
- `GET /groups` - List groups
- `GET /groups/:id` - Get group details
- `PATCH /groups/:id` - Update group (`name?`, `description?`, `note?`)
- `DELETE /groups/:id` - Delete group
- `POST /groups/:id/contacts` - Add contacts to group
- `GET /groups/:id/contacts` - List group contacts

### Forms & Fields
- `POST /forms` - Create form (`title`, `slug`, `payment_type`, `allow_partial`, `category?`, `description?`, `note?`, `amount?`)
- `GET /forms` - List forms
- `GET /forms/:id` - Get form with fields
- `PATCH /forms/:id` - Update form (`title?`, `category?`, `description?`, `note?`, `amount?`, `allow_partial?`, `is_active?`)
- `DELETE /forms/:id` - Delete form
- `POST /forms/:id/fields` - Add field
- `PATCH /fields/:id` - Update field
- `DELETE /fields/:id` - Delete field

### Public (No Auth Required)
- `GET /public/forms/:slug` - Get public form
- `GET /public/forms/:slug/widget-config` - Get widget metadata + integration details
- `GET /public/forms/:slug/embed.js` - Load embeddable widget script
- `GET /public/forms/:slug/widget` - Iframe widget shell used by embed script
- `POST /public/forms/:slug/submit` - Submit form + create payment

## 🔌 Embedded Form Widget

You can embed any active form into any website and still use Payforms submission + Paystack payment initialization.

1. Load the widget script for a form slug.
2. The script injects an iframe widget into your page.
3. The iframe calls `POST /public/forms/:slug/submit`, then redirects to Paystack.

```html
<script
  src="https://api.yourdomain.com/public/forms/school-fees-2026/embed.js"
  data-payforms-widget
  data-callback-url="https://yourdomain.com/payment/callback"
  data-width="100%"
  data-height="680"
></script>
```

Optional script attributes:
- `data-api-base` override API base URL
- `data-contact-token` pass contact JWT for targeted forms
- `data-contact-email` prefill receipt email
- `data-contact-name` prefill contact name
- `data-auto-redirect="false"` to stop automatic top-window redirect and handle payment URL yourself
- `data-container="#widget-root"` render into an existing element

Widget browser events are emitted on `window` as `payforms-widget-event` with:
- `ready`
- `submitted`
- `payment_initialized`
- `error`
- `resize`

### Payments
- `GET /payments` - List payments (`format=csv` for export)
- `GET /payments/:id` - Get payment details
- `POST /webhooks/paystack` - Paystack webhook handler

### Transactions
- `GET /transactions` - List filtered transactions (`format=csv` for export)
- `GET /transactions/:id` - Transaction details
- `GET /transactions/:id/history` - Transaction event history

## 🔐 Security

- **JWT Authentication**: Access tokens with 7-day expiry
- **Multi-tenant Isolation**: All queries filtered by `organization_id`
- **Encrypted Keys**: Paystack keys encrypted at rest
- **Webhook Verification**: Paystack signatures validated
- **CORS Enabled**: Configurable for frontend

## ⚡ Scalability Notes

- Current backend supports multi-tenant filtering and can handle 100k+ contacts/students when run with proper DB sizing, indexes, and pool tuning.
- For 1k concurrent requests, run multiple backend instances behind a load balancer; a single Node.js process is not a resilient capacity target.
- Redis caching is implemented for public form hot paths (`/public/forms/:slug*`) and can be enabled with `CACHE_REDIS_ENABLED=true`.
- Apply migrations in production before traffic:
  - `cd apps/backend && npm run migration:run`
- Validate with load tests on production-like infrastructure before go-live (track p95 latency, DB CPU, connection saturation, and 5xx rates).

## 📦 Environment Variables

### Backend (.env)
Copy the backend sample file at `apps/backend/.env.example` and update values for your environment.

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=payforms
DB_POOL_MAX=50
DB_POOL_MIN=5
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=7d

# Paystack
PAYSTACK_CALLBACK_URL=http://localhost:3001/public/payments/callback
PAYSTACK_PUBLIC_KEY=pk_test_your_key
PAYSTACK_SECRET_KEY=sk_test_your_key
PAYSTACK_SANDBOX_MODE=true

# Email Provider (sendgrid | mailgun | brevo)
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@payforms.app
EMAIL_FROM_NAME=Payforms

# SendGrid
SENDGRID_API_KEY=sg_your_key
SENDGRID_FROM_EMAIL=noreply@payforms.app

# Mailgun
MAILGUN_API_KEY=key-your-mailgun-key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_BASE_URL=https://api.mailgun.net/v3
MAILGUN_FROM=noreply@payforms.app

# Brevo
BREVO_API_KEY=xkeysib-your-brevo-key
BREVO_FROM=noreply@payforms.app
BREVO_API_BASE_URL=https://api.brevo.com/v3

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Public API URL (recommended when running behind reverse proxies)
PUBLIC_API_BASE_URL=http://localhost:3001

# Cache
CACHE_DEFAULT_TTL_SECONDS=120
CACHE_REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
REDIS_TLS=false
REDIS_CONNECT_TIMEOUT_MS=10000

# Optional File Storage (S3)
AWS_S3_BUCKET=payforms-bucket
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### Frontend (.env)
Copy the frontend sample file at `apps/frontend/.env.example` and update values for your environment.

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001
```

## 🧪 Testing

### Backend Tests
```bash
cd apps/backend
npm run test
```

### API Testing with cURL
```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "My School",
    "email": "admin@school.com",
    "password": "SecurePass123"
  }'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.com",
    "password": "SecurePass123"
  }'

# Get organization (with token)
curl -X GET http://localhost:3001/organization \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚢 Deployment

### Docker Build & Deploy
```bash
# Build images
docker build -f docker/Dockerfile.backend -t payforms-backend .
docker build -f docker/Dockerfile.frontend -t payforms-frontend .

# Push to registry (ECR, DockerHub, etc)
docker tag payforms-backend:latest your-registry/payforms-backend:latest
docker push your-registry/payforms-backend:latest
```

### Cloud Deployment Options

**Option 1: DigitalOcean App Platform**
```bash
# Deploy docker-compose.yml
digitalocean apps create --spec docker-compose.yml
```

**Option 2: AWS ECS**
```bash
# Push to ECR and deploy with ECS
aws ecr create-repository --repository-name payforms-backend
docker push YOUR_ECR_URI/payforms-backend
```

**Option 3: Cloud Run (GCP)**
```bash
gcloud run deploy payforms-backend \
  --image gcr.io/your-project/payforms-backend \
  --platform managed
```

## 📊 Database Schema

All tables include `organization_id` for multi-tenant isolation:

- **organizations**: Org settings, Paystack keys, branding
- **users**: Admin/staff users (password-protected)
- **contacts**: Students/customers with optional login
- **groups**: Contact grouping (e.g., Year 1, Regular Members)
- **forms**: Custom payment forms
- **form_fields**: Form fields (text, email, select, number)
- **form_groups**: Form → Groups targeting
- **submissions**: Form submissions with JSON data
- **payments**: Payment records with Paystack references
- **activity_logs**: Audit trail of all changes
- **payment_logs**: Webhook event history

## 🔄 Data Flow

```
Admin Creates Form
    ↓
Form Assigned to Groups
    ↓
Contact Submits Form (Public Page)
    ↓
Submission + Payment Created (PENDING)
    ↓
User Redirected to Paystack
    ↓
Paystack Processes Payment
    ↓
Webhook Called (Payment Updated)
    ↓
Email Notification Sent
    ↓
admin Dashboard Updated
```

## 📞 Support

For issues, feature requests, or contributions, please open a GitHub issue.

## 📄 License

MIT

## 🎓 Next Steps

1. Test auth endpoints (register/login)
2. Create sample organization + contacts
3. Build form and test submissions
4. Configure Paystack webhooks
5. Deploy to cloud

---

**Built with ❤️ for organizations that need simple payment collection**
