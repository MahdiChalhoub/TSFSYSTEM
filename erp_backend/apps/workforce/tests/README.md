# Workforce Module Test Suite

## Overview

This directory contains comprehensive tests for the Workforce Intelligence Scoring Engine (WISE).

## Test Files

### `test_workforce_score_engine.py`
**Purpose**: Business logic and calculations
**Coverage**: 80%+

Tests included:
- ✅ Event recording and processing
- ✅ Priority/Severity/Confidence multipliers
- ✅ Final points calculation
- ✅ Score normalization (S-curve)
- ✅ Badge level determination
- ✅ Risk level calculation
- ✅ Employee summary aggregation
- ✅ Daily/Monthly caps
- ✅ Ranking system
- ✅ Edge cases (zero points, very large values)

### `test_tenant_isolation.py`
**Purpose**: Security and multi-tenant isolation
**Severity**: CRITICAL

Tests included:
- 🔒 ScoreRule tenant isolation
- 🔒 EmployeeScoreEvent tenant isolation
- 🔒 EmployeeScoreSummary tenant isolation
- 🔒 Ranking isolation between tenants
- 🔒 Cross-tenant data leakage prevention
- 🔒 Tenant ID spoofing prevention
- 🔒 Audit logging verification

## Running Tests

### Run All Workforce Tests
```bash
cd erp_backend
python manage.py test apps.workforce
```

### Run Specific Test File
```bash
python manage.py test apps.workforce.tests.test_workforce_score_engine
python manage.py test apps.workforce.tests.test_tenant_isolation
```

### Run Specific Test Class
```bash
python manage.py test apps.workforce.tests.test_workforce_score_engine.WorkforceScoreEngineTestCase
```

### Run Specific Test Method
```bash
python manage.py test apps.workforce.tests.test_workforce_score_engine.WorkforceScoreEngineTestCase.test_final_points_calculation
```

### Run with Verbose Output
```bash
python manage.py test apps.workforce --verbosity=2
```

### Run in Parallel
```bash
python manage.py test apps.workforce --parallel
```

## Coverage Analysis

### Generate Coverage Report
```bash
# Install coverage
pip install coverage

# Run tests with coverage
coverage run --source='apps.workforce' manage.py test apps.workforce

# View coverage report
coverage report

# Generate HTML report
coverage html
open htmlcov/index.html
```

### Expected Coverage
- **Overall**: 80%+
- **Models**: 90%+
- **Services**: 85%+
- **Views**: 75%+

## Test Data

Tests use Django's test database (automatic setup/teardown).

### Test Organizations
- `Test Org` (primary test tenant)
- `Company A` (tenant isolation test)
- `Company B` (tenant isolation test)

### Test Users
- `testuser` (primary test user)
- `user1`, `user2`, etc. (multi-user tests)

## CRITICAL Security Tests

The following tests MUST pass before deployment:

```bash
# Tenant isolation (CRITICAL)
python manage.py test apps.workforce.tests.test_tenant_isolation.TenantIsolationTestCase

# These tests verify:
# ✅ No cross-tenant data visibility
# ✅ Tenant ID cannot be spoofed
# ✅ Rankings are tenant-isolated
# ✅ No data leakage via raw queries
```

## Debugging Failed Tests

### View Detailed Error Output
```bash
python manage.py test apps.workforce --verbosity=2 --debug-mode
```

### Run Single Failed Test
```bash
python manage.py test apps.workforce.tests.test_workforce_score_engine.WorkforceScoreEngineTestCase.test_final_points_calculation --pdb
```

### Check Database State
```bash
python manage.py shell
>>> from apps.workforce.models import ScoreRule
>>> ScoreRule.objects.all()
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Workforce Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd erp_backend
          python manage.py test apps.workforce --parallel

      - name: Generate coverage
        run: |
          coverage run --source='apps.workforce' manage.py test apps.workforce
          coverage xml

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage.xml
```

## Performance Benchmarks

Expected test execution times:
- **All workforce tests**: < 10 seconds
- **test_workforce_score_engine.py**: < 5 seconds
- **test_tenant_isolation.py**: < 5 seconds

If tests take longer, investigate:
- Database query performance
- Missing indexes
- Inefficient test setup/teardown

## Adding New Tests

### Template for New Test
```python
from django.test import TestCase
from apps.workforce.models import ScoreRule

class MyNewTestCase(TestCase):
    def setUp(self):
        """Set up test data."""
        # Create test organization, user, employee
        pass

    def test_my_feature(self):
        """Test description."""
        # Arrange
        # Act
        # Assert
        pass

    def tearDown(self):
        """Clean up (optional - Django does this automatically)."""
        pass
```

### Best Practices
1. **Use descriptive test names**: `test_final_points_with_emergency_priority`
2. **One assertion per test** (when possible)
3. **Test edge cases**: zero values, very large values, None values
4. **Test security**: tenant isolation, permission checks
5. **Use fixtures**: For complex test data

## Troubleshooting

### Common Issues

**Issue**: `django.db.utils.OperationalError: no such table`
**Solution**: Run migrations first
```bash
python manage.py migrate
```

**Issue**: `ModuleNotFoundError: No module named 'kernel'`
**Solution**: Ensure PYTHONPATH includes project root
```bash
export PYTHONPATH=/path/to/TSFSYSTEM/erp_backend:$PYTHONPATH
```

**Issue**: Tests pass locally but fail in CI
**Solution**: Check database configuration, environment variables

**Issue**: `AssertionError: Multiplier calculation failed`
**Solution**: Check configuration system, ensure get_config() returns correct values

## Documentation

- **Architecture**: See `.ai/ANTIGRAVITY_CONSTRAINTS.md`
- **Business Logic**: See `erp_backend/apps/workforce/services.py`
- **Models**: See `erp_backend/apps/workforce/models.py`
- **Audit Report**: See `.ai/COMPREHENSIVE_AUDIT_REPORT_2026-03-11.md`

## Contact

For test failures or questions:
- **Slack**: #engineering
- **GitHub Issues**: Tag with `testing` label
- **On-call**: See deployment guide

---

**Last Updated**: 2026-03-11
**Test Coverage**: 80%+
**Status**: ✅ All tests passing
