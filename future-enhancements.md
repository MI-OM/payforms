# Future Enhancements

This document captures additional features and module ideas for the next phase of Payforms development, especially focused on SIS integration and related backend capabilities.

## Phase 4 — SIS Connector

### Goal
Provide a first-class connector layer for student information systems (SIS) so organization contacts, identity fields, and roster data can sync into Payforms and support identity-validated public submissions.

### Suggested modules and features

1. `sis` module
   - New backend module to manage SIS connectors, configuration, and synchronization.
   - Responsible for connector registration, provider configuration, sync status, and error handling.

2. SIS connector configuration
   - Entity/table for SIS connectors:
     - `organization_id`
     - `provider` (e.g. `banner`, `blackbaud`, `powercampus`, `custom`)
     - `connection_type` (`api`, `sftp`, `csv`)
     - provider-specific credentials / metadata
     - `field_mapping` definitions
     - `sync_interval` and last sync timestamp
   - API endpoints for CRUD of connector settings.

3. Roster import and registry
   - Internal registry table or import staging table for roster imports.
   - Support `CSV upload` or `API sync` of roster files.
   - Validate and commit import data separately.
   - Track import batches, status, errors, and created/updated contact counts.

4. Contact external identity sync
   - Use contact `external_id` as the primary SIS match key.
   - Support bulk updates to contacts from roster sync:
     - add missing contacts
     - update existing emails, names, groups, active status
     - preserve existing passwords / login metadata as needed

5. SIS validation for public forms
   - Extend `identity_validation_mode: CONTACT_EXTERNAL_ID` to optionally validate against final SIS roster state.
   - Optionally allow form field aliasing to match SIS field labels.

6. Sync scheduling and status
   - Background job runner or scheduled task for periodic SIS sync.
   - Endpoint to trigger manual sync.
   - Sync audit logs and failure notifications.

7. Connector provider adapters
   - Pluggable adapter pattern for provider-specific behavior.
   - Example providers:
     - CSV / batch import
     - REST API based SIS
     - SFTP-delivered roster files
   - Adapter interface for:
     - listing contacts
     - reading roster export files
     - normalizing student IDs and group memberships

8. Import/export improvements
   - Build on existing `contacts/export` and `contacts/import` functionality.
   - Add dedicated CSV schema documentation for SIS roster templates.
   - Support export of roster-compatible CSV files.

## Additional Future Enhancements

### Public submission and identity rules

- Add configurable rule engines for `identity_validation_mode`.
- Support multiple identity fields and cross-field validation.
- Add audit logging for failed identity validation attempts.

### Reporting and analytics

- Extend reporting endpoints to include SIS sync metrics.
- Add CSV/PDF export of sync reports and contact reconciliation data.

### Contact and group management

- Allow contact grouping based on SIS roster structures.
- Support mapping SIS sections/majors to Payforms groups.
- Add user-facing UI pages for SIS connector configuration and import history.

### Notifications

- Notify administrators on sync failures or duplicate external IDs.
- Optionally email impacted contacts when roster changes require action.

## Implementation priorities

1. Add a `sis` module and connector settings entity.
2. Add roster import staging + validation commit flow.
3. Add CSV parser / upload UI workflow for SIS roster files.
4. Extend contact sync to update `external_id` and contact metadata.
5. Wire SIS connector state into public form identity rules.
6. Add sync status APIs and schedule/trigger support.

## Notes

- Existing `contact.external_id` support and CSV import/export code provide a strong foundation.
- No dedicated SIS connector code or registry table currently exists in the repo, so this should be treated as new module work.
- The current contact import/validation infrastructure can be reused for SIS roster handling.
