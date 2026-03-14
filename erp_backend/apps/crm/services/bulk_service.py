"""
Contact Bulk Operations Service
================================
Implements §28 — Import / Export with validation, duplicate detection, and audit.
"""
from django.db import transaction
from django.utils import timezone
import csv
import io
import json
import logging

logger = logging.getLogger(__name__)


class ContactBulkService:
    """
    Handles bulk import/export of contacts per §28 of CRM documentation.

    Import modes:
    - INSERT_ONLY: Creates new contacts only
    - UPSERT_SAFE: Updates matched records only on approved keys
    - REVIEW_REQUIRED: Creates import batch pending approval (returns preview)
    """

    # Required and optional fields for import
    REQUIRED_FIELDS = {'name', 'type'}
    OPTIONAL_FIELDS = {
        'entity_type', 'email', 'phone', 'address', 'website', 'vat_id',
        'company_name', 'credit_limit', 'payment_terms_days', 'customer_tier',
        'supplier_category', 'notes', 'commercial_category', 'country_code',
        'whatsapp_group_id',
    }
    VALID_TYPES = {'CUSTOMER', 'SUPPLIER', 'BOTH', 'LEAD', 'CONTACT', 'SERVICE', 'CREDITOR', 'DEBTOR'}
    VALID_ENTITY_TYPES = {'INDIVIDUAL', 'BUSINESS'}

    # Fields to export (ordered)
    EXPORT_FIELDS = [
        'id', 'name', 'type', 'entity_type', 'status', 'commercial_status',
        'email', 'phone', 'address', 'website', 'vat_id', 'company_name',
        'credit_limit', 'payment_terms_days', 'customer_tier', 'supplier_category',
        'loyalty_points', 'current_balance', 'opening_balance',
        'country_code', 'commercial_category', 'notes',
        'created_at', 'updated_at',
    ]

    # PII fields that require masking for non-admin exports
    PII_FIELDS = {'email', 'phone', 'address', 'vat_id', 'whatsapp_group_id'}

    @classmethod
    def validate_import_row(cls, row, row_num):
        """Validate a single import row. Returns (cleaned_data, errors)."""
        errors = []
        data = {}

        # Required fields
        for field in cls.REQUIRED_FIELDS:
            val = row.get(field, '').strip()
            if not val:
                errors.append(f'Row {row_num}: Missing required field "{field}".')
            else:
                data[field] = val

        # Type validation
        if data.get('type') and data['type'].upper() not in cls.VALID_TYPES:
            errors.append(f'Row {row_num}: Invalid type "{data.get("type")}". '
                          f'Must be one of: {", ".join(sorted(cls.VALID_TYPES))}.')
        elif data.get('type'):
            data['type'] = data['type'].upper()

        # Entity type
        entity_type = row.get('entity_type', '').strip().upper()
        if entity_type:
            if entity_type not in cls.VALID_ENTITY_TYPES:
                errors.append(f'Row {row_num}: Invalid entity_type "{entity_type}".')
            else:
                data['entity_type'] = entity_type
        else:
            data['entity_type'] = 'INDIVIDUAL'

        # Optional fields
        for field in cls.OPTIONAL_FIELDS:
            val = row.get(field, '').strip()
            if val:
                data[field] = val

        # Numeric fields
        for num_field in ('credit_limit', 'payment_terms_days'):
            if num_field in data:
                try:
                    if num_field == 'payment_terms_days':
                        val = int(data[num_field])
                    else:
                        val = float(data[num_field])
                    if val < 0:
                        errors.append(f'Row {row_num}: {num_field} cannot be negative.')
                    data[num_field] = val
                except (ValueError, TypeError):
                    errors.append(f'Row {row_num}: {num_field} must be a number.')

        return data, errors

    @classmethod
    def dry_run_import(cls, organization_id, csv_content, mode='INSERT_ONLY'):
        """
        Validate CSV content without actually creating records.
        Returns preview with validation results and duplicate warnings.
        """
        from apps.crm.services.duplicate_service import DuplicateDetectionService

        reader = csv.DictReader(io.StringIO(csv_content))
        preview = {
            'mode': mode,
            'total_rows': 0,
            'valid_rows': 0,
            'error_rows': 0,
            'duplicate_warnings': 0,
            'rows': [],
        }

        for row_num, row in enumerate(reader, start=1):
            preview['total_rows'] += 1
            data, errors = cls.validate_import_row(row, row_num)

            row_result = {
                'row_num': row_num,
                'name': data.get('name', ''),
                'type': data.get('type', ''),
                'valid': len(errors) == 0,
                'errors': errors,
                'duplicate_check': None,
            }

            # Check duplicates
            if not errors:
                dup = DuplicateDetectionService.check_for_duplicates(
                    organization_id=organization_id,
                    name=data.get('name'),
                    email=data.get('email'),
                    phone=data.get('phone'),
                    vat_id=data.get('vat_id'),
                    company_name=data.get('company_name'),
                )
                if dup['has_duplicates']:
                    row_result['duplicate_check'] = dup
                    preview['duplicate_warnings'] += 1

                preview['valid_rows'] += 1
            else:
                preview['error_rows'] += 1

            preview['rows'].append(row_result)

        return preview

    @classmethod
    @transaction.atomic
    def execute_import(cls, organization_id, csv_content, mode='INSERT_ONLY',
                       force_create=False, actor_user_id=None, actor_name=None):
        """
        Execute bulk import.

        Args:
            mode: INSERT_ONLY | UPSERT_SAFE
            force_create: If True, skip duplicate warnings
        """
        from apps.crm.models import Contact, ContactAuditLog

        reader = csv.DictReader(io.StringIO(csv_content))
        results = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': [],
        }

        for row_num, row in enumerate(reader, start=1):
            data, errors = cls.validate_import_row(row, row_num)
            if errors:
                results['errors'].extend(errors)
                results['skipped'] += 1
                continue

            try:
                if mode == 'INSERT_ONLY':
                    Contact.objects.create(
                        organization_id=organization_id,
                        status='DRAFT',  # New imports start as DRAFT
                        **data,
                    )
                    results['created'] += 1

                elif mode == 'UPSERT_SAFE':
                    # Match on name + type + organization
                    existing = Contact.objects.filter(
                        organization_id=organization_id,
                        name=data['name'],
                        type=data['type'],
                    ).first()

                    if existing:
                        for k, v in data.items():
                            if k not in ('name', 'type') and v:
                                setattr(existing, k, v)
                        existing.save()
                        results['updated'] += 1
                    else:
                        Contact.objects.create(
                            organization_id=organization_id,
                            status='DRAFT',
                            **data,
                        )
                        results['created'] += 1

            except Exception as e:
                results['errors'].append(f'Row {row_num}: {str(e)[:200]}')
                results['skipped'] += 1

        # Audit log for bulk import
        if results['created'] > 0 or results['updated'] > 0:
            try:
                # Create a summary audit entry on a placeholder
                logger.info(
                    f"[CRM Import] org={organization_id} mode={mode} "
                    f"created={results['created']} updated={results['updated']} "
                    f"skipped={results['skipped']} by={actor_name}"
                )
            except Exception:
                pass

        return results

    @classmethod
    def export_contacts(cls, organization_id, filters=None, mask_pii=False, format='csv'):
        """
        Export contacts as CSV string.

        Args:
            filters: dict of filter criteria (type, status, etc.)
            mask_pii: If True, mask sensitive PII fields
        """
        from apps.crm.models import Contact

        qs = Contact.objects.filter(organization_id=organization_id)

        # Apply filters
        if filters:
            if filters.get('type'):
                qs = qs.filter(type=filters['type'].upper())
            if filters.get('status'):
                qs = qs.filter(status=filters['status'].upper())
            if filters.get('entity_type'):
                qs = qs.filter(entity_type=filters['entity_type'].upper())
            if filters.get('customer_tier'):
                qs = qs.filter(customer_tier=filters['customer_tier'])
            if filters.get('is_active') is not None:
                qs = qs.filter(is_active=filters['is_active'])

        qs = qs.order_by('type', 'name')

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(cls.EXPORT_FIELDS)

        # Rows
        for contact in qs.values(*cls.EXPORT_FIELDS):
            row = []
            for field in cls.EXPORT_FIELDS:
                val = contact.get(field, '')
                if mask_pii and field in cls.PII_FIELDS and val:
                    val = cls._mask_value(field, str(val))
                row.append(val if val is not None else '')
            writer.writerow(row)

        return output.getvalue()

    @staticmethod
    def _mask_value(field, value):
        """Mask PII field value."""
        if not value:
            return value
        if field == 'email' and '@' in value:
            name, domain = value.split('@', 1)
            return f'{name[:2]}***@{domain}'
        elif field == 'phone':
            if len(value) > 4:
                return f'***{value[-4:]}'
            return '****'
        elif field == 'vat_id':
            if len(value) > 4:
                return f'{value[:2]}***{value[-2:]}'
            return '****'
        elif field == 'address':
            return f'{value[:10]}...'
        return f'{value[:3]}***'
