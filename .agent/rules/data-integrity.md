---
trigger: always_on
description: Data integrity rules — single source of truth, no duplicated business data
---

# Data Integrity Rules

## 1. Single Source of Truth

Every business value MUST have ONE and ONLY ONE authoritative source:
- No duplicated business meaning across tables
- If data appears in two places, one must be the source and the other a cache/sync
- Caches must have clear refresh/invalidation logic

## 2. No Duplicate Records

Before creating any record:
- Check if an equivalent record already exists (by email, code, slug, etc.)
- Use `get_or_create()` or `update_or_create()` for idempotent operations
- Never create duplicate contacts, accounts, or entities

## 3. Referential Integrity

- All relationships must use proper ForeignKey constraints
- Cascade deletes must be intentional (use `PROTECT` or `SET_NULL` for important relations)
- Never use raw IDs without foreign key validation

## 4. Organization Scoping

- Every query MUST be scoped to the current organization
- Never allow cross-organization data leaks
- Admin/SaaS views may aggregate across orgs but must be explicitly marked
