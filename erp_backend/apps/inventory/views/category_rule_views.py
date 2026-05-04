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

    # ── Phase 7: AI-ranked rule-suggestion wizard endpoints ──
    # /rule-suggestions/   GET  → list usage-derived rule proposals
    # /apply-rule/         POST → commit one accepted proposal as a CategoryCreationRule

    @action(detail=False, methods=['get'], url_path='rule-suggestions')
    def rule_suggestions(self, request):
        """
        GET /api/inventory/category-rules/rule-suggestions/?category_ids=…&ai=1

        Same opt-in/cache/rate-limit story as the scope-suggestion
        endpoint — see scope_ai_ranker docstring. When `ai=1` is set
        and the org has opted into AI ranking, each suggestion carries
        an `ai_review` field with verdict + per-field endorsement.
        """
        from apps.inventory.services.category_rule_suggester import suggest_category_rules
        from apps.inventory.views.attribute_views import _current_org

        org = _current_org(request)
        if not org:
            return Response([])

        ids_param = request.query_params.get('category_ids')
        parsed = None
        if ids_param:
            parsed = [int(x) for x in ids_param.split(',') if x.strip().isdigit()]

        suggestions = suggest_category_rules(org, category_ids=parsed)

        if str(request.query_params.get('ai', '')).lower() in ('1', 'true', 'yes'):
            from apps.inventory.services.category_rule_ai_ranker import enrich_category_rule_suggestions
            try:
                top_n = int(request.query_params.get('ai_top_n', 30))
            except (TypeError, ValueError):
                top_n = 30
            suggestions = enrich_category_rule_suggestions(org, suggestions, top_n=max(1, min(top_n, 100)))

        return Response(suggestions)

    @action(detail=False, methods=['post'], url_path='apply-rule')
    def apply_rule(self, request):
        """
        POST /api/inventory/category-rules/apply-rule/
        Body: { category_id, requires_barcode, requires_brand,
                requires_unit, requires_photo, requires_supplier }

        Creates the CategoryCreationRule from an accepted suggestion.
        Idempotent: if the rule already exists, returns it without
        overwriting (operator should use the standard PUT to update).
        """
        from apps.inventory.services.category_rule_suggester import apply_category_rule_suggestion
        from apps.inventory.models import Category

        category_id = request.data.get('category_id')
        try:
            category = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)

        result = apply_category_rule_suggestion(
            category,
            rule_fields={
                'requires_barcode':  request.data.get('requires_barcode',  False),
                'requires_brand':    request.data.get('requires_brand',    False),
                'requires_unit':     request.data.get('requires_unit',     False),
                'requires_photo':    request.data.get('requires_photo',    False),
                'requires_supplier': request.data.get('requires_supplier', False),
            },
        )
        return Response(result)
