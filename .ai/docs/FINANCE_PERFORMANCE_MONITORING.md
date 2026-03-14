# Finance Module Performance Monitoring & Dashboards

**Version**: 3.1.4
**Last Updated**: 2026-03-12
**Purpose**: Monitor performance, track metrics, and optimize Finance module features

---

## Table of Contents

1. [Overview](#overview)
2. [Key Performance Indicators (KPIs)](#key-performance-indicators)
3. [Feature-Specific Dashboards](#feature-specific-dashboards)
4. [Performance Metrics](#performance-metrics)
5. [Monitoring Setup](#monitoring-setup)
6. [Alerts & Thresholds](#alerts--thresholds)
7. [Optimization Recommendations](#optimization-recommendations)

---

## Overview

The Finance module includes built-in performance monitoring for all Phase 2 features. This guide shows how to access dashboards, interpret metrics, and optimize performance.

### Dashboard Access

**Main Dashboard**: `/api/finance/dashboard/`

**Feature Dashboards**:
- Asset Depreciation: `/api/finance/assets/depreciation_dashboard/`
- Budget Variance: `/api/finance/budgets/{id}/performance/`
- Bank Reconciliation: `/api/finance/bank-reconciliation/dashboard/`
- Loan Management: `/api/finance/loans/dashboard/`
- Financial Reports: `/api/finance/reports/dashboard/`

---

## Key Performance Indicators (KPIs)

### System-Wide KPIs

| Metric | Description | Target | Critical Threshold |
|--------|-------------|--------|-------------------|
| **API Response Time** | Average response time for Finance APIs | <200ms | >1000ms |
| **Database Query Time** | Average DB query execution time | <100ms | >500ms |
| **Transaction Success Rate** | % of successful transactions | >99% | <95% |
| **Daily Active Users** | Users accessing Finance module | N/A | Monitor trend |
| **Error Rate** | % of requests with errors | <0.1% | >1% |

### Feature-Specific KPIs

**Asset Depreciation**:
- Assets depreciated per month
- Depreciation posting success rate
- Average processing time per asset
- Asset register accuracy

**Budget Variance**:
- Budget vs actual variance %
- Alert generation rate
- Actual refresh frequency
- Variance trend direction

**Bank Reconciliation**:
- Auto-match success rate (target: >80%)
- Average reconciliation time
- Unmatched transaction %
- Reconciliation completion rate

**Loan Management**:
- Loan payment on-time rate
- Schedule generation time
- Early payoff calculation accuracy
- Interest calculation precision

**Financial Reports**:
- Report generation time
- Trial balance accuracy (always 100%)
- Report cache hit rate
- Export success rate

---

## Feature-Specific Dashboards

### 1. Asset Depreciation Dashboard

**Endpoint**: `GET /api/finance/assets/depreciation_dashboard/`

**Metrics Displayed**:

```json
{
  "summary": {
    "total_assets": 125,
    "active_assets": 118,
    "disposed_assets": 7,
    "total_acquisition_cost": "15000000.00",
    "total_accumulated_depreciation": "3750000.00",
    "total_book_value": "11250000.00",
    "monthly_depreciation_expense": "125000.00",
    "ytd_depreciation": "375000.00"
  },
  "pending_actions": {
    "pending_postings": 15,
    "pending_disposals": 2,
    "assets_needing_schedule_regeneration": 3
  },
  "depreciation_by_method": {
    "LINEAR": {
      "count": 85,
      "book_value": "8500000.00",
      "monthly_expense": "95000.00"
    },
    "DECLINING": {
      "count": 28,
      "book_value": "2500000.00",
      "monthly_expense": "28000.00"
    },
    "UNITS": {
      "count": 5,
      "book_value": "250000.00",
      "monthly_expense": "2000.00"
    }
  },
  "depreciation_by_category": [
    {
      "category": "Computers & IT",
      "count": 45,
      "book_value": "2250000.00",
      "monthly_expense": "45000.00"
    },
    {
      "category": "Vehicles",
      "count": 20,
      "book_value": "4000000.00",
      "monthly_expense": "50000.00"
    }
  ],
  "performance_metrics": {
    "avg_posting_time_ms": 45,
    "posting_success_rate_pct": 99.8,
    "last_batch_post_duration_seconds": 12
  }
}
```

**Key Charts**:
1. **Book Value Trend**: Line chart showing total book value over time
2. **Monthly Depreciation**: Bar chart of depreciation expense by month
3. **Asset Distribution**: Pie chart by depreciation method
4. **Category Breakdown**: Stacked bar chart by asset category

**Alerts**:
- ⚠️ Pending postings >30 days old
- ⚠️ Assets with negative book value (error condition)
- ⚠️ Schedule regeneration needed

---

### 2. Budget Variance Dashboard

**Endpoint**: `GET /api/finance/budgets/{id}/performance/`

**Metrics Displayed**:

```json
{
  "budget_summary": {
    "budget_id": 10,
    "fiscal_year": "FY2026",
    "status": "APPROVED",
    "total_budgeted": "2400000.00",
    "total_actual": "600000.00",
    "periods_elapsed": 3,
    "total_periods": 12,
    "completion_pct": 25.0,
    "spend_rate_pct": 25.0,
    "on_track": true
  },
  "variance_summary": {
    "total_variance": "0.00",
    "variance_pct": 0.0,
    "favorable_variance": "45000.00",
    "unfavorable_variance": "45000.00",
    "net_variance": "0.00"
  },
  "alerts": {
    "critical_count": 2,
    "warning_count": 5,
    "info_count": 3,
    "total_over_budget_accounts": 10
  },
  "top_variances": [
    {
      "account": "6200 - Travel Expenses",
      "budgeted": "50000.00",
      "actual": "75000.00",
      "variance": "-25000.00",
      "variance_pct": -50.0,
      "severity": "CRITICAL"
    },
    {
      "account": "6000 - Operating Expenses",
      "budgeted": "500000.00",
      "actual": "475000.00",
      "variance": "25000.00",
      "variance_pct": 5.0,
      "severity": "INFO"
    }
  ],
  "projected_year_end": {
    "projected_total": "2400000.00",
    "projected_variance": "0.00",
    "confidence_level": "HIGH",
    "recommendation": "Spending on track. Continue monitoring."
  },
  "performance_metrics": {
    "variance_calculation_time_ms": 85,
    "alert_generation_time_ms": 25,
    "last_actual_refresh": "2026-03-12T23:00:00Z"
  }
}
```

**Key Charts**:
1. **Budget vs Actual Trend**: Line chart comparing budget and actual over time
2. **Variance by Account**: Horizontal bar chart showing variance by GL account
3. **Variance by Period**: Stacked bar showing monthly variance
4. **Alert Distribution**: Pie chart of Critical/Warning/Info alerts

**Alerts**:
- 🔴 **CRITICAL**: Accounts >10% over budget
- 🟠 **WARNING**: Accounts 5-10% over budget
- 🔵 **INFO**: Accounts <5% over budget

---

### 3. Bank Reconciliation Dashboard

**Endpoint**: `GET /api/finance/bank-reconciliation/dashboard/`

**Metrics Displayed**:

```json
{
  "summary": {
    "total_bank_accounts": 5,
    "active_reconciliations": 3,
    "completed_reconciliations_this_month": 4,
    "pending_reconciliations": 2
  },
  "matching_performance": {
    "total_transactions_processed": 1250,
    "auto_matched": 1050,
    "manually_matched": 180,
    "unmatched": 20,
    "auto_match_rate_pct": 84.0,
    "manual_match_rate_pct": 14.4,
    "unmatched_rate_pct": 1.6
  },
  "matching_by_level": {
    "level_1_exact": 900,
    "level_2_date_tolerance": 100,
    "level_3_reference": 40,
    "level_4_fuzzy_amount": 10
  },
  "time_to_reconcile": {
    "avg_reconciliation_time_minutes": 15,
    "fastest_reconciliation_minutes": 5,
    "slowest_reconciliation_minutes": 45
  },
  "outstanding_items": {
    "outstanding_deposits": 8,
    "outstanding_withdrawals": 12,
    "total_outstanding_amount": "45000.00"
  },
  "performance_metrics": {
    "avg_auto_match_time_ms": 120,
    "avg_import_time_seconds": 3.5,
    "match_accuracy_pct": 99.2
  }
}
```

**Key Charts**:
1. **Auto-Match Rate Trend**: Line chart showing auto-match % over time
2. **Matching Level Distribution**: Stacked bar chart by level (1-4)
3. **Reconciliation Time**: Box plot showing time distribution
4. **Outstanding Items Aging**: Aging report for unmatched items

**Alerts**:
- ⚠️ Auto-match rate <70% (investigate transaction data quality)
- ⚠️ Unmatched rate >5% (review exceptions)
- ⚠️ Outstanding items >30 days old

---

### 4. Loan Management Dashboard

**Endpoint**: `GET /api/finance/loans/dashboard/`

**Metrics Displayed**:

```json
{
  "summary": {
    "total_loans": 15,
    "active_loans": 12,
    "paid_off_loans": 3,
    "total_principal": "5000000.00",
    "total_outstanding": "3750000.00",
    "total_paid": "1250000.00"
  },
  "payment_performance": {
    "total_payments_made": 180,
    "on_time_payments": 175,
    "late_payments": 5,
    "on_time_rate_pct": 97.2,
    "avg_days_late": 3.2
  },
  "interest_summary": {
    "total_interest_paid_ytd": "125000.00",
    "total_interest_remaining": "375000.00",
    "avg_interest_rate_pct": 8.5
  },
  "loans_by_method": {
    "REDUCING_BALANCE": {
      "count": 10,
      "outstanding": "3000000.00"
    },
    "FLAT_RATE": {
      "count": 2,
      "outstanding": "500000.00"
    },
    "BALLOON": {
      "count": 0,
      "outstanding": "0.00"
    },
    "INTEREST_ONLY": {
      "count": 0,
      "outstanding": "0.00"
    }
  },
  "upcoming_payments": [
    {
      "loan_id": 5,
      "loan_name": "Equipment Loan",
      "due_date": "2026-04-01",
      "amount": "15000.00",
      "days_until_due": 19
    }
  ],
  "performance_metrics": {
    "avg_schedule_generation_time_ms": 25,
    "avg_payment_recording_time_ms": 50,
    "calculation_accuracy_pct": 100.0
  }
}
```

**Key Charts**:
1. **Outstanding Balance Trend**: Line chart showing total outstanding over time
2. **Payment Performance**: Stacked bar chart (on-time vs late)
3. **Interest vs Principal**: Stacked area chart showing cumulative payments
4. **Loan Distribution**: Pie chart by amortization method

**Alerts**:
- ⚠️ Upcoming payments within 7 days
- ⚠️ Late payments >15 days overdue
- ⚠️ On-time rate <95%

---

### 5. Financial Reports Dashboard

**Endpoint**: `GET /api/finance/reports/dashboard/`

**Metrics Displayed**:

```json
{
  "as_of_date": "2026-03-12",
  "financial_summary": {
    "total_assets": "18500000.00",
    "total_liabilities": "7200000.00",
    "total_equity": "11300000.00",
    "net_income_ytd": "1500000.00",
    "cash_balance": "2500000.00",
    "accounts_receivable": "3500000.00",
    "accounts_payable": "1800000.00"
  },
  "financial_ratios": {
    "current_ratio": 2.5,
    "quick_ratio": 1.8,
    "debt_to_equity": 0.64,
    "net_profit_margin_pct": 15.0,
    "roe_pct": 13.3
  },
  "period_comparison": {
    "revenue_growth_pct": 12.5,
    "expense_growth_pct": 8.0,
    "net_income_growth_pct": 18.2
  },
  "report_generation_performance": {
    "avg_trial_balance_time_ms": 450,
    "avg_profit_loss_time_ms": 600,
    "avg_balance_sheet_time_ms": 550,
    "avg_cash_flow_time_ms": 750
  },
  "data_quality": {
    "trial_balance_balanced": true,
    "balance_sheet_balanced": true,
    "unposted_journal_entries": 5,
    "draft_transactions": 12
  }
}
```

**Key Charts**:
1. **Financial Position**: Horizontal bar chart (Assets, Liabilities, Equity)
2. **P&L Trend**: Line chart showing revenue, expenses, net income over time
3. **Cash Flow Waterfall**: Waterfall chart from operating/investing/financing
4. **Ratio Dashboard**: Gauge charts for key financial ratios

**Alerts**:
- ⚠️ Trial balance not balanced (critical error)
- ⚠️ Balance sheet not balanced (critical error)
- ⚠️ Current ratio <1.0 (liquidity concern)
- ⚠️ Debt-to-equity >2.0 (leverage concern)

---

## Performance Metrics

### Response Time Targets

| Endpoint Type | Target (ms) | Good (ms) | Acceptable (ms) | Poor (ms) |
|---------------|-------------|-----------|-----------------|-----------|
| **List APIs** | <100 | <200 | <500 | >500 |
| **Detail APIs** | <50 | <100 | <300 | >300 |
| **Report APIs** | <500 | <1000 | <3000 | >3000 |
| **Batch Operations** | <2000 | <5000 | <10000 | >10000 |

### Database Query Optimization

**Indexed Fields** (for fast queries):
- `organization_id` - All models
- `date` fields - Transactions, journal entries
- `status` fields - Assets, loans, budgets
- `account_id` - Journal entry lines
- Foreign keys - All relationships

**Query Patterns to Avoid**:
- ❌ N+1 queries (use `select_related`, `prefetch_related`)
- ❌ Full table scans (ensure WHERE clauses use indexes)
- ❌ Missing pagination (always paginate list views)
- ❌ Complex joins without indexes
- ❌ Subqueries in SELECT clause (move to WHERE or JOIN)

**Optimized Query Examples**:

```python
# ✅ Good: Optimized with select_related
assets = Asset.objects.filter(
    organization=org,
    status='ACTIVE'
).select_related(
    'asset_account',
    'accumulated_depreciation_account',
    'depreciation_expense_account'
).only(
    'id', 'name', 'acquisition_cost', 'book_value'
)

# ❌ Bad: N+1 queries
assets = Asset.objects.filter(organization=org)
for asset in assets:
    # Each iteration hits DB for related accounts
    account_name = asset.asset_account.name

# ✅ Good: Aggregation at DB level
total_book_value = Asset.objects.filter(
    organization=org,
    status='ACTIVE'
).aggregate(
    total=Sum('book_value')
)['total']

# ❌ Bad: Aggregation in Python
assets = Asset.objects.filter(organization=org, status='ACTIVE')
total_book_value = sum(asset.book_value for asset in assets)
```

---

## Monitoring Setup

### 1. Enable Django Debug Toolbar (Development)

```python
# settings.py
if DEBUG:
    INSTALLED_APPS += ['debug_toolbar']
    MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
    INTERNAL_IPS = ['127.0.0.1']
```

**Usage**: Shows SQL queries, cache hits, template rendering time

### 2. Enable Query Logging (Production)

```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': '/var/log/finance/queries.log',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['file'],
            'level': 'DEBUG',
        },
    },
}
```

**Analysis**: Use `pgbadger` or `pg_stat_statements` to find slow queries

### 3. Application Performance Monitoring (APM)

**Recommended Tools**:
- **Sentry**: Error tracking and performance monitoring
- **New Relic**: Full-stack APM
- **Datadog**: Infrastructure and application monitoring
- **Prometheus + Grafana**: Open-source metrics and dashboards

**Key Metrics to Track**:
- Request rate (requests/second)
- Error rate (errors/second)
- Duration (p50, p95, p99 percentiles)
- Apdex score (user satisfaction)

### 4. Database Monitoring

**PostgreSQL Monitoring**:

```sql
-- Top 10 slowest queries
SELECT
    calls,
    total_time / 1000 as total_seconds,
    mean_time / 1000 as avg_seconds,
    query
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;
```

---

## Alerts & Thresholds

### Critical Alerts (Immediate Action Required)

| Alert | Threshold | Action |
|-------|-----------|--------|
| API Error Rate | >1% | Check logs, roll back if needed |
| Trial Balance Imbalanced | Any occurrence | Fix journal entries immediately |
| Balance Sheet Imbalanced | Any occurrence | Fix accounting data |
| Database Connection Errors | >5 in 1 min | Check DB health, restart if needed |
| Depreciation Posting Failures | >10% | Review asset data, fix errors |

### Warning Alerts (Action Within 24 Hours)

| Alert | Threshold | Action |
|-------|-----------|--------|
| API Response Time | >1000ms | Optimize queries, add caching |
| Auto-Match Rate | <70% | Review transaction data quality |
| Budget Variance | >10% over | Review spending, adjust budget |
| Late Loan Payments | >15 days | Contact borrower, assess risk |
| Unmatched Reconciliation Items | >5% | Review and match manually |

### Info Alerts (Monitor Trend)

| Alert | Threshold | Action |
|-------|-----------|--------|
| API Response Time | >500ms | Monitor trend, optimize if worsening |
| Pending Depreciation Postings | >10 assets | Schedule batch posting |
| Report Generation Time | >3s | Consider caching, optimize |
| Budget Variance | 5-10% over | Monitor, adjust if continues |

---

## Optimization Recommendations

### 1. Asset Depreciation Optimization

**Bottleneck**: Batch posting for large asset counts

**Solution**:
```python
# Use bulk_create for schedule entries
DepreciationScheduleEntry.objects.bulk_create(schedule_entries, batch_size=100)

# Use bulk_update for status changes
Asset.objects.filter(id__in=asset_ids).update(last_posted_date=today)

# Process in batches with Celery
@shared_task
def batch_post_depreciation(asset_ids, month, year):
    for batch in chunks(asset_ids, 50):
        for asset_id in batch:
            post_single_asset_depreciation(asset_id, month, year)
```

**Expected Improvement**: 10x faster for >100 assets

### 2. Budget Variance Optimization

**Bottleneck**: Refreshing actuals from journal entries

**Solution**:
```python
# Use aggregation instead of iteration
from django.db.models import Sum, Q

actuals = JournalEntryLine.objects.filter(
    organization=org,
    journal_entry__entry_date__range=(period_start, period_end),
    journal_entry__status='POSTED'
).values('account_id').annotate(
    total_debit=Sum('debit'),
    total_credit=Sum('credit')
)

# Bulk update budget lines
BudgetLine.objects.bulk_update(budget_lines, ['actual_amount'], batch_size=100)
```

**Expected Improvement**: 5x faster for large budgets

### 3. Bank Reconciliation Optimization

**Bottleneck**: Auto-matching across large transaction sets

**Solution**:
```python
# Create index on amount and date
class BankStatementLine(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['amount', 'transaction_date']),
            models.Index(fields=['reference']),
        ]

# Use EXISTS subquery for matching
matched_lines = BankStatementLine.objects.filter(
    Exists(
        JournalEntryLine.objects.filter(
            amount=OuterRef('amount'),
            journal_entry__entry_date=OuterRef('transaction_date')
        )
    )
)
```

**Expected Improvement**: 3x faster matching

### 4. Financial Reports Optimization

**Bottleneck**: Account balance calculation for large chart of accounts

**Solution**:
```python
# Use materialized view or cache
from django.core.cache import cache

def get_account_balances(org, as_of_date):
    cache_key = f'balances_{org.id}_{as_of_date}'
    balances = cache.get(cache_key)

    if balances is None:
        balances = calculate_balances(org, as_of_date)
        cache.set(cache_key, balances, timeout=3600)  # 1 hour

    return balances

# Use account balance snapshots
AccountBalanceSnapshot.objects.create(
    organization=org,
    account=account,
    as_of_date=date,
    balance=calculated_balance
)
```

**Expected Improvement**: 10x faster with caching

### 5. Loan Management Optimization

**Bottleneck**: Amortization schedule generation

**Solution**:
```python
# Cache generated schedules
schedule = cache.get(f'loan_schedule_{loan.id}')
if schedule is None:
    schedule = generate_schedule(loan)
    cache.set(f'loan_schedule_{loan.id}', schedule, timeout=86400)

# Use numpy for calculations
import numpy as np

def calculate_reducing_balance_schedule(principal, rate, periods):
    monthly_rate = rate / 12 / 100
    pmt = np.pmt(monthly_rate, periods, -principal)

    # Vectorized calculation
    period_array = np.arange(1, periods + 1)
    remaining_balance = principal * (1 + monthly_rate)**period_array - pmt * ((1 + monthly_rate)**period_array - 1) / monthly_rate

    return pmt, remaining_balance
```

**Expected Improvement**: 5x faster for long-term loans

---

## Best Practices Checklist

### Development
- ✅ Use `select_related()` for foreign keys
- ✅ Use `prefetch_related()` for reverse foreign keys
- ✅ Always paginate list views
- ✅ Use `.only()` or `.defer()` to limit fields
- ✅ Use database indexes on filter/order fields
- ✅ Cache expensive calculations
- ✅ Use bulk operations for batch updates

### Production
- ✅ Enable query logging and monitoring
- ✅ Set up APM (Sentry, New Relic, etc.)
- ✅ Configure alerting for critical metrics
- ✅ Regular database vacuuming and analysis
- ✅ Monitor disk space and growth
- ✅ Review slow query logs weekly
- ✅ Load test before major releases

### Testing
- ✅ Performance tests for report generation
- ✅ Load tests for batch operations
- ✅ Stress tests for concurrent users
- ✅ Monitor test suite execution time
- ✅ Profile slow tests and optimize

---

## Dashboard Screenshots (Placeholders)

**Note**: In production, these dashboards are available at:
- Finance Admin UI: `https://tsf.ci/finance/dashboard/`
- API JSON responses: `https://tsf.ci/api/finance/dashboard/`
- Grafana Dashboards: `https://grafana.tsf.ci/`

---

## Conclusion

The Finance module includes comprehensive performance monitoring across all Phase 2 features. Use these dashboards to:

1. **Monitor Health**: Track key metrics daily
2. **Identify Issues**: Catch performance problems early
3. **Optimize Performance**: Use metrics to guide optimization
4. **Plan Capacity**: Forecast growth and scaling needs
5. **Ensure Accuracy**: Validate data integrity continuously

For support with performance issues:
- **Email**: performance@tsfsystem.com
- **Slack**: #finance-performance
- **Documentation**: https://docs.tsfsystem.com/performance

---

**Last Updated**: 2026-03-12
**Version**: 3.1.4
**Maintained By**: Finance Team + DevOps
