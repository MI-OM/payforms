PAYFORM MVP – FINAL TECHNICAL DOCUMENT (UPDATED)
🧱 1. ARCHITECTURE (FINAL)
🎯 Principles
Multi-tenant (organization-based)
No fund custody (org uses Paystack)
Modular monolith
Backend-controlled payment truth
Flexible targeting system
🧩 System Architecture
Frontend (Next.js)
 ├── Admin Dashboard
 ├── Form Builder
 ├── Contacts & Groups UI
 ├── Reports & Analytics
 ├── Public Payment Page
 ├── Contact Login Portal
 ├── Payment Callback Page

Backend (NestJS)
 ├── Auth Module
 ├── Organization Module
 ├── User/Invitation Module
 ├── Contact Module
 ├── Contact Auth Module
 ├── Group Module (with subgroups)
 ├── Form Module
 ├── Form Targeting Module ✅
 ├── Submission Module
 ├── Payment Module (verify + webhook) ✅
 ├── Import Module ✅
 ├── Notification Module
 ├── Reporting Module (advanced filters) ✅
 ├── Audit Module

Database (PostgreSQL)

External:
- :contentReference[oaicite:1]{index=1}
- Email Service
- File Storage (S3/Cloudinary)
🔁 2. PAYMENT ARCHITECTURE (FINAL)
Flow
1. Submit Form
2. Initialize Payment (Paystack)
3. Redirect to Paystack
4. Paystack redirects → /payment/callback
5. Frontend calls /payments/verify
6. Backend verifies with Paystack
7. Webhook confirms (source of truth)
8. Update DB + logs + notify
Key Rules
❌ Do NOT trust redirect alone
✅ Always verify via backend
✅ Webhook = final authority
Payment Module Functions
- initializePayment()
- verifyPayment()
- handleWebhook()
- updatePaymentStatus()
- storeGatewayResponse()
🧩 3. FORM TARGETING SYSTEM (FINAL)
🎯 Goal

Allow forms to be assigned to:

Groups
Subgroups
Individual contacts
✅ Core Table
form_targets
-------------
id
form_id
target_type   -- 'group' | 'contact'
target_id
created_at
🧠 Target Resolution Logic
If group:
 → include all subgroup children recursively

If contact:
 → direct assignment

If no targets:
 → public form
🔐 Eligibility Check
If login enabled:
  Allow access only if:
    - contact is directly assigned
    OR
    - contact belongs to assigned group/subgroup
🗄️ 4. DATABASE SCHEMA (UPDATED SECTIONS ONLY)
👤 contacts (expanded)
first_name
middle_name
last_name
email
phone
gender

student_id_number

guardian_name
guardian_email
guardian_phone

password_hash
is_active
must_reset_password
👥 groups (hierarchical)
id
organization_id
name
parent_group_id   -- supports subgroups
📥 import_logs
id
organization_id
file_name
status
total_records
successful_records
failed_records
created_by
created_at
💳 payments (enhanced)
id
submission_id
organization_id

reference
amount
status
paid_at

contact_id
student_id_number

gateway_response JSON
gateway_status
channel
currency
fees
📜 activity_logs (enhanced)
ip_address
user_agent
🔌 5. API ENDPOINTS (FINAL UPDATES)
👥 STAFF INVITATION
POST /users/invite
POST /users/accept-invite
💳 TRANSACTIONS (ADVANCED)
Get All Transactions
GET /transactions
Filters:
?start_date=
&end_date=
&status=
&search=
&form_id=
&group_id=
Transaction Details
GET /transactions/:id

Includes:

Contact
Form
Payment logs
Gateway response
📥 BULK IMPORT
Validate Import
POST /contacts/import/validate
Commit Import
POST /contacts/import/commit
View Import Logs
GET /imports
📜 ACTIVITY LOGS
GET /audit/logs

Filters:

?start_date=
&end_date=
&action=
&user_id=
&search=
📄 FORM MANAGEMENT
Get Forms (with filters)
GET /forms
?search=
&category=
&status=
Bulk Delete
POST /forms/bulk-delete
🔗 FORM TARGETING
Assign Targets
POST /forms/:id/targets
Get Targets
GET /forms/:id/targets
Remove Target
DELETE /forms/:id/targets/:target_id
👤 CONTACT MANAGEMENT
Get Contacts
GET /contacts

Filters:

?group_id=
&search=
&start_date=
&end_date=
Bulk Operations
POST /contacts/bulk-delete
POST /contacts/bulk-assign-group
GET /contacts/export
Contact Transactions
GET /contacts/:id/transactions
Export Contact History
GET /contacts/:id/export
👥 GROUPS (WITH SUBGROUPS)
Create Group/Subgroup
POST /groups
Get Tree
GET /groups/tree
Delete (only if empty)
DELETE /groups/:id
🔔 PAYMENT REMINDERS
POST /notifications/reminder
📊 REPORTING & ANALYTICS
Summary
GET /reports/summary
Advanced Analytics
GET /reports/analytics
Export
GET /reports/export?format=csv|pdf
💳 PAYMENT VERIFICATION
Verify Payment
GET /payments/verify/:reference
Webhook
POST /webhooks/paystack
🧠 6. KEY SYSTEM CAPABILITIES (AFTER UPDATE)
🎓 Universities
Assign fees by level & department
Student login + tracking
Payment reminders
Full audit + reports
🏢 SMEs
Simple payment forms
Customer grouping
Payment tracking
📊 Finance Teams
Full transaction filtering
Import/export
Activity tracking
Audit logs