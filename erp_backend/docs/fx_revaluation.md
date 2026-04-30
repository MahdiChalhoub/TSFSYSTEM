# FX Revaluation — Architecture & Runbook

This document covers the FX revaluation subsystem: the period-end accounting
procedure that adjusts foreign-currency-denominated balances on the books to
reflect current exchange rates, plus realized FX on payment settlement.

> **Scope.** Transactional FX revaluation per IAS 21 / ASC 830. **Not** in
> scope: full multi-entity translation (CTA / current-rate method) for
> consolidating subsidiary financial statements — that's a separate subsystem.

---

## 1. Mental model

When a transaction is recorded in a foreign currency, the operator's books
hold both the foreign-currency amount (`amount_currency`) AND its base-
currency equivalent (the `debit`/`credit` columns) at the rate that was in
effect on the booking date.

Over time the rate moves. By period-end the carrying base-currency value of
those FC balances no longer reflects market reality. **Revaluation** is the
adjustment that closes that gap.

```
                booking date              period-end
                ───────────                ──────────
 AR (USD)       1,000 USD                  1,000 USD       (unchanged)
 Rate           600 XAF / USD              620 XAF / USD
 Carrying base  600,000 XAF                 ?              (still 600,000 — wrong)
                                            └─ revalue to 620,000 XAF
                                               difference 20,000 XAF = unrealized gain
```

The unrealized gain/loss posts to a P&L account (`FX_GAIN` or `FX_LOSS`)
with the corresponding side of the FC account. At the start of the **next**
period, the same JE is reversed (so the next period's revaluation works
from the original cost basis again).

When the FC balance is ultimately settled (e.g., the customer pays the
invoice), any rate movement *between* the booking and the payment becomes
**realized**. That happens in the payment-posting flow, not at period-end.

---

## 2. IAS 21 / ASC 830 classification

Three classes — set on each ChartOfAccount via `monetary_classification`:

| Class             | Examples                          | Rate at reval        |
| ----------------- | --------------------------------- | -------------------- |
| `MONETARY`        | Cash, AR, AP, FC bank, FC loans   | **Closing**          |
| `NON_MONETARY`    | PPE at cost, prepaid expenses     | **Historical (skip)**|
| `INCOME_EXPENSE`  | Sales, COGS, OpEx                 | **Average**          |

The engine picks the rate type per account from this classification. If no
rate of the required type exists, it falls back to the most recent SPOT
rate at or before the period end.

**Set this on every account that transacts in FC.** The bulk-classify
endpoint (`POST /api/coa/bulk-classify/ {"scope": "smart"}`) applies the
heuristics defined in `_smart_default_for` to the whole COA in one shot.
Operators can override per-account afterwards from the COA editor.

---

## 3. Workflow

```
┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐
│  Operator       │   │   Service        │   │  Reviewer          │
│  /settings/     │   │   layer          │   │  with permission   │
│  regional       │   │                  │   │                    │
└────────┬────────┘   └────────┬─────────┘   └──────────┬─────────┘
         │                     │                        │
         │ 1. Click Preview    │                        │
         ├────────────────────►│                        │
         │   compute → no DB   │                        │
         │◄────────────────────┤                        │
         │   line breakdown    │                        │
         │                     │                        │
         │ 2. (optional)       │                        │
         │    untick accounts  │                        │
         │ 3. Click Submit     │                        │
         ├────────────────────►│                        │
         │   compute → write   │                        │
         │   reval + lines     │                        │
         │                     │                        │
         │   ┌── if materiality < threshold ──┐         │
         │   │    status = POSTED              │         │
         │   │    JE auto-builds                │         │
         │   │    return reval                  │         │
         │   └────────────────────────────────┘         │
         │                     │                        │
         │   ┌── if materiality >= threshold ──┐        │
         │   │    status = PENDING_APPROVAL    │        │
         │   │    no JE yet                    │        │
         │   │    operator sees banner         │        │
         │   └─────────────────────────────────┘        │
         │                     │                        │
         │                     │  4. Reviewer approves  │
         │                     │◄───────────────────────┤
         │                     │   build + post JE      │
         │                     │   status = POSTED      │
         │                     │                        │
         │                     │  5. (later) day 1 of   │
         │                     │     next period        │
         │                     │     reverse_at_period  │
         │                     │     _start posts       │
         │                     │     reversing JE       │
```

---

## 4. Key fields

### `CurrencyRevaluation`

| Field                          | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `status`                       | DRAFT / **PENDING_APPROVAL** / POSTED / REVERSED / REJECTED  |
| `materiality_pct`              | Computed: `\|net_impact\| / revalued_base × 100`             |
| `excluded_account_ids`         | Per-run opt-out list (operator unticked accounts)            |
| `auto_reverse_at_period_start` | Default True. Engine posts reversing JE on day 1 next period |
| `reversal_journal_entry`       | The reversing JE once posted (idempotent)                    |
| `approved_by` / `approved_at`  | Audit of who posted / rejected                               |
| `rejection_reason`             | Free-text from reviewer                                      |

