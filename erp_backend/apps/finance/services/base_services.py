import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from .audit_service import ForensicAuditService

logger = logging.getLogger(__name__)

class FinancialAccountService:
    @staticmethod
    def create_account(organization, name, type, currency, site_id=None, parent_coa_id=None):
        from apps.finance.models import ChartOfAccount, FinancialAccount
        if parent_coa_id:
            parent = ChartOfAccount.objects.get(id=parent_coa_id, organization=organization)
        else:
            parent = ChartOfAccount.objects.filter(organization=organization, sub_type=type).first()
            if not parent: raise ValidationError(f"No parent for {type}")
        with transaction.atomic():
            last = ChartOfAccount.objects.filter(organization=organization, code__startswith=f"{parent.code}.").order_by('-code').first()
            suffix = (int(last.code.split('.')[-1]) + 1) if last else 1
            code = f"{parent.code}.{str(suffix).zfill(3)}"
            acc = ChartOfAccount.objects.create(organization=organization, code=code, name=name, type=parent.type, parent=parent, is_system_only=True, is_active=True, balance=Decimal('0.00'))
            account = FinancialAccount.objects.create(
                organization=organization, name=name, type=type, currency=currency,
                site_id=site_id, linked_coa=acc
            )
            
            ForensicAuditService.log_mutation(
                organization=organization,
                user=None, 
                model_name="FinancialAccount",
                object_id=account.id,
                change_type="CREATE",
                payload={"name": name, "type": type, "coa_code": code}
            )
            return account


class SequenceService:
    @staticmethod
    def get_next_number(organization, type):
        from apps.finance.models import TransactionSequence
        with transaction.atomic():
            # Determine intelligent prefix based on key
            prefix = type[:3].upper() + '-'
            if 'OFFICIAL' in type:
                prefix = 'OFF' + type[:2].upper() + '-'
            elif 'INTERNAL' in type:
                prefix = 'INT' + type[:2].upper() + '-'

            seq, created = TransactionSequence.objects.get_or_create(
                organization=organization, 
                type=type,
                defaults={'prefix': prefix, 'padding': 5}
            )
            seq = TransactionSequence.objects.select_for_update().get(id=seq.id)
            
            number_string = str(seq.next_number).zfill(seq.padding)
            formatted = f"{seq.prefix or ''}{number_string}{seq.suffix or ''}"
            
            seq.next_number += 1
            seq.save()
            
            return formatted


class BarcodeService:
    @staticmethod
    def calculate_ean13_check_digit(digits):
        sum_odd = 0
        sum_even = 0
        for i, char in enumerate(digits):
            num = int(char)
            if i % 2 == 0:
                sum_odd += num * 1
            else:
                sum_even += num * 3
        
        total = sum_odd + sum_even
        remainder = total % 10
        return (10 - remainder) % 10

    @staticmethod
    def generate_barcode(organization):
        from apps.finance.models import BarcodeSettings
        try:
            from apps.inventory.models import Product
        except ImportError:
            raise ValidationError("Inventory module is required for barcode generation.")
        with transaction.atomic():
            settings, created = BarcodeSettings.objects.get_or_create(
                organization=organization,
                defaults={'prefix': '200', 'next_sequence': 1000}
            )
            if not settings.is_enabled:
                raise ValidationError("Barcode generation is disabled")
            
            current_seq = settings.next_sequence
            prefix = settings.prefix
            seq_str = str(current_seq).zfill(12 - len(prefix))
            raw_code = f"{prefix}{seq_str}"
            
            check_digit = BarcodeService.calculate_ean13_check_digit(raw_code)
            final_barcode = f"{raw_code}{check_digit}"
            
            settings.next_sequence += 1
            settings.save()
            
            if Product.objects.filter(organization=organization, barcode=final_barcode).exists():
                return BarcodeService.generate_barcode(organization)
                
            return final_barcode
