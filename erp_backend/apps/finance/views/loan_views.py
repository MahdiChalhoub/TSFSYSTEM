"""
Enhanced Loan Management Views
===============================
Additional actions for loan management, amortization, and payment tracking.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from kernel.performance import profile_view
from apps.finance.models import Loan, LoanInstallment, FinancialAccount
from apps.finance.services.loan_service import LoanService
from apps.finance.serializers.loan_serializers import (
    AmortizationScheduleSerializer,
    EarlyPayoffSerializer,
    LoanPaymentSerializer,
)


class LoanManagementMixin:
    """
    Mixin to add enhanced loan management actions to LoanViewSet.

    Add this to existing LoanViewSet like:
        class LoanViewSet(LoanManagementMixin, TenantModelViewSet):
            ...
    """

    @action(detail=True, methods=['get'])
    @profile_view
    def schedule(self, request, pk=None):
        """
        Get amortization schedule for loan.

        GET /api/finance/loans/{id}/schedule/

        Returns:
            List of installments with principal, interest, balance
        """
        loan = self.get_object()

        # If installments already exist, return them
        if loan.installments.exists():
            installments = loan.installments.all().order_by('installment_number', 'due_date')
            schedule = [
                {
                    'installment_number': inst.installment_number or idx,
                    'due_date': inst.due_date,
                    'principal': inst.principal_amount,
                    'interest': inst.interest_amount,
                    'total': inst.total_amount,
                    'balance_after': inst.balance_after if hasattr(inst, 'balance_after') else None,
                    'paid_amount': inst.paid_amount,
                    'is_paid': inst.is_paid,
                }
                for idx, inst in enumerate(installments, 1)
            ]
        else:
            # Generate schedule
            schedule = LoanService.generate_enhanced_schedule(loan)

        serializer = AmortizationScheduleSerializer(schedule, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def regenerate_schedule(self, request, pk=None):
        """
        Regenerate amortization schedule.

        POST /api/finance/loans/{id}/regenerate-schedule/

        Warning: This deletes existing installments!
        """
        loan = self.get_object()

        if loan.status not in ['DRAFT', 'SCHEDULED']:
            return Response({
                'error': 'Cannot regenerate schedule for active or closed loans'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Delete existing installments
        loan.installments.all().delete()

        # Generate new schedule
        schedule = LoanService.generate_enhanced_schedule(loan)

        # Create installment records
        from apps.finance.models import LoanInstallment

        with transaction.atomic():
            for item in schedule:
                LoanInstallment.objects.create(
                    organization=loan.organization,
                    loan=loan,
                    installment_number=item['installment_number'],
                    due_date=item['due_date'],
                    principal_amount=item['principal'],
                    interest_amount=item['interest'],
                    total_amount=item['total'],
                    balance_after=item.get('balance_after', 0),
                    status='PENDING'
                )

            loan.status = 'SCHEDULED'
            loan.save(update_fields=['status'])

        return Response({
            'message': 'Schedule regenerated successfully',
            'installments_created': len(schedule)
        })

    @action(detail=True, methods=['post'], serializer_class=LoanPaymentSerializer)
    def record_payment(self, request, pk=None):
        """
        Record a loan payment.

        POST /api/finance/loans/{id}/record-payment/
        {
            "amount": "1500.00",
            "payment_account_id": 123,
            "reference": "CHQ12345",
            "scope": "OFFICIAL"
        }

        Returns:
            Payment allocation details
        """
        loan = self.get_object()

        if loan.status != 'ACTIVE':
            return Response({
                'error': 'Loan must be ACTIVE to record payments'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = LoanPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        payment_account_id = serializer.validated_data['payment_account_id']
        reference = serializer.validated_data.get('reference', '')
        scope = serializer.validated_data.get('scope', 'OFFICIAL')

        # Get payment account
        try:
            payment_account = FinancialAccount.objects.get(
                id=payment_account_id,
                organization=loan.organization
            )
        except FinancialAccount.DoesNotExist:
            return Response({
                'error': 'Payment account not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Record payment using existing service
        try:
            result = LoanService.process_repayment(
                organization=loan.organization,
                loan_id=loan.id,
                amount=amount,
                account_id=payment_account.id,
                reference=reference,
                user=request.user,
                scope=scope
            )

            return Response({
                'message': 'Payment recorded successfully',
                'event_id': result.id,
                'loan_status': loan.status,
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def early_payoff(self, request, pk=None):
        """
        Calculate early payoff amount.

        GET /api/finance/loans/{id}/early-payoff/

        Returns:
            Early payoff details (total amount, principal, interest)
        """
        loan = self.get_object()

        payoff_data = LoanService.calculate_early_payoff(loan)

        serializer = EarlyPayoffSerializer(payoff_data)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """
        Get comprehensive loan summary.

        GET /api/finance/loans/{id}/summary/

        Returns:
            Loan summary with payment status, next due, etc.
        """
        loan = self.get_object()

        summary = LoanService.get_loan_summary(loan)

        return Response(summary)

    @action(detail=False, methods=['get'])
    @profile_view
    def overdue(self, request):
        """
        Get loans with overdue installments.

        GET /api/finance/loans/overdue/

        Returns:
            List of loans with overdue payments
        """
        from datetime import date

        # Get loans with overdue installments
        overdue_loans = Loan.objects.filter(
            organization=request.organization,
            status='ACTIVE',
            installments__is_paid=False,
            installments__due_date__lt=date.today()
        ).distinct().select_related('contact')

        overdue_data = []
        for loan in overdue_loans:
            overdue_installments = loan.installments.filter(
                is_paid=False,
                due_date__lt=date.today()
            ).order_by('due_date')

            if overdue_installments.exists():
                first_overdue = overdue_installments.first()
                days_overdue = (date.today() - first_overdue.due_date).days

                total_overdue = sum(
                    inst.total_amount - inst.paid_amount
                    for inst in overdue_installments
                )

                overdue_data.append({
                    'loan_id': loan.id,
                    'contract_number': loan.contract_number,
                    'contact_name': loan.contact.display_name,
                    'principal_amount': loan.principal_amount,
                    'overdue_installments_count': overdue_installments.count(),
                    'total_overdue_amount': total_overdue,
                    'first_overdue_date': first_overdue.due_date,
                    'days_overdue': days_overdue,
                })

        return Response(overdue_data)

    @action(detail=False, methods=['get'])
    @profile_view
    def upcoming_payments(self, request):
        """
        Get upcoming loan payments (next 30 days).

        GET /api/finance/loans/upcoming-payments/?days=30

        Returns:
            List of upcoming installments
        """
        from datetime import date, timedelta

        days = int(request.query_params.get('days', 30))
        end_date = date.today() + timedelta(days=days)

        upcoming_installments = LoanInstallment.objects.filter(
            organization=request.organization,
            is_paid=False,
            due_date__gte=date.today(),
            due_date__lte=end_date
        ).select_related('loan', 'loan__contact').order_by('due_date')

        upcoming_data = [
            {
                'loan_id': inst.loan.id,
                'contract_number': inst.loan.contract_number,
                'contact_name': inst.loan.contact.display_name,
                'installment_number': inst.installment_number,
                'due_date': inst.due_date,
                'amount': inst.total_amount - inst.paid_amount,
                'days_until_due': (inst.due_date - date.today()).days,
            }
            for inst in upcoming_installments
        ]

        return Response(upcoming_data)