### `CurrencyRevaluationLine`

| Field            | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `rate_type_used` | What was applied: CLOSING / AVERAGE / SPOT / HISTORICAL |
| `classification` | Snapshot of the account's class at run time            |

### `Organization.settings['fx']`

| Key                          | Default | Meaning                              |
| ---------------------------- | ------- | ------------------------------------ |
| `materiality_threshold_pct`  | `0.5`   | Above this %, run waits for approval |

---

## 5. Public API

All actions live under `CurrencyRevaluationViewSet` at `/api/currency-revaluations/`:

| Action                                | Verb | Body                                                          |
| ------------------------------------- | ---- | ------------------------------------------------------------- |
| `preview/`                            | POST | `{fiscal_period, scope?, excluded_account_ids?}`              |
| `run/`                                | POST | `{fiscal_period, scope?, excluded_account_ids?, auto_reverse?, force_post?}` |
| `<id>/approve/`                       | POST | (no body)                                                     |
| `<id>/reject/`                        | POST | `{reason?}`                                                   |
| `<id>/reverse-at-next-period/`        | POST | (no body) — idempotent                                        |
| `catchup/`                            | POST | `{through_period, scope?, auto_reverse?, force_post?}`        |
| `exposure/`                           | GET  | `?as_of=YYYY-MM-DD&scope=OFFICIAL`                            |

Frontend wrappers (server actions): `previewRevaluation`, `runRevaluation`,
`approveRevaluation`, `rejectRevaluation`, `reverseRevaluationAtNextPeriod`,
`catchupRevaluations`, `getFxExposure` — all in
`src/app/actions/finance/currency.ts`.

---

## 6. Permissions

| Action                                | Required permission                |
| ------------------------------------- | ---------------------------------- |
| Preview, run, catchup, exposure       | Authenticated tenant member        |
| Approve, reject                       | `finance.revaluation.approve` (or superuser) |
| Reverse                               | Authenticated tenant member        |

Materiality is the **policy gate**; the permission code is the **human gate**.
Anyone can submit a run; only authorized reviewers can approve large ones.
Set `force_post=True` only if your role bypasses approvals (typically an
admin override during catchup of historical data).

---

## 7. Pre-flight checklist (before running revaluation in production)

1. **Base currency set** — exactly one `Currency` row with `is_base=True`.
2. **FX_GAIN / FX_LOSS accounts exist**. Either set `system_role='FX_GAIN'` /
   `'FX_LOSS'` on COA rows, or configure
   `posting_rules.fx.unrealized_gain` / `unrealized_loss`. The engine raises
   `ValidationError` if missing.
3. **Closing rates loaded for every FC** at or before the period end date.
   Run a CurrencyRatePolicy sync first if needed; ECB has free closing rates
   for major currencies, peg fallbacks cover XAF/XOF/KMF/AED/SAR/etc.
4. **AVERAGE rates loaded** if you have INCOME_EXPENSE-classified accounts.
5. **Accounts classified** — run Smart Classify from the FX Revaluations tab,
   then spot-check the COA editor.
6. **Materiality threshold appropriate** for the org. Default 0.5% is
   conservative; large orgs often want 1% or more.

---

## 8. Common operations

### "I need to revalue period X"

1. Settings → Regional → FX → Revaluations
2. Click the period in the left list
3. Click **Preview revaluation**
4. Review the line breakdown. Untick any account you want to exclude this run
5. (If banner says "Pending approval will be required") — that's fine, click
   Submit anyway. A reviewer will approve.
6. Click **Submit for approval** or **Post revaluation**

### "I missed several months — catch up"

1. Select the latest period you want revalued through
2. Click **Catchup**
3. Confirm. The engine runs each missing period in order and auto-reverses
   each prior period at the start of the next.

### "The reversal JE for last month never posted"

In the period detail panel, if you see "Auto-reversal pending", click
**Reverse now**. Idempotent — safe to click again if uncertain.

### "I rejected a run by mistake"

You can't un-reject. Either:
- Re-run the period (creates a new CurrencyRevaluation), OR
- Look up the rejected row in the DB; rejections preserve the line audit.

### "An FX rate is missing during catchup"

The line is added to `skipped` with reason. Other accounts still revalue
normally. Add the missing rate, then re-run that period — the new
revaluation supersedes the old one.

---

## 9. FX exposure snapshot

The Exposure card on the Revaluations tab shows current FC exposure with
±5/±10% sensitivity bands. Useful for:
- Pre-period decision: should we revalue, hedge, or ride it out?
- Treasury planning: if USD strengthens 10%, what's our P&L impact?
- Risk reporting to management.

