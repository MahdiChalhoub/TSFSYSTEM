import math
import uuid
import datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from dateutil.relativedelta import relativedelta

from .base_services import SequenceService
from .ledger_service import FinancialEventService
from .audit_service import ForensicAuditService

class LoanService:
    @staticmethod
    def calculate_schedule(principal, interest_rate, interest_type, term_months, start_date, frequency):
        """
        Pure logic calculation, returns list of dicts.
        interest_rate is Annual %.
        """
        principal = Decimal(str(principal))
        rate = Decimal(str(interest_rate))
        
        if frequency == 'MONTHLY': num_installments = term_months
        elif frequency == 'QUARTERLY': num_installments = math.ceil(term_months / 3)
        elif frequency == 'YEARLY': num_installments = math.ceil(term_months / 12)
        else: num_installments = term_months
        
        if num_installments <= 0: return []
        
        total_interest = Decimal('0')
        if interest_type == 'SIMPLE':
            years = Decimal(term_months) / Decimal('12')
            total_interest = principal * (rate / Decimal('100')) * years
        
        base_principal = principal / Decimal(num_installments)
        base_interest = total_interest / Decimal(num_installments)
        
        installments = []
        remaining_principal = principal
        remaining_interest = total_interest
        
        current_date_obj = start_date if isinstance(start_date, datetime.date) else datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        
        for i in range(1, num_installments + 1):
            if frequency == 'MONTHLY':
                next_date = current_date_obj + relativedelta(months=i)
            elif frequency == 'QUARTERLY':
                next_date = current_date_obj + relativedelta(months=i*3)
            elif frequency == 'YEARLY':
                next_date = current_date_obj + relativedelta(years=i)
            else:
                next_date = current_date_obj + relativedelta(months=i)

            is_last = (i == num_installments)
            
            line_principal = remaining_principal if is_last else base_principal.quantize(Decimal('0.01'))
            line_interest = remaining_interest if is_last else base_interest.quantize(Decimal('0.01'))
            line_total = line_principal + line_interest
            
            installments.append({
                "due_date": next_date,
                "principal": line_principal,
                "interest": line_interest,
                "total": line_total
            })
            
            if not is_last:
                remaining_principal -= line_principal
                remaining_interest -= line_interest
                
        return installments

    @staticmethod
    def create_contract(organization, data, scope='OFFICIAL'):
        from apps.finance.models import Loan, LoanInstallment
        from apps.crm.models import Contact
        """
        Creates a Loan and its Installments in DRAFT status.
        """
        with transaction.atomic():
            contract_number = SequenceService.get_next_number(organization, f'LOAN_{scope.upper()}')
            
            contact = Contact.objects.get(id=data['contact_id'], organization=organization)
            
            loan = Loan.objects.create(
                organization=organization,
                contract_number=contract_number,
                contact=contact,
                principal_amount=data['principal_amount'],
                interest_rate=data['interest_rate'],
                interest_type=data.get('interest_type', 'SIMPLE'),
                term_months=data['term_months'],
                start_date=data['start_date'],
                payment_frequency=data.get('payment_frequency', 'MONTHLY'),
                status='DRAFT',
                scope=scope
            )
            
            schedule = LoanService.calculate_schedule(
                loan.principal_amount,
                loan.interest_rate,
                loan.interest_type,
                loan.term_months,
                loan.start_date,
                loan.payment_frequency
            )
            
            for item in schedule:
                LoanInstallment.objects.create(
                    organization=organization,
                    loan=loan,
                    due_date=item['due_date'],
                    principal_amount=item['principal'],
                    interest_amount=item['interest'],
                    total_amount=item['total'],
                    status='PENDING'
                )
            
            return loan

    @staticmethod
    def disburse_loan(organization, loan_id, transaction_ref=None, account_id=None, user=None):
        from apps.finance.models import Loan
        with transaction.atomic():
            loan = Loan.objects.get(id=loan_id, organization=organization)
            if loan.status != 'DRAFT':
                raise ValidationError("Loan is not in DRAFT status")
            
            FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_DISBURSEMENT',
                amount=loan.principal_amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=transaction_ref or f"DISB-{loan.contract_number}",
                loan_id=loan.id,
                account_id=account_id,
                user=user,
                scope=loan.scope
            )
            
            loan.status = 'ACTIVE'
            loan.save()
            return loan

    @staticmethod
    def process_repayment(organization, loan_id, amount, account_id, reference=None, user=None, scope='OFFICIAL'):
        from apps.finance.models import Loan, LoanInstallment
        with transaction.atomic():
            # Professional Audit: Lock the loan record to prevent concurrent repayment race conditions
            loan = Loan.objects.select_for_update().get(id=loan_id, organization=organization)
            if loan.status != 'ACTIVE':
                raise ValidationError("Loan must be ACTIVE to receive repayment")
            
            remaining = Decimal(str(amount))
            
            installments = LoanInstallment.objects.filter(
                organization=organization, 
                loan=loan, 
                status__in=['PENDING', 'PARTIAL']
            ).order_by('due_date', 'id')
            
            if not installments.exists():
                raise ValidationError("No pending installments found")

            repayment_details = []
            for inst in installments:
                if remaining <= 0:
                    break
                
                # Calculate how much we can pay on this installment
                inst_total = inst.total_amount
                inst_paid = inst.paid_amount
                inst_remaining = inst_total - inst_paid
                
                if remaining >= inst_remaining:
                    # Fully pay this installment
                    payment_on_this = inst_remaining
                    inst.paid_amount = inst_total
                    inst.status = 'PAID'
                    inst.is_paid = True
                    inst.paid_at = timezone.now()
                else:
                    # Partially pay this installment
                    payment_on_this = remaining
                    inst.paid_amount += remaining
                    inst.status = 'PARTIAL'
                
                inst.save()
                remaining -= payment_on_this
                repayment_details.append({"installment_id": inst.id, "amount": str(payment_on_this)})
                
            event = FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_REPAYMENT',
                amount=amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=reference or f"REPAY-{loan.contract_number}-{uuid.uuid4().hex[:4]}",
                loan_id=loan.id,
                account_id=account_id,
                user=user,
                scope=scope
            )
            
            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="LoanRepayment",
                object_id=loan.id,
                change_type="UPDATE",
                payload={"amount": str(amount), "event_id": event.id, "details": repayment_details}
            )
            
            return event
