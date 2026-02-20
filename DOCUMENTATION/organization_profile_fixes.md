# Organization Profile Fixes Documentation

## Overview
Fixes for issues #4–#8 from the platform audit — modules counting wrong, sites warning, and no subscription plan assigned for organizations.

## Changes Made

### 1. `erp/management/commands/seed_core.py`

**Goal**: Ensure SaaS org has correct plan and modules.

| Change | Detail |
|--------|--------|
| Super Ultimate Plan | Private (`is_public=False`) plan with unlimited limits (`max_*: -1`). `$0/mo`, assigned only to SaaS org |
| Module codes synced | After `ModuleManager.sync()`, all `SystemModule.name` values are injected into `super_plan.modules` |
| SaaS plan assignment | `saas_org.current_plan = super_plan` |
| SaaS module grant | All `SystemModule` → `OrganizationModule(is_enabled=True)` for SaaS org |

**Tables affected**: `subscriptionplan`, `organization`, `organizationmodule`

### 2. `erp/services.py` — `ProvisioningService.provision_organization()`

**Goal**: New orgs auto-get the Starter plan.

| Change | Detail |
|--------|--------|
| Auto-assign Starter | After granting modules, searches for `SubscriptionPlan(name='Starter', is_active=True)` and assigns as `org.current_plan` |

**Tables affected**: `organization`

## How This Fixes Each Issue

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| #4 "No modules enabled" | SaaS org had no `OrganizationModule` records | `seed_core` grants all modules to SaaS org |
| #5 "No sites configured" | Site was created but `original_objects` returned 0 for some orgs | Fixed by ensuring seed creates site + provisioning creates site |
| #6 "No subscription plan" | `org.current_plan` was NULL | `seed_core` assigns Super Ultimate to SaaS; provisioning assigns Starter to new orgs |
| #7 "3 of 10 active" | Only core-flagged modules counted as INSTALLED | With `OrganizationModule` records, all modules show INSTALLED |
| #8 Wrong modules tab | Backend `modules()` uses `enabled_map` from `OrganizationModule` | Now populated correctly |

## Data Flow

1. **Seed run** → Creates plan → Syncs modules → Assigns plan to SaaS → Grants modules to SaaS
2. **Registration** → `ProvisioningService` → Creates org + site + warehouse → Grants modules → Assigns Starter plan
3. **Frontend** → `getOrgUsage()` → Backend reads real plan limits → No more false warnings
4. **Frontend** → `getOrgModules()` → Backend reads `OrganizationModule` records → Correct count
