"""
Bank Reconciliation Service
============================
Handles auto-matching of bank statement lines to journal entry lines.

Matching Algorithm:
- Level 1: Exact match (amount + date + reference) → 100% confidence
- Level 2: Amount + date within 3 days → 90% confidence
- Level 3: Amount + description keywords → 80% confidence
- Level 4: Amount only (within tolerance) → 60% confidence

Usage:
    from apps.finance.services.bank_reconciliation_service import BankReconciliationService

    service = BankReconciliationService(statement)
    matches = service.auto_match_all()
    service.apply_matches(matches)
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from typing import List, Dict, Optional, Tuple
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
import re


class BankReconciliationService:
    """Service for bank statement reconciliation and auto-matching."""

    # Matching confidence thresholds
    CONFIDENCE_EXACT = 1.0
    CONFIDENCE_HIGH = 0.9
    CONFIDENCE_MEDIUM = 0.8
    CONFIDENCE_LOW = 0.6

    # Date tolerance for matching
    DATE_TOLERANCE_DAYS = 3

    # Amount tolerance (0.01 = 1 cent)
    AMOUNT_TOLERANCE = Decimal('0.01')

    def __init__(self, statement):
        """
        Initialize reconciliation service.

        Args:
            statement: BankStatement instance
        """
        self.statement = statement
        self.organization = statement.organization
        self.account = statement.account

    def auto_match_all(self, min_confidence: float = 0.8) -> List[Dict]:
        """
        Auto-match all unmatched statement lines to journal entries.

        Args:
            min_confidence: Minimum confidence score to suggest match (0.0-1.0)

        Returns:
            List of match dictionaries:
            [
                {
                    'line': BankStatementLine,
                    'matched_entry': JournalEntryLine,
                    'confidence': 0.95,
                    'match_reason': 'Exact match: amount, date, reference'
                },
                ...
            ]
        """
        from apps.finance.models.bank_reconciliation_models import BankStatementLine
        from apps.finance.models import JournalEntryLine

        # Get unmatched lines
        unmatched_lines = self.statement.lines.filter(is_matched=False)

        # Get candidate journal entries (unreconciled entries for this account)
        candidate_entries = self._get_candidate_entries()

        matches = []
        for line in unmatched_lines:
            match = self._find_best_match(line, candidate_entries)
            if match and match['confidence'] >= min_confidence:
                matches.append(match)

        return matches

    def auto_match_line(self, line) -> Optional[Dict]:
        """
        Find best match for a single statement line.

        Args:
            line: BankStatementLine instance

        Returns:
            Match dict or None if no good match found
        """
        candidate_entries = self._get_candidate_entries()
        return self._find_best_match(line, candidate_entries)

    def apply_matches(self, matches: List[Dict], user) -> Dict[str, int]:
        """
        Apply a list of matches to statement lines.

        Args:
            matches: List of match dicts from auto_match_all()
            user: User performing the matching

        Returns:
            Stats dict: {'matched': 5, 'errors': 0}
        """
        stats = {'matched': 0, 'errors': 0}

        with transaction.atomic():
            for match in matches:
                try:
                    line = match['line']
                    entry = match['matched_entry']
                    confidence = match['confidence']

                    line.match_to_entry(entry, user, confidence)
                    stats['matched'] += 1
                except Exception as e:
                    stats['errors'] += 1

        return stats

    def manual_match(self, line, journal_entry_line, user) -> bool:
        """
        Manually match a statement line to journal entry line.

        Args:
            line: BankStatementLine instance
            journal_entry_line: JournalEntryLine instance
            user: User performing the match

        Returns:
            True if successful
        """
        # Validate match is reasonable
        if not self._validate_manual_match(line, journal_entry_line):
            return False

        line.match_to_entry(journal_entry_line, user, confidence=1.0)
        return True

    def unmatch_line(self, line) -> bool:
        """
        Remove match from a statement line.

        Args:
            line: BankStatementLine instance

        Returns:
            True if successful
        """
        line.is_matched = False
        line.matched_entry = None
        line.match_confidence = None
        line.matched_by = None
        line.matched_at = None
        line.save(update_fields=[
            'is_matched', 'matched_entry', 'match_confidence',
            'matched_by', 'matched_at'
        ])

        # Recalculate statement totals
        self.statement.calculate_totals()
        return True

    def start_session(self, user):
        """
        Start a new reconciliation session.

        Args:
            user: User starting the session

        Returns:
            ReconciliationSession instance
        """
        from apps.finance.models.bank_reconciliation_models import ReconciliationSession

        session = ReconciliationSession.objects.create(
            organization=self.organization,
            statement=self.statement,
            started_by=user,
            status='IN_PROGRESS'
        )

        return session

    def complete_session(self, session):
        """
        Complete a reconciliation session.

        Args:
            session: ReconciliationSession instance
        """
        session.completed_at = timezone.now()
        session.duration_seconds = int((session.completed_at - session.started_at).total_seconds())

        # Calculate stats
        lines = self.statement.lines.all()
        session.auto_matched_count = lines.filter(
            is_matched=True,
            match_confidence__lt=1.0
        ).count()
        session.manual_matched_count = lines.filter(
            is_matched=True,
            match_confidence=1.0
        ).count()
        session.unmatched_count = lines.filter(is_matched=False).count()

        session.status = 'COMPLETED'
        session.save(update_fields=[
            'completed_at', 'duration_seconds',
            'auto_matched_count', 'manual_matched_count', 'unmatched_count',
            'status'
        ])

        # Update statement status
        if session.unmatched_count == 0:
            self.statement.status = 'MATCHED'
            self.statement.save(update_fields=['status'])

    # Private helper methods

    def _get_candidate_entries(self):
        """
        Get candidate journal entry lines for matching.

        Returns:
            QuerySet of JournalEntryLine instances
        """
        from apps.finance.models import JournalEntryLine, JournalEntry

        # Date range: statement date ± 7 days
        date_from = self.statement.statement_date - timedelta(days=7)
        date_to = self.statement.statement_date + timedelta(days=7)

        # Get journal entries for this account in date range
        candidates = JournalEntryLine.objects.filter(
            organization=self.organization,
            account=self.account,
            entry__transaction_date__gte=date_from,
            entry__transaction_date__lte=date_to,
            entry__status='POSTED'  # Only posted entries
        ).select_related('entry').exclude(
            # Exclude already matched lines
            matched_bank_lines__isnull=False
        )

        return candidates

    def _find_best_match(self, line, candidate_entries) -> Optional[Dict]:
        """
        Find best matching journal entry for a statement line.

        Matching levels:
        1. Exact: amount + date + reference → 100%
        2. High: amount + date within 3 days → 90%
        3. Medium: amount + description keywords → 80%
        4. Low: amount only (within tolerance) → 60%
        """
        best_match = None
        best_confidence = 0.0

        # Determine transaction amount and type
        is_debit = line.debit_amount > 0
        line_amount = line.debit_amount if is_debit else line.credit_amount

        for entry in candidate_entries:
            confidence, reason = self._calculate_match_confidence(line, entry, line_amount, is_debit)

            if confidence > best_confidence:
                best_confidence = confidence
                best_match = {
                    'line': line,
                    'matched_entry': entry,
                    'confidence': confidence,
                    'match_reason': reason
                }

        return best_match

    def _calculate_match_confidence(
        self,
        line,
        entry,
        line_amount: Decimal,
        is_debit: bool
    ) -> Tuple[float, str]:
        """
        Calculate confidence score for matching a line to an entry.

        Returns:
            (confidence_score, reason)
        """
        # Check amount matches (entry debit/credit should match line type)
        entry_amount = entry.debit if is_debit else entry.credit
        amount_diff = abs(line_amount - entry_amount)

        if amount_diff > self.AMOUNT_TOLERANCE:
            return (0.0, "Amount mismatch")

        # Level 1: Exact match (amount + date + reference)
        if (amount_diff <= self.AMOUNT_TOLERANCE and
            line.transaction_date == entry.entry.transaction_date and
            line.reference and entry.entry.reference and
            self._normalize_reference(line.reference) == self._normalize_reference(entry.entry.reference)):
            return (self.CONFIDENCE_EXACT, f"Exact match: amount={line_amount}, date={line.transaction_date}, ref={line.reference}")

        # Level 2: High confidence (amount + date within 3 days)
        date_diff = abs((line.transaction_date - entry.entry.transaction_date).days)
        if amount_diff <= self.AMOUNT_TOLERANCE and date_diff <= self.DATE_TOLERANCE_DAYS:
            return (self.CONFIDENCE_HIGH, f"High confidence: amount={line_amount}, date within {date_diff} days")

        # Level 3: Medium confidence (amount + description keywords)
        if amount_diff <= self.AMOUNT_TOLERANCE:
            keyword_score = self._calculate_description_similarity(
                line.description,
                entry.entry.description or ''
            )
            if keyword_score > 0.5:
                return (self.CONFIDENCE_MEDIUM, f"Medium confidence: amount={line_amount}, description similarity={keyword_score:.0%}")

        # Level 4: Low confidence (amount only)
        if amount_diff <= self.AMOUNT_TOLERANCE:
            return (self.CONFIDENCE_LOW, f"Low confidence: amount match only={line_amount}")

        return (0.0, "No match")

    def _normalize_reference(self, ref: str) -> str:
        """Normalize reference string for comparison."""
        # Remove whitespace, convert to uppercase, keep only alphanumeric
        return re.sub(r'[^A-Z0-9]', '', ref.upper())

    def _calculate_description_similarity(self, desc1: str, desc2: str) -> float:
        """
        Calculate similarity between two descriptions using keyword matching.

        Returns:
            Similarity score 0.0-1.0
        """
        # Normalize descriptions
        desc1_clean = self._normalize_description(desc1)
        desc2_clean = self._normalize_description(desc2)

        # Extract keywords (words 3+ chars)
        keywords1 = set(word for word in desc1_clean.split() if len(word) >= 3)
        keywords2 = set(word for word in desc2_clean.split() if len(word) >= 3)

        if not keywords1 or not keywords2:
            return 0.0

        # Calculate Jaccard similarity
        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)

        return len(intersection) / len(union) if union else 0.0

    def _normalize_description(self, desc: str) -> str:
        """Normalize description for keyword extraction."""
        # Convert to lowercase
        desc = desc.lower()
        # Remove punctuation
        desc = re.sub(r'[^\w\s]', ' ', desc)
        # Remove extra whitespace
        desc = re.sub(r'\s+', ' ', desc).strip()
        return desc

    def _validate_manual_match(self, line, journal_entry_line) -> bool:
        """
        Validate a manual match is reasonable.

        Returns:
            True if valid
        """
        # Check amounts are close (within 1%)
        is_debit = line.debit_amount > 0
        line_amount = line.debit_amount if is_debit else line.credit_amount
        entry_amount = journal_entry_line.debit if is_debit else journal_entry_line.credit

        amount_diff_pct = abs(line_amount - entry_amount) / line_amount if line_amount > 0 else 0
        if amount_diff_pct > Decimal('0.01'):  # More than 1% difference
            return False

        # Check dates are reasonable (within 30 days)
        date_diff = abs((line.transaction_date - journal_entry_line.entry.transaction_date).days)
        if date_diff > 30:
            return False

        # Check account matches
        if journal_entry_line.account != self.account:
            return False

        return True

    def get_reconciliation_report(self) -> Dict:
        """
        Get reconciliation report for statement.

        Returns:
            Dict with reconciliation stats and variance
        """
        lines = self.statement.lines.all()

        matched_lines = lines.filter(is_matched=True)
        unmatched_lines = lines.filter(is_matched=False)

        # Calculate matched amounts
        matched_debit = sum(l.debit_amount for l in matched_lines)
        matched_credit = sum(l.credit_amount for l in matched_lines)

        # Calculate unmatched amounts
        unmatched_debit = sum(l.debit_amount for l in unmatched_lines)
        unmatched_credit = sum(l.credit_amount for l in unmatched_lines)

        # Calculate variance
        expected_closing = self.statement.opening_balance + self.statement.total_debits - self.statement.total_credits
        variance = self.statement.closing_balance - expected_closing

        return {
            'statement_date': self.statement.statement_date,
            'opening_balance': self.statement.opening_balance,
            'closing_balance': self.statement.closing_balance,
            'expected_closing': expected_closing,
            'variance': variance,
            'total_lines': self.statement.total_lines,
            'matched_count': self.statement.matched_count,
            'unmatched_count': self.statement.unmatched_count,
            'matched_debit': matched_debit,
            'matched_credit': matched_credit,
            'unmatched_debit': unmatched_debit,
            'unmatched_credit': unmatched_credit,
            'reconciliation_percentage': (
                (self.statement.matched_count / self.statement.total_lines * 100)
                if self.statement.total_lines > 0 else 0
            )
        }
