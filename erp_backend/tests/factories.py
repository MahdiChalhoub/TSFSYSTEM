"""
Shared Test Factories
---------------------
Reusable fixtures for all Django test suites.
Reduces boilerplate and ensures consistent test data.

Usage:
    from tests.factories import make_org, make_user, make_account, make_fiscal_year
"""
from erp.models import Organization, User
from apps.finance.models import ChartOfAccount, FiscalYear, FiscalPeriod
import datetime
from decimal import Decimal


_counter = 0


def _next_id():
    """Thread-unsafe counter — fine for test-only use."""
    global _counter
    _counter += 1
    return _counter


def make_org(name=None, slug=None, **kwargs):
    """Create a test Organization."""
    n = _next_id()
    return Organization.objects.create(
        name=name or f"Test Org {n}",
        slug=slug or f"test-org-{n}",
        **kwargs,
    )


def make_user(organization=None, username=None, email=None, **kwargs):
    """Create a test User linked to an organization."""
    n = _next_id()
    org = organization or make_org()
    return User.objects.create_user(
        username=username or f"testuser{n}",
        email=email or f"testuser{n}@test.local",
        password="TestPass123!",
        organization=org,
        **kwargs,
    )


def make_account(organization, code=None, name=None, type="ASSET", **kwargs):
    """Create a ChartOfAccount entry."""
    n = _next_id()
    return ChartOfAccount.objects.create(
        organization=organization,
        code=code or f"{1000 + n}",
        name=name or f"Test Account {n}",
        type=type,
        **kwargs,
    )


def make_fiscal_year(organization, year=2026, **kwargs):
    """Create a FiscalYear with a full-year FiscalPeriod."""
    fy = FiscalYear.objects.create(
        organization=organization,
        name=kwargs.pop('name', f"FY-{year}"),
        start_date=datetime.date(year, 1, 1),
        end_date=datetime.date(year, 12, 31),
        **kwargs,
    )
    FiscalPeriod.objects.create(
        organization=organization,
        fiscal_year=fy,
        name=f"FY{year}-FULL",
        start_date=datetime.date(year, 1, 1),
        end_date=datetime.date(year, 12, 31),
    )
    return fy


def make_fiscal_period(organization, fiscal_year, month=1, **kwargs):
    """Create a single-month FiscalPeriod."""
    year = fiscal_year.start_date.year
    start = datetime.date(year, month, 1)
    if month == 12:
        end = datetime.date(year, 12, 31)
    else:
        end = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    return FiscalPeriod.objects.create(
        organization=organization,
        fiscal_year=fiscal_year,
        name=kwargs.pop('name', f"P{month:02d}-{year}"),
        start_date=start,
        end_date=end,
        **kwargs,
    )


def make_journal_lines(debit_account, credit_account, amount):
    """Create balanced journal entry lines (debit/credit pair)."""
    return [
        {"account_id": debit_account.id, "debit": Decimal(str(amount)), "credit": Decimal("0")},
        {"account_id": credit_account.id, "debit": Decimal("0"), "credit": Decimal(str(amount))},
    ]


class TestOrgMixin:
    """
    Mixin for Django TestCase that provides self.org, self.fy, self.fp.
    Add to your test class: class MyTest(TestOrgMixin, TestCase):
    """
    def setUp(self):
        super().setUp()
        self.org = make_org()
        self.fy = make_fiscal_year(self.org)
        self.fp = make_fiscal_period(self.org, self.fy, month=1)
