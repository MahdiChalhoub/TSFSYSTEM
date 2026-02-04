from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PlanCategory, SubscriptionPlan, SubscriptionPayment, Organization
from .serializers import (
    PlanCategorySerializer, SubscriptionPlanSerializer, SubscriptionPaymentSerializer
)
from .services_subscription import SubscriptionService
from .middleware import get_current_tenant_id

class PlanCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Publicly available plan categories.
    """
    queryset = PlanCategory.objects.all()
    serializer_class = PlanCategorySerializer
    permission_classes = [permissions.AllowAny]

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Publicly available plans.
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def subscribe(self, request, pk=None):
        """
        Subscribe the current organization to this plan.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        plan = self.get_object()
        
        # Payment Logic usually handled separately (Stripe/etc). 
        # For now, we simulate immediate activation or create a pending payment.
        
        # Checking if payment required...
        if plan.monthly_price > 0:
            # Create Payment (Mocking immediate success for MVP)
            payment = SubscriptionService.record_payment(
                organization=organization,
                plan=plan,
                amount=plan.monthly_price, # Default to monthly
                billing_cycle='MONTHLY'
            )
            
            # Immediately activate plan since record_payment sets status to COMPLETED
            SubscriptionService.activate_plan(organization, plan)
            
            return Response({
                "message": "Plan upgraded successfully",
                "payment_id": payment.id,
                "amount": payment.amount
            })
        else:
            # Free plan
            SubscriptionService.activate_plan(organization, plan)
            return Response({"message": "Plan activated successfully"})

class SubscriptionPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View payments for the current organization.
    """
    serializer_class = SubscriptionPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        organization_id = get_current_tenant_id()
        return SubscriptionPayment.objects.filter(organization_id=organization_id)