This is read-only and doesn't post anything.

---

## 10. Realized FX on payment

When a payment settles a foreign-currency invoice, the difference between
the invoice-date rate and the payment-date rate is realized FX:

```python
PaymentService.record_customer_receipt(
    organization=org, contact_id=cust_id, amount=amount_in_base,
    payment_date=payment_date, payment_account_id=fin_acc_id,
    customer_invoice_id=invoice_id,
    payment_amount_foreign=Decimal('1000'),  # USD paid
    payment_rate=Decimal('620'),             # rate at payment
    user=user,
)
```

If `payment_amount_foreign` + `payment_rate` are **both** provided AND
there's a linked invoice with an `exchange_rate`, `_maybe_post_realized_fx`
calls `RealizedFXService.post_realized_variance` which posts a separate
realized-FX JE. Failures log at WARN and surface via
`RealizedFXService.check_realized_fx_integrity` — they do **not** block
the payment from posting.

---

## 11. Tests

`apps/finance/tests/test_revaluation_service.py` covers:

- Preview returns lines without writing
- Materiality gate parks runs as PENDING_APPROVAL
- `force_post` bypasses the gate
- Org-level threshold override
- Non-monetary classification skips the account
- Income/expense classification uses AVERAGE rate
- `excluded_account_ids` opts an account out
- Approve flips PENDING_APPROVAL → POSTED + builds JE
- Reject flips PENDING_APPROVAL → REJECTED
- Approve on a rejected run raises
- Reverse posts inverse JE on day 1 of next period
- Reverse is idempotent
- Reverse on a pending run raises
- Catchup processes periods chronologically
- Realized-FX returns zero for base-currency or missing-rate cases

Run: `python3 manage.py test apps.finance.tests.test_revaluation_service`

---

## 12. What we deliberately don't do

- **CTA / cumulative translation adjustment** — separate subsystem for
  consolidating subsidiary financials. Out of scope.
- **Hedge accounting** — forwards/options tied to FC exposure are not
  modeled. The exposure report is informational only.
- **Multi-currency P&L statements at runtime** — reports are produced in
  base currency. Re-presenting them in another currency is a future feature.
- **Fully transactional catchup** — the catchup loop does NOT roll back if
  one period's run fails partway through. Earlier successful runs are kept;
  the failing period must be re-tried after fixing the underlying cause
  (usually a missing rate).

---

## 13. Files

| Layer    | File                                                            |
| -------- | --------------------------------------------------------------- |
| Schema   | `apps/finance/models/currency_models.py` (CurrencyRevaluation, Line) |
|          | `apps/finance/models/coa_models.py` (monetary_classification)   |
|          | `apps/finance/migrations/0075_revaluation_overhaul.py`          |
|          | `apps/finance/migrations/0076_backfill_monetary_classification.py` (data migration) |
| Service  | `apps/finance/services/revaluation_service.py`                  |
|          | `apps/finance/services/realized_fx_service.py`                  |
| API      | `apps/finance/views/currency_views.py` (CurrencyRevaluationViewSet — preview, run, approve, reject, reverse, catchup, exposure, fx-settings, realized-fx-integrity) |
|          | `apps/finance/views/account_views.py` (bulk_classify + _smart_default_for) |
|          | `erp/views.py` (GlobalCurrencyViewSet — note rename)            |
|          | `erp/views_auth.py` (me_view exposes permission_flags.can_approve_revaluation) |
| Frontend | `src/app/actions/finance/currency.ts` (server actions, types)   |
|          | `src/app/actions/finance/accounts.ts` (bulk classify)           |
|          | `src/app/(privileged)/settings/regional/_components/FxRedesigned.tsx` (orchestrator) |
|          | `src/app/(privileged)/settings/regional/_components/fx/_shared.tsx` (primitives) |
|          | `src/app/(privileged)/settings/regional/_components/fx/RevaluationsView.tsx` (Revaluations subsystem: view, preview drawer, exposure card, integrity banner, reject modal, catchup results modal, settings modal) |
| Tests    | `apps/finance/tests/test_revaluation_service.py` (18 tests: preview, materiality, classification, approval, reversal, catchup transactionality) |
|          | `apps/finance/tests/test_bulk_classify.py` (smart-default heuristic + migration parity) |
| Docs     | `erp_backend/docs/fx_revaluation.md` (this file)                |
|          | `erp_backend/docs/migration_chain_recovery.md` (recovery playbook for the `erp_contract` drift blocking 0075/0076 from applying via `manage.py migrate`) |

> **Migration heads-up.** Migrations `0075` and `0076` are blocked behind a
> pre-existing chain drift documented in `migration_chain_recovery.md`.
> Until that's resolved, apply the workaround SQL from §"Workaround for FX
> revaluation specifically" in that runbook to enable this feature.
