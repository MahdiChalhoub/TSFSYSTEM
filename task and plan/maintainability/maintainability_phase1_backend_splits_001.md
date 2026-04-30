# Maintainability Phase 1 — Split Giant Backend Files

**Status**: OPEN  
**Priority**: HIGH  
**Created**: 2026-04-30  
**Estimated effort**: ~2 hours  
**Risk**: LOW (internal refactor, zero URL/API/frontend changes)

---

## MANDATORY — Read First

Before starting, the executing agent MUST read:
1. `.agent/BOOTSTRAP.md`
2. `.ai/ANTIGRAVITY_CONSTRAINTS.md`
3. `architecture.md` rule (code-quality: ≤300 lines per file)
4. `cleanup.md` rule (archive-don't-delete — but this task is SPLITTING, not deleting)

---

## Goal

Split 3 backend monolith files (total ~6,750 lines) into focused modules, each ≤300 lines. **Zero URL changes, zero API contract changes, zero frontend changes.**

---

## File 1: `closing_service.py` (2,903 lines → 5 files)

**Path**: `erp_backend/apps/finance/services/closing_service.py`

### Current Structure (function map)

```
class _DryRunComplete(Exception)                          # L26
class ClosingService:                                     # L34
  ├── close_fiscal_period()                               # L38-112
  ├── soft_lock_period()                                  # L114-119
  ├── hard_lock_period()                                  # L122-127
  ├── reopen_period()                                     # L130-157
  ├── soft_close_fiscal_year()                            # L160-203
  ├── close_fiscal_year()                [facade]         # L206-239
  ├── _close_fiscal_year_impl()          [core]           # L242-928
  ├── _assert_close_integrity()                           # L929-1330
  ├── _assert_period_integrity()                          # L1331-1388
  ├── _capture_period_snapshot()                          # L1389-1485
  ├── _capture_close_snapshot()                           # L1486-1620
  ├── generate_opening_balances()                         # L1621-1774
  ├── _create_opening_journal_entry()                     # L1775-1892
  ├── validate_opening_ob_vs_je()                         # L1893-2005
  ├── rebuild_ob_from_je()                                # L2006-2106
  ├── check_parent_purity()                               # L2107-2186
  ├── validate_balance_integrity()                        # L2187-2295
  ├── check_tax_coverage()                                # L2296-2355
  ├── verify_snapshot_chain()                             # L2356-2434
  ├── check_fx_integrity()                                # L2435-2546
  ├── check_subledger_integrity()                         # L2547-2689
  ├── is_safe_to_flip_flag()                              # L2690-2775
  └── backfill_opening_journal_entries()                  # L2776-2903
```

### Split Plan

#### [MODIFY] `closing_service.py` → **Facade + Period Operations** (~250 lines)
Keep:
- `_DryRunComplete` exception class
- `close_fiscal_period()` (L38-112)
- `soft_lock_period()` (L114-119)
- `hard_lock_period()` (L122-127)
- `reopen_period()` (L130-157)
- `soft_close_fiscal_year()` (L160-203)
- `close_fiscal_year()` facade (L206-239) — delegates to `_close_fiscal_year_impl` via import
- Import delegations to new files

#### [NEW] `closing_year_impl.py` (~300 lines)
Move:
- `_close_fiscal_year_impl()` (L242-928) — the core year-end close sequence
  - This is the longest single method. If it still exceeds 300 lines after extraction, split further into a `_partial_close_handler` helper.

#### [NEW] `closing_integrity_checks.py` (~300 lines)
Move:
- `_assert_close_integrity()` (L929-1330)
- `_assert_period_integrity()` (L1331-1388)

#### [NEW] `closing_snapshot_service.py` (~300 lines)
Move:
- `_capture_period_snapshot()` (L1389-1485)
- `_capture_close_snapshot()` (L1486-1620)
- `verify_snapshot_chain()` (L2356-2434)

#### [NEW] `closing_opening_balance_service.py` (~300 lines)
Move:
- `generate_opening_balances()` (L1621-1774)
- `_create_opening_journal_entry()` (L1775-1892)
- `validate_opening_ob_vs_je()` (L1893-2005)
- `rebuild_ob_from_je()` (L2006-2106)
- `backfill_opening_journal_entries()` (L2776-2903)

#### [NEW] `closing_audit_checks.py` (~300 lines)
Move:
- `check_parent_purity()` (L2107-2186)
- `validate_balance_integrity()` (L2187-2295)
- `check_tax_coverage()` (L2296-2355)
- `check_fx_integrity()` (L2435-2546)
- `check_subledger_integrity()` (L2547-2689)
- `is_safe_to_flip_flag()` (L2690-2775)

### Import Pattern for `closing_service.py` (after refactor)
```python
# closing_service.py — Facade + Period Operations
from apps.finance.services.closing_year_impl import _close_fiscal_year_impl
from apps.finance.services.closing_integrity_checks import (
    _assert_close_integrity, _assert_period_integrity
)
from apps.finance.services.closing_snapshot_service import (
    _capture_period_snapshot, _capture_close_snapshot, verify_snapshot_chain
)
from apps.finance.services.closing_opening_balance_service import (
    generate_opening_balances, _create_opening_journal_entry,
    validate_opening_ob_vs_je, rebuild_ob_from_je,
    backfill_opening_journal_entries
)
from apps.finance.services.closing_audit_checks import (
    check_parent_purity, validate_balance_integrity,
    check_tax_coverage, check_fx_integrity,
    check_subledger_integrity, is_safe_to_flip_flag
)

class ClosingService:
    # Attach imported functions as static methods
    _close_fiscal_year_impl = staticmethod(_close_fiscal_year_impl)
    _assert_close_integrity = staticmethod(_assert_close_integrity)
    # ... etc
```

> [!IMPORTANT]
> All new files should have standalone functions (not methods). The `ClosingService` class in the facade re-attaches them as `staticmethod`. This way callers like `ClosingService.close_fiscal_year()` continue to work without any change.

---

## File 2: `account_views.py` (2,002 lines → 4 files)

**Path**: `erp_backend/apps/finance/views/account_views.py`

### Current Structure

```
class FinancialAccountViewSet          # L48-288   (~240 lines) ✓ KEEP
class FinancialAccountCategoryViewSet  # L290-313  (~24 lines)  → stays
class ChartOfAccountViewSet            # L315-2002 (~1687 lines) ← SPLIT THIS
  ├── tree()                            # L320
  ├── create_node()                     # L335
  ├── templates()                       # L375
  ├── bulk_classify()                   # L382
  ├── db_templates()                    # L454
  ├── db_template_detail()              # L482
  ├── db_template_posting_rules()       # L518
  ├── db_template_create()              # L547
  ├── db_template_update()              # L600
  ├── db_template_delete()              # L637
  ├── migration_map()                   # L655
  ├── migration_map_rematch()           # L718
  ├── migration_maps_list()             # L897
  ├── migration_map_save()              # L915
  ├── migration_map_quality()           # L1679
  ├── migration_map_set_status()        # L1794
  ├── coa()                             # L979
  ├── coa_status()                      # L1035
  ├── migration_preview()               # L1115
  ├── apply_template()                  # L1318
  ├── migrate()                         # L1524
  ├── finalize_setup()                  # L1558
  ├── statement()                       # L1575
  ├── trial_balance()                   # L1616
  ├── migration_session_*()             # L1827-1984
  └── _smart_default_for()              # L12 (helper)
```

### Split Plan

#### [MODIFY] `account_views.py` → Keep Core ViewSets (~300 lines)
Keep:
- `_smart_default_for()` helper
- `FinancialAccountViewSet` (L48-288)
- `FinancialAccountCategoryViewSet` (L290-313)
- `ChartOfAccountViewSet` class definition with only: `tree()`, `create_node()`, `statement()`, `trial_balance()`

#### [NEW] `coa_template_views.py` (~300 lines)
Move from `ChartOfAccountViewSet`:
- `templates()`, `bulk_classify()`
- `db_templates()`, `db_template_detail()`, `db_template_posting_rules()`
- `db_template_create()`, `db_template_update()`, `db_template_delete()`
- `coa()`, `coa_status()`
- `apply_template()`

**Pattern**: Create a `COATemplateViewSet` that inherits from `ChartOfAccountViewSet` or use a mixin. Register it at the same `r'coa'` prefix with a custom basename, or better: make these `@action` methods live in a mixin class that `ChartOfAccountViewSet` inherits.

> [!WARNING]
> These are `@action` methods on the `coa` ViewSet (e.g. `/api/finance/coa/db-templates/`). The safest pattern is a **mixin class**:
> ```python
> # coa_template_views.py
> class COATemplateMixin:
>     @action(detail=False, methods=['get'])
>     def db_templates(self, request): ...
>
> # account_views.py
> from .coa_template_views import COATemplateMixin
> class ChartOfAccountViewSet(COATemplateMixin, UDLEViewSetMixin, TenantModelViewSet): ...
> ```

#### [NEW] `coa_migration_views.py` (~300 lines)
Move from `ChartOfAccountViewSet`:
- `migration_map()`, `migration_map_rematch()`, `migration_maps_list()`
- `migration_map_save()`, `migration_map_quality()`, `migration_map_set_status()`
- `migration_preview()`, `migrate()`, `finalize_setup()`
- `migration_session_create()`, `migration_session_dry_run()`
- `migration_session_detail()`, `migration_session_approve()`
- `migration_session_execute()`, `migration_session_blockers()`

**Same mixin pattern** as above.

#### [NEW] `account_transfer_views.py` (if any transfer/merge actions exist — check first)

---

## File 3: `fiscal_views.py` (1,849 lines → 3 files)

**Path**: `erp_backend/apps/finance/views/fiscal_views.py`

### Current Structure

```
class FiscalActionPermission          # L13-30   (~18 lines)
class FiscalYearViewSet               # L33-1731 (~1698 lines) ← SPLIT THIS
  ├── perform_destroy()                # L56
  ├── create()                         # L78
  ├── fill_missing_periods()           # L97
  ├── close() / finalize()             # L119-180
  ├── close_preview()                  # L205-350
  ├── lock()                           # L352
  ├── summary()                        # L364-658
  ├── year_history()                   # L684-750
  ├── prior_period_adjustment()        # L776-836
  ├── list_prior_period_adjustments()  # L838-880
  ├── snapshot_chain()                 # L882-976
  ├── multi_year_comparison()          # L978-1204
  ├── yoy_comparison()                 # L1206-1428
  ├── close_checklist*()               # L1430-1644
  ├── integrity_canary()               # L1646
  ├── current()                        # L1673
  ├── draft_audit()                    # L1688
class FiscalPeriodViewSet             # L1732-1849 (~117 lines)
```

### Split Plan

#### [MODIFY] `fiscal_views.py` → Keep Core CRUD (~300 lines)
Keep:
- `FiscalActionPermission` (L13-30)
- `FiscalYearViewSet` with only: `perform_destroy()`, `create()`, `fill_missing_periods()`, `close()`, `finalize()`, `lock()`, `current()`, `draft_audit()`
- `FiscalPeriodViewSet` (L1732-1849)

#### [NEW] `fiscal_analysis_views.py` (~300 lines)
Move as mixin:
- `close_preview()` (L205-350)
- `summary()` (L364-658)
- `year_history()` (L684-750)
- `integrity_canary()` (L1646)

**Mixin pattern**:
```python
# fiscal_analysis_views.py
class FiscalAnalysisMixin:
    @action(detail=True, methods=['get'], url_path='close-preview')
    def close_preview(self, request, pk=None): ...

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None): ...

# fiscal_views.py
from .fiscal_analysis_views import FiscalAnalysisMixin
class FiscalYearViewSet(FiscalAnalysisMixin, ...): ...
```

#### [NEW] `fiscal_comparison_views.py` (~300 lines)
Move as mixin:
- `multi_year_comparison()` (L978-1204)
- `yoy_comparison()` (L1206-1428)
- `snapshot_chain()` (L882-976)

#### [NEW] `fiscal_checklist_views.py` (~300 lines)
Move as mixin:
- `close_checklist()` (L1430-1495)
- `close_checklist_toggle()` (L1496-1541)
- `close_checklist_add_item()` (L1542-1607)
- `close_checklist_delete_item()` (L1608-1644)
- `prior_period_adjustment()` (L776-836)
- `list_prior_period_adjustments()` (L838-880)

---

## URL Routing Changes

**Only `urls.py` imports change. No URL patterns change.**

```python
# BEFORE (urls.py)
from apps.finance.views.account_views import (
    FinancialAccountViewSet, FinancialAccountCategoryViewSet, ChartOfAccountViewSet
)
from apps.finance.views.fiscal_views import FiscalYearViewSet, FiscalPeriodViewSet

# AFTER (urls.py) — IDENTICAL registrations, same ViewSets
# No changes needed — the ViewSets still live in the same file,
# they just inherit mixins from the new files.
```

---

## Verification Checklist

After completing ALL splits, run:

```bash
# 1. Django system check — catches broken imports, model issues
python manage.py check

# 2. Django test suite for finance
python manage.py test apps.finance --verbosity=2

# 3. TypeScript (should be unchanged, but verify)
npx tsc --noEmit

# 4. File size compliance — ALL files should be ≤300 lines
find erp_backend/apps/finance/services/ erp_backend/apps/finance/views/ \
  -name "*.py" ! -path "*/migrations/*" -exec wc -l {} + | \
  awk '$1 > 300 && !/total$/' | sort -rn

# 5. Verify no broken imports
python -c "from apps.finance.services.closing_service import ClosingService; print('OK')"
python -c "from apps.finance.views.account_views import ChartOfAccountViewSet; print('OK')"
python -c "from apps.finance.views.fiscal_views import FiscalYearViewSet; print('OK')"
```

---

## Critical Rules for the Executing Agent

1. **MIXIN PATTERN ONLY** for ViewSets — do NOT create new ViewSets with separate router registrations. Use mixins that are inherited by the existing ViewSet class. This keeps all `@action` URL routing intact.

2. **STANDALONE FUNCTIONS** for services — extract as module-level functions, then re-attach to `ClosingService` as `staticmethod` in the facade. All callers continue to use `ClosingService.method_name()`.

3. **Preserve ALL docstrings and comments** — do not strip documentation during the split.

4. **Test after EACH file split** — don't batch all 3 files. Split `closing_service.py` first, verify, then `account_views.py`, verify, then `fiscal_views.py`, verify.

5. **If ANY file exceeds 300 lines after split** — split further. The `_close_fiscal_year_impl` method alone is ~686 lines and may need its own sub-split (e.g., partial-close logic into `closing_partial_close.py`).

6. **Archive nothing** — this is a SPLIT, not a cleanup. The original files are MODIFIED (reduced), not deleted.
