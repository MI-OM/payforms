# Payforms — Client Security Brief

**Prepared for:** Prospective School Client  
**Date:** October 2026  
**Topic:** How Payforms protects your school's financial information  

---

## How Payforms handles school payments

Payforms is a payment collection and tracking platform. When your school uses Payforms, you connect your own Paystack account. Payments from students and parents go directly into your school's Paystack account — not into an account controlled by Payforms.

Payforms records the payment event (the reference number, the amount, the date, and the outcome) so your school can track its financial activity, reconcile records, and generate reports.

---

## Can the developer see your school's revenue?

This is the question we take most seriously, and we want to give you an honest answer.

**The short answer:** The developer cannot access your financial data through normal use of the Payforms application. However, due to how the platform is currently structured, certain infrastructure-level access paths exist that are mitigated by audit controls but not cryptographically prevented.

Here is a clear breakdown of what the developer can and cannot do.

---

## What the developer cannot do through the application

- **Cannot log in as your school's user** without starting an explicitly audited impersonation session that is logged with the developer's identity, IP address, and timestamp.
- **Cannot view one school's data from another school's account.** Every database record is tagged with your school's identifier, and database-level Row Level Security policies prevent any query from returning another school's records.
- **Cannot access your financial dashboard using a regular Payforms account.** Tenant authentication (your school's login system) is completely separate from the platform administration system.
- **Cannot redirect your payments.** Your Paystack credentials are configured by your school, and money settles directly into your school's Paystack account.

---

## What the developer can technically access

We want to be transparent about the current state of the platform:

**1. Database access.** The Payforms backend connects to a hosted database. A developer with access to the server configuration can retrieve the database password and connect directly using a database client. Once connected, they can query financial records for any school. The database has Row Level Security policies, but those policies apply to the application — they do not restrict a direct database administrator connection.

**2. Supabase project owner access.** The database is hosted on Supabase, which provides an SQL Editor in its administrative dashboard. The person who manages the Supabase project can run SQL queries directly, bypassing the application's access controls.

**3. Support impersonation.** The platform includes a support feature that allows a platform admin to temporarily assume the identity of a school user (for debugging or support purposes). This feature requires a mandatory reason to be recorded and creates a permanent audit log entry with the developer's identity, the target school, and the time. The school's feature flag can disable impersonation entirely.

**4. School Paystack credentials.** Your school's Paystack secret key is stored in the database. If the database is accessed directly, those credentials could be read.

**What this means:** We can honestly say that the Payforms application enforces strong school-to-school isolation — your data is protected from other schools' users. We cannot make the absolute claim that the developer can never access your financial data, because the developer controls the infrastructure and the database.

---

## How your school is isolated from other schools

Payforms hosts all schools in a shared database, but each school's data is strictly separated:

- Every financial record (payment, transaction, report) is tagged with your school's unique identifier.
- The database enforces Row Level Security: a query running under another school's session cannot return your records, even if a programming error in the application tried to access them.
- This protection applies to payments, transactions, contacts, forms, submissions, reconciliation records, and installment plans.

**This means no other school can access your financial data through the Payforms application, even if they actively try.**

---

## What controls currently protect your data

| Control | Status |
|---------|--------|
| Payments settle into your own Paystack account | ✅ Confirmed |
| School-to-school data isolation (application layer) | ✅ Verified |
| School-to-school data isolation (database layer / Row Level Security) | ✅ Verified |
| Webhook signatures verified with HMAC-SHA512 | ✅ Verified (timing-safe implementation) |
| Payment amounts verified server-side before marking settled | ✅ Verified |
| Your Paystack secret key never sent to the browser | ✅ Confirmed |
| Authenticated-only access to financial reports and transactions | ✅ Confirmed |
| Two-factor authentication available | ✅ Confirmed |
| Audit log for all administrative actions | ✅ Confirmed |
| Impersonation sessions audited and attributable | ✅ Confirmed |
| Impersonation can be disabled per school | ✅ Available |

---

## What we are working to improve

We have identified and are working on the following improvements:

1. **Encrypting your Paystack credentials** in the database so they cannot be read even if someone accesses the database directly. This requires a careful migration and is planned for a near-future release.

2. **Restricting database access** so the application role can only access the data it needs, and developer direct-access to financial tables requires a separate audited process.

3. **School notification on support access** so your school receives an email any time a support session is started for your organization.

---

## What we cannot claim

We will not overstate our security posture. Specifically:

- We **cannot claim** that the developer is cryptographically prevented from accessing your financial data in the current architecture, because application-level field encryption has not yet been implemented for financial amounts.
- We **cannot claim** that our controls are independently certified — this assessment is an internal security audit.
- We **cannot claim** zero risk. Every software platform has residual risk; we aim to minimize it and be transparent about what remains.

---

## What would be needed for stronger guarantees

If your school requires a **cryptographic guarantee** that even the platform operator cannot read your financial data (Requirement E in strict security terms), the following architectural changes would be required:

1. **Customer-managed encryption keys:** Your school would hold an encryption key that the Payforms servers never see. All financial amounts would be encrypted with your key before storage.

2. **Limitation:** Encrypted financial data cannot be aggregated, summed, sorted, or searched on the server. All reports and calculations would need to happen in your browser — meaning server-side financial analytics and automatic reconciliation would no longer be possible.

3. **Alternatively:** A separate, school-controlled database instance, meaning your school's data never shares infrastructure with other schools.

These approaches are architecturally complex and expensive. Whether they are necessary depends on your school's specific regulatory environment, the sensitivity of the revenue figures involved, and your risk tolerance.

---

## Our commitment

We take your concern seriously. The question of whether a developer can see your revenue is a fair and important question. We have reviewed the codebase thoroughly, confirmed what controls exist and what access paths remain, and we are committed to closing the gaps identified above.

We welcome the opportunity to discuss any of these findings with you directly.
