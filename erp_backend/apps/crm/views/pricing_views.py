"""
CRM Pricing Views — Price Groups and Client Price Rules
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.middleware import get_current_tenant_id

from apps.crm.models import PriceGroup, PriceGroupMember, ClientPriceRule
from apps.crm.serializers import (
    PriceGroupSerializer, PriceGroupMemberSerializer, ClientPriceRuleSerializer
)


class PriceGroupViewSet(TenantModelViewSet):
    queryset = PriceGroup.objects.all()
    serializer_class = PriceGroupSerializer

    @action(detail=True, methods=['get', 'post', 'delete'], url_path='members')
    def members(self, request, pk=None):
        """Manage members of a price group."""
        price_group = self.get_object()
        organization_id = get_current_tenant_id()

        if request.method == 'GET':
            members = PriceGroupMember.objects.filter(
                price_group=price_group,
                organization_id=organization_id
            )
            serializer = PriceGroupMemberSerializer(members, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            contact_id = request.data.get('contact_id')
            if not contact_id:
                return Response({"error": "contact_id required"}, status=400)

            # Cross-tenant guard: ensure contact belongs to this org
            from apps.crm.models import Contact
            if not Contact.objects.filter(id=contact_id, organization_id=organization_id).exists():
                return Response({"error": "Contact not found or access denied."}, status=403)

            member, created = PriceGroupMember.objects.get_or_create(
                price_group=price_group,
                contact_id=contact_id,
                organization_id=organization_id
            )
            if not created:
                return Response({"message": "Contact already in this group"}, status=200)

            return Response(
                PriceGroupMemberSerializer(member).data,
                status=status.HTTP_201_CREATED
            )

        elif request.method == 'DELETE':
            contact_id = request.data.get('contact_id')
            if not contact_id:
                return Response({"error": "contact_id required"}, status=400)
            deleted, _ = PriceGroupMember.objects.filter(
                price_group=price_group,
                contact_id=contact_id,
                organization_id=organization_id
            ).delete()
            return Response({"deleted": deleted > 0})

    @action(detail=True, methods=['get'], url_path='rules')
    def rules(self, request, pk=None):
        """Get all price rules for this group."""
        price_group = self.get_object()
        rules = ClientPriceRule.objects.filter(
            price_group=price_group,
            organization_id=get_current_tenant_id()
        )
        return Response(ClientPriceRuleSerializer(rules, many=True).data)


class ClientPriceRuleViewSet(TenantModelViewSet):
    queryset = ClientPriceRule.objects.all()
    serializer_class = ClientPriceRuleSerializer

    def _validate_fk_ownership(self, data, org_id):
        """Validate that contact_id, product_id, and price_group belong to this org."""
        from rest_framework.exceptions import ValidationError
        from apps.crm.models import Contact
        contact_id = data.get('contact_id')
        if contact_id and not Contact.objects.filter(id=contact_id, organization_id=org_id).exists():
            raise ValidationError("Cross-tenant contact assignment blocked.")
        product_id = data.get('product_id')
        if product_id:
            from erp.connector_registry import connector
            Product = connector.require('inventory.products.get_model', org_id=org_id, source='crm.pricing')
            if Product and not Product.objects.filter(id=product_id, organization_id=org_id).exists():
                raise ValidationError("Cross-tenant product assignment blocked.")
        price_group = data.get('price_group')
        if price_group and hasattr(price_group, 'organization_id') and price_group.organization_id != org_id:
            raise ValidationError("Cross-tenant price group assignment blocked.")

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_fk_ownership(serializer.validated_data, org_id)
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        org_id = get_current_tenant_id()
        self._validate_fk_ownership(serializer.validated_data, org_id)
        serializer.save()

    @action(detail=False, methods=['get'], url_path='for-contact/(?P<contact_id>[0-9]+)')
    def for_contact(self, request, contact_id=None):
        """Get all price rules applicable to a specific contact (direct + via groups)."""
        organization_id = get_current_tenant_id()

        # Direct rules for this contact
        direct_rules = ClientPriceRule.objects.filter(
            contact_id=contact_id,
            organization_id=organization_id,
            is_active=True
        )

        # Group-based rules
        group_ids = PriceGroupMember.objects.filter(
            contact_id=contact_id,
            organization_id=organization_id
        ).values_list('price_group_id', flat=True)

        group_rules = ClientPriceRule.objects.filter(
            price_group_id__in=group_ids,
            organization_id=organization_id,
            is_active=True
        )

        # Combine and sort by priority
        from itertools import chain
        all_rules = list(chain(direct_rules, group_rules))
        serializer = ClientPriceRuleSerializer(all_rules, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='for-product/(?P<product_id>[0-9]+)')
    def for_product(self, request, product_id=None):
        """Get all price rules for a specific product."""
        rules = ClientPriceRule.objects.filter(
            product_id=product_id,
            organization_id=get_current_tenant_id(),
            is_active=True
        )
        return Response(ClientPriceRuleSerializer(rules, many=True).data)
