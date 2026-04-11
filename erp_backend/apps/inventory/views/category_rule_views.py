"""
Views for Category Creation Rules.
"""
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views_base import TenantModelViewSet
from apps.inventory.models.category_rule_models import CategoryCreationRule
from apps.inventory.serializers.category_rule_serializers import CategoryCreationRuleSerializer
from apps.inventory.services.category_rule_service import CategoryRuleService


class CategoryCreationRuleViewSet(TenantModelViewSet):
    """CRUD for per-category product creation rules."""
    queryset = CategoryCreationRule.objects.select_related('category', 'default_unit_id').all()
    serializer_class = CategoryCreationRuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['category']

    @action(detail=False, methods=['get'], url_path='for-category/(?P<category_id>[0-9]+)')
    def for_category(self, request, category_id=None):
        """
        Get inherited rule for a category (walks up tree).
        Used by frontend when category is selected in product creation form.
        """
        from apps.inventory.models import Category
        try:
            category = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)

        rule = CategoryRuleService.get_rule(category)
        if rule:
            return Response(CategoryCreationRuleSerializer(rule).data)
        return Response({'detail': 'No rule found for this category or its parents'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='validate')
    def validate_creation(self, request):
        """
        Validate product data against category rules before submission.
        Body: {category_id, product_data: {barcode?, brand?, unit?, ...}}
        """
        category_id = request.data.get('category_id')
        product_data = request.data.get('product_data', {})

        from apps.inventory.models import Category
        try:
            category = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)

        result = CategoryRuleService.validate_creation(product_data, category)
        return Response(result)
