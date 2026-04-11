"""
Bank Statement Import Service
==============================
Handles CSV/Excel import of bank statements and creates BankStatement + BankStatementLine records.

Supported Formats:
- Standard CSV (Date, Description, Debit, Credit, Balance)
- Excel (.xlsx, .xls)
- Common bank formats (auto-detection)

Usage:
    from apps.finance.services.bank_statement_import_service import BankStatementImportService

    service = BankStatementImportService(org, account, file)
    statement = service.import_statement(
        statement_date=date.today(),
        file_format='CSV'
    )
"""

import csv
import io
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
import openpyxl
import re


class BankStatementImportService:
    """Service for importing bank statements from files."""

    # Standard field mappings (case-insensitive)
    FIELD_MAPPINGS = {
        'date': ['date', 'transaction date', 'trans date', 'value date', 'posting date'],
        'description': ['description', 'details', 'particulars', 'narrative', 'memo'],
        'reference': ['reference', 'ref', 'check no', 'cheque no', 'transaction id'],
        'debit': ['debit', 'withdrawal', 'withdrawals', 'debit amount', 'dr'],
        'credit': ['credit', 'deposit', 'deposits', 'credit amount', 'cr'],
        'balance': ['balance', 'running balance', 'account balance', 'closing balance'],
    }

    def __init__(self, organization, account, uploaded_file):
        """
        Initialize import service.

        Args:
            organization: Organization instance
            account: FinancialAccount instance (bank account)
            uploaded_file: Django UploadedFile instance
        """
        self.organization = organization
        self.account = account
        self.uploaded_file = uploaded_file
        self.errors = []
        self.warnings = []

    def import_statement(
        self,
        statement_date: date,
        statement_number: Optional[str] = None,
        file_format: str = 'AUTO'
    ):
        """
        Import bank statement from file.

        Args:
            statement_date: Statement date
            statement_number: Optional statement number
            file_format: 'CSV', 'EXCEL', or 'AUTO' (auto-detect)

        Returns:
            BankStatement instance

        Raises:
            ValidationError: If file format invalid or data corrupt
        """
        from apps.finance.models.bank_reconciliation_models import BankStatement, BankStatementLine

        # Auto-detect format
        if file_format == 'AUTO':
            file_format = self._detect_format()

        # Parse file based on format
        if file_format == 'CSV':
            rows = self._parse_csv()
        elif file_format == 'EXCEL':
            rows = self._parse_excel()
        else:
            raise ValidationError(f"Unsupported file format: {file_format}")

        if not rows:
            raise ValidationError("No data rows found in file")

        # Detect column mappings
        header = rows[0]
        column_map = self._map_columns(header)
        data_rows = rows[1:]

        # Parse and validate rows
        parsed_lines = []
        for idx, row in enumerate(data_rows, start=2):  # Line 2+ (after header)
            try:
                line_data = self._parse_row(row, column_map, idx)
                if line_data:
                    parsed_lines.append(line_data)
            except Exception as e:
                self.errors.append(f"Line {idx}: {str(e)}")

        if not parsed_lines:
            raise ValidationError(f"No valid transactions found. Errors: {self.errors}")

        # Calculate opening/closing balances
        opening_balance, closing_balance = self._calculate_balances(parsed_lines)

        # Create statement and lines in transaction
        with transaction.atomic():
            statement = BankStatement.objects.create(
                organization=self.organization,
                account=self.account,
                statement_date=statement_date,
                statement_number=statement_number,
                opening_balance=opening_balance,
                closing_balance=closing_balance,
                file=self.uploaded_file,
                status='IMPORTED',
                total_lines=len(parsed_lines)
            )

            # Create statement lines
            for line_data in parsed_lines:
                BankStatementLine.objects.create(
                    organization=self.organization,
                    statement=statement,
                    **line_data
                )

            # Recalculate totals
            statement.calculate_totals()

        return statement

    def _detect_format(self) -> str:
        """Auto-detect file format from extension and content."""
        filename = self.uploaded_file.name.lower()

        if filename.endswith('.csv'):
            return 'CSV'
        elif filename.endswith(('.xlsx', '.xls')):
            return 'EXCEL'
        else:
            # Try to detect from content
            try:
                self.uploaded_file.seek(0)
                first_bytes = self.uploaded_file.read(512)
                self.uploaded_file.seek(0)

                # Excel files start with specific magic bytes
                if first_bytes.startswith(b'PK\x03\x04') or first_bytes.startswith(b'\xd0\xcf\x11\xe0'):
                    return 'EXCEL'
                else:
                    return 'CSV'
            except:
                return 'CSV'  # Default to CSV

    def _parse_csv(self) -> List[List[str]]:
        """Parse CSV file and return rows."""
        self.uploaded_file.seek(0)
        content = self.uploaded_file.read()

        # Try different encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValidationError("Unable to decode file. Please ensure it's a valid CSV file.")

        # Parse CSV
        reader = csv.reader(io.StringIO(decoded))
        return list(reader)

    def _parse_excel(self) -> List[List[str]]:
        """Parse Excel file and return rows."""
        self.uploaded_file.seek(0)

        try:
            workbook = openpyxl.load_workbook(self.uploaded_file, data_only=True)
            sheet = workbook.active

            rows = []
            for row in sheet.iter_rows(values_only=True):
                # Convert to strings, skip empty rows
                str_row = [str(cell) if cell is not None else '' for cell in row]
                if any(str_row):  # Skip completely empty rows
                    rows.append(str_row)

            return rows
        except Exception as e:
            raise ValidationError(f"Error parsing Excel file: {str(e)}")

    def _map_columns(self, header: List[str]) -> Dict[str, int]:
        """
        Map CSV/Excel columns to standard fields.

        Returns:
            Dict mapping field names to column indexes
        """
        header_lower = [col.strip().lower() for col in header]
        column_map = {}

        for field, possible_names in self.FIELD_MAPPINGS.items():
            for idx, col_name in enumerate(header_lower):
                if col_name in possible_names:
                    column_map[field] = idx
                    break

        # Validate required fields
        required = ['date', 'description']
        missing = [f for f in required if f not in column_map]
        if missing:
            raise ValidationError(
                f"Required columns not found: {missing}. "
                f"Header: {header}. "
                f"Please ensure CSV has Date and Description columns."
            )

        # Must have either debit/credit OR balance
        if 'debit' not in column_map and 'credit' not in column_map and 'balance' not in column_map:
            raise ValidationError(
                "File must have either Debit/Credit columns or Balance column"
            )

        return column_map

    def _parse_row(self, row: List[str], column_map: Dict[str, int], line_number: int) -> Optional[Dict]:
        """
        Parse a single row into BankStatementLine data.

        Returns:
            Dict with line data or None if row should be skipped
        """
        # Skip empty rows
        if not any(row):
            return None

        try:
            # Parse date
            date_str = row[column_map['date']].strip()
            transaction_date = self._parse_date(date_str)
            if not transaction_date:
                self.warnings.append(f"Line {line_number}: Could not parse date '{date_str}', skipping")
                return None

            # Parse description
            description = row[column_map['description']].strip()
            if not description:
                description = f"Transaction on {transaction_date}"

            # Parse reference (optional)
            reference = ''
            if 'reference' in column_map:
                reference = row[column_map['reference']].strip()

            # Parse amounts
            debit_amount = Decimal('0.00')
            credit_amount = Decimal('0.00')
            balance = Decimal('0.00')

            if 'debit' in column_map:
                debit_str = row[column_map['debit']].strip()
                debit_amount = self._parse_amount(debit_str)

            if 'credit' in column_map:
                credit_str = row[column_map['credit']].strip()
                credit_amount = self._parse_amount(credit_str)

            if 'balance' in column_map:
                balance_str = row[column_map['balance']].strip()
                balance = self._parse_amount(balance_str)

            return {
                'line_number': line_number - 1,  # Adjust for 0-based
                'transaction_date': transaction_date,
                'description': description[:500],  # Truncate to field max
                'reference': reference[:100],
                'debit_amount': debit_amount,
                'credit_amount': credit_amount,
                'balance': balance,
            }

        except Exception as e:
            raise ValidationError(f"Error parsing row: {str(e)}")

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date string using common formats."""
        if not date_str or date_str.lower() in ('none', 'null', ''):
            return None

        # Common date formats
        formats = [
            '%Y-%m-%d',      # 2024-03-12
            '%d/%m/%Y',      # 12/03/2024
            '%m/%d/%Y',      # 03/12/2024
            '%d-%m-%Y',      # 12-03-2024
            '%Y/%m/%d',      # 2024/03/12
            '%d %b %Y',      # 12 Mar 2024
            '%d %B %Y',      # 12 March 2024
            '%b %d, %Y',     # Mar 12, 2024
            '%B %d, %Y',     # March 12, 2024
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        # Try Excel date number (days since 1900-01-01)
        try:
            excel_date = float(date_str)
            if excel_date > 0:
                # Excel epoch: 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
                base_date = datetime(1899, 12, 30)
                return (base_date + timezone.timedelta(days=excel_date)).date()
        except (ValueError, OverflowError):
            pass

        return None

    def _parse_amount(self, amount_str: str) -> Decimal:
        """Parse amount string, handling various formats."""
        if not amount_str or amount_str.lower() in ('none', 'null', ''):
            return Decimal('0.00')

        # Remove common formatting
        cleaned = amount_str.strip()
        cleaned = cleaned.replace(',', '')  # Remove thousand separators
        cleaned = cleaned.replace('$', '')
        cleaned = cleaned.replace('€', '')
        cleaned = cleaned.replace('£', '')
        cleaned = cleaned.replace(' ', '')

        # Handle parentheses as negative (accounting format)
        is_negative = False
        if cleaned.startswith('(') and cleaned.endswith(')'):
            is_negative = True
            cleaned = cleaned[1:-1]

        try:
            amount = Decimal(cleaned)
            if is_negative:
                amount = -amount
            return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            raise ValidationError(f"Invalid amount format: '{amount_str}'")

    def _calculate_balances(self, parsed_lines: List[Dict]) -> Tuple[Decimal, Decimal]:
        """
        Calculate opening and closing balances.

        If balance column exists, use first/last values.
        Otherwise, calculate from debits/credits.
        """
        if not parsed_lines:
            return Decimal('0.00'), Decimal('0.00')

        # Check if balance column populated
        has_balances = any(line['balance'] != Decimal('0.00') for line in parsed_lines)

        if has_balances:
            # Use first and last balance values
            opening_balance = parsed_lines[0]['balance']
            closing_balance = parsed_lines[-1]['balance']
        else:
            # Calculate from debits/credits
            # Assume opening balance is 0 if not provided
            opening_balance = Decimal('0.00')

            running_balance = opening_balance
            for line in parsed_lines:
                running_balance += line['debit_amount'] - line['credit_amount']
                line['balance'] = running_balance  # Fill in calculated balance

            closing_balance = running_balance

        return opening_balance, closing_balance

    def get_errors(self) -> List[str]:
        """Get list of errors encountered during import."""
        return self.errors

    def get_warnings(self) -> List[str]:
        """Get list of warnings encountered during import."""
        return self.warnings
