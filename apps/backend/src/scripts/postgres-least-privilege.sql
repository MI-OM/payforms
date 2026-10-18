-- =============================================================================
-- Payforms: PostgreSQL Least-Privilege Role Script
-- =============================================================================
-- PURPOSE:
--   Creates a dedicated application role (`payforms_app`) with only the
--   permissions the running application actually needs, and a separate
--   read-only developer role (`payforms_readonly`) that excludes all financial
--   tables — so developers can debug non-financial issues without being able to
--   query payment records.
--
-- HOW TO RUN:
--   1. Connect to your Supabase database as the project owner (or via the
--      Supabase SQL editor).
--   2. Replace ALL occurrences of '<strong_app_password>' and
--      '<strong_readonly_password>' with strong randomly-generated values
--      (store them in your password manager, not in source control).
--   3. Run the script in a transaction so you can roll back if anything fails.
--   4. Update the Render environment variables:
--        DB_USER=payforms_app
--        DB_PASSWORD=<strong_app_password>
--   5. Redeploy the backend and verify the application starts cleanly.
--
-- ROLLBACK:
--   REVOKE all grants listed below, then DROP ROLE payforms_app and
--   DROP ROLE payforms_readonly.
--
-- NOTE: This script assumes the schema is in the `public` schema and the
--   database is named `payforms`. Adjust accordingly.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Create roles
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payforms_app') THEN
    CREATE ROLE payforms_app LOGIN PASSWORD '<strong_app_password>';
    RAISE NOTICE 'Created role payforms_app';
  ELSE
    RAISE NOTICE 'Role payforms_app already exists — skipping creation';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payforms_readonly') THEN
    CREATE ROLE payforms_readonly LOGIN PASSWORD '<strong_readonly_password>';
    RAISE NOTICE 'Created role payforms_readonly';
  ELSE
    RAISE NOTICE 'Role payforms_readonly already exists — skipping creation';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Application role: full CRUD on all application tables
-- ---------------------------------------------------------------------------

GRANT CONNECT ON DATABASE payforms TO payforms_app;
GRANT USAGE ON SCHEMA public TO payforms_app;

-- Sequence access (required for auto-increment / uuid_generate)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO payforms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO payforms_app;

-- All current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO payforms_app;

-- Future tables created by migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO payforms_app;

-- ---------------------------------------------------------------------------
-- 3. Developer read-only role: NO access to financial tables
--    Developers can read non-financial operational data for debugging.
-- ---------------------------------------------------------------------------

GRANT CONNECT ON DATABASE payforms TO payforms_readonly;
GRANT USAGE ON SCHEMA public TO payforms_readonly;

-- Grant read access to non-financial tables only
GRANT SELECT ON
  organizations,
  users,
  contacts,
  groups,
  forms,
  form_fields,
  form_targets,
  form_groups,
  contact_groups,
  invitations,
  platform_users,
  platform_audit_logs,
  platform_settings,
  platform_feature_flags,
  platform_feature_flag_overrides,
  platform_notifications,
  platform_notification_deliveries,
  org_status_events,
  organization_entitlement_overrides,
  organization_usage_events,
  internal_notifications,
  contact_notifications
TO payforms_readonly;

-- Explicitly deny access to all financial tables
-- (These tables must not be listed above; REVOKE is a safety net)
REVOKE ALL ON
  payments,
  payment_logs,
  submissions,
  activity_logs,
  reconciliation_runs,
  reconciliation_exceptions,
  payment_recovery_events,
  payment_recovery_candidates,
  installment_plans,
  installment_plan_items,
  contact_installment_accounts,
  dunning_campaigns,
  dunning_runs,
  arrears_snapshots,
  compliance_export_jobs,
  compliance_export_artifacts,
  checkout_sessions,
  contact_imports,
  partners,
  partner_tenants,
  integration_endpoints,
  integration_deliveries
FROM payforms_readonly;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security enforcement
--    The application role must not be able to bypass RLS accidentally.
--    Ensure it is NOT a superuser and NOT the table owner.
-- ---------------------------------------------------------------------------

-- Verify that payforms_app cannot bypass RLS
DO $$
DECLARE
  is_super BOOLEAN;
BEGIN
  SELECT rolsuper INTO is_super FROM pg_roles WHERE rolname = 'payforms_app';
  IF is_super THEN
    RAISE EXCEPTION 'payforms_app must not be a superuser — RLS bypass would be permanent';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Restrict the organizations table: mask paystack_secret_key for readonly
--    This is belt-and-suspenders: the app role reads it (needed for Paystack
--    operations), but the readonly developer role must not see it.
-- ---------------------------------------------------------------------------

-- Create a view that hides the paystack_secret_key for readonly access
CREATE OR REPLACE VIEW organizations_safe AS
  SELECT
    id, name, email, email_verified,
    logo_url, subdomain, custom_domain,
    require_contact_login,
    notify_submission_confirmation,
    notify_payment_confirmation,
    notify_payment_failure,
    partial_payment_limit,
    enabled_payment_methods,
    billing_plan_tier,
    status, status_reason, status_changed_at, status_changed_by, suspended_until,
    data_retention_contact_days, data_retention_submission_days, data_retention_audit_days,
    auto_purge_retention_enabled, last_data_retention_purge_at,
    created_at,
    -- Indicate whether keys are configured without exposing the values
    (paystack_public_key IS NOT NULL)  AS has_paystack_public_key,
    (paystack_secret_key IS NOT NULL)  AS has_paystack_secret_key
  FROM organizations;

GRANT SELECT ON organizations_safe TO payforms_readonly;

-- Revoke direct organizations table access from readonly role
REVOKE SELECT ON organizations FROM payforms_readonly;

-- ---------------------------------------------------------------------------
-- 6. Instructions for production Supabase
-- ---------------------------------------------------------------------------
-- After running this script:
--
--   a) Supabase Dashboard → Settings → Database → Connection string:
--      Switch the Render backend to use the `payforms_app` connection string.
--
--   b) Do NOT grant the `payforms_app` role to any developer's Supabase
--      dashboard user. Developer Supabase access should use `payforms_readonly`
--      (or the project owner role for schema migrations only, with 2FA enforced).
--
--   c) Enforce Supabase MFA on the project owner account.
--
--   d) For the highest assurance, use Supabase's "Read replica" or connection
--      pooler with separate credentials per role, so the connection string
--      itself cannot be used to impersonate a different role.
--
-- ---------------------------------------------------------------------------

COMMIT;
