# Migration Sync & Ghost Migration Fix

## Goal
Fix ghost-applied Django migrations (0031-0040) that left the database missing critical tables and columns.

## Problem
Multiple Django migrations were recorded in `django_migrations` as "applied" but the actual SQL (table creation, column addition) never executed. This likely happened during a database restore or a careless `--fake` migration. Result: Django models referenced columns/tables that didn't exist, causing 500 errors.

## Missing Schema (Before Fix)
| Element | Type | Migration |
|---------|------|-----------|
| `systemmodule.visibility` | Column | 0035 |
| `planaddon` | Table | 0033 |
| `planaddon_plans` | Junction Table | 0033 |
| `saasclient` | Table | 0037 |
| `subscriptionplan.is_public` | Column | 0033 |
| `subscriptionplan.sort_order` | Column | 0033 |
| `subscriptionplan.trial_days` | Column | 0034 |
| `subscriptionpayment.invoice_type` | Column | 0036 |
| `organization.client_id` | Column | 0037 |
| `user.scope_pin_official` | Column | 0040 |
| `user.scope_pin_internal` | Column | 0040 |

## Fix Applied
1. Fake-unapplied ghost migrations via `manage.py migrate erp 0030 --fake`
2. Re-applied migration 0031 (already had the columns)
3. Fake-applied migration 0032 (NOT NULL constraint on user.org conflicts with existing data)
4. Created missing tables/columns directly via SQL (`fix_db.py`)
5. Fake-applied migrations 0033-0040

## Prevention
- The `LOGGING` config added to `settings.py` will now capture full tracebacks for any future 500 errors
- Never use `--fake` unless absolutely sure the SQL has been applied manually
- Always verify after restore: `manage.py showmigrations` then test critical endpoints

## Data Flow
- **`saas/modules/sidebar/`** — reads `SystemModule.objects.all()` → requires `visibility` column
- **`auth/login/`** — reads `User` model → requires `scope_pin_official`/`scope_pin_internal` columns

## Related Pages
- Login page (`saas.tsf.ci/login`) — reads from `user` table via `auth/login/` API
- Dashboard sidebar — reads from `systemmodule` table via `saas/modules/sidebar/` API
- Subscription management — reads/writes `subscriptionplan`, `planaddon`, `saasclient` tables

## Version
`v2.8.1-b002` — Database fix applied directly on server (no code change needed)
