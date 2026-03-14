# Migration Manifest

Tracks required database migrations per version. When deploying, find your **current version**
and run all migrations listed **after** it.

> Django `migrate --noinput` handles this automatically during deploy. This manifest
> documents **what changed** so deployers know what to expect.

---

## v3.5.0-AG-260314 (Current)

### POS Module
```bash
python3 manage.py migrate pos 0068
```
| Migration | Description |
|---|---|
| `0067_order_destination_fields` | Delivery destination fields on orders |
| `0068_add_security_rules_to_pos_settings` | 24 new fields: authentication rules, manager overrides, register close rules, reconciliation, delivery codes, SMS triggers |

---

## v3.5.0-AG-260313

### Finance Module
```bash
python3 manage.py migrate finance 0031
```
| Migration | Description |
|---|---|
| `0031_merge_compound_tax_and_enterprise_posting` | Merge migration for compound tax and enterprise posting rules |

---

## Upgrade Shortcuts

### From v3.4.x → Current
```bash
# Run ALL pending migrations at once:
python3 manage.py migrate --noinput
```

### From v3.5.0-AG-260312 → Current
```bash
python3 manage.py migrate pos 0068
```

---

## How to Add Entries

When creating a new migration, add an entry to this file **above** the current version:

```markdown
## v3.5.0-AG-YYMMDD

### [Module Name]
| Migration | Description |
|---|---|
| `XXXX_migration_name` | Brief description |
```
