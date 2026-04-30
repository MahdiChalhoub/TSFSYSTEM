"""
ChartOfAccountViewSet mixin — Database-backed COA template endpoints.

Hosts the @action methods registered under the `/api/finance/coa/db-templates/`
prefix and the `/api/finance/coa/bulk-classify/` action. Inherited by
`ChartOfAccountViewSet` so URL routing stays at the `coa` basename.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)
from django.db import models
from apps.finance.models import ChartOfAccount
from .coa_account_helpers import _smart_default_for


class COATemplateMixin:
    """@action methods for COA templates + bulk monetary classification."""

    @action(detail=False, methods=['post'], url_path='bulk-classify')
    def bulk_classify(self, request):
        """Bulk-set monetary_classification + revaluation_required.

        Body shapes:
          { "scope": "smart" }
              → Apply IAS 21 / ASC 830 defaults across the whole COA:
                  ASSET (cash/bank/AR/inventory*) → MONETARY + revaluation_required=True
                  LIABILITY (AP/loans)            → MONETARY + revaluation_required=True
                  ASSET (PPE/prepaid)             → NON_MONETARY + revaluation_required=False
                  INCOME / EXPENSE                → INCOME_EXPENSE + revaluation_required=True
                * Inventory is an exception: technically non-monetary, but most
                  ERPs revalue it. We set NON_MONETARY by default and let the
                  operator override.
          { "ids": [1, 2, 3], "classification": "MONETARY",
            "revaluation_required": true }
              → Apply explicit values to a list of account ids.

        Returns: { "updated": <count>, "skipped": <count>, "details": [...] }.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        scope = request.data.get('scope')
        ids = request.data.get('ids') or []
        classification = request.data.get('classification')
        reval_required = request.data.get('revaluation_required')

        qs = ChartOfAccount.objects.filter(organization_id=org_id, is_active=True)
        updated = 0
        details = []

        if scope == 'smart':
            for acc in qs:
                new_class, new_reval = _smart_default_for(acc)
                if (acc.monetary_classification == new_class
                        and acc.revaluation_required == new_reval):
                    continue
                acc.monetary_classification = new_class
                acc.revaluation_required = new_reval
                acc.save(update_fields=['monetary_classification', 'revaluation_required'])
                updated += 1
                details.append({'id': acc.id, 'code': acc.code,
                                'classification': new_class, 'revaluation_required': new_reval})
            return Response({'updated': updated, 'skipped': qs.count() - updated, 'details': details})

        if not ids or classification is None:
            return Response(
                {'error': 'Provide either {"scope": "smart"} or {"ids": [...], "classification": "..."}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if classification not in ('MONETARY', 'NON_MONETARY', 'INCOME_EXPENSE'):
            return Response({'error': 'invalid classification'}, status=status.HTTP_400_BAD_REQUEST)

        for acc in qs.filter(id__in=ids):
            update_fields = ['monetary_classification']
            acc.monetary_classification = classification
            if reval_required is not None:
                acc.revaluation_required = bool(reval_required)
                update_fields.append('revaluation_required')
            acc.save(update_fields=update_fields)
            updated += 1
            details.append({'id': acc.id, 'code': acc.code,
                            'classification': classification,
                            'revaluation_required': bool(reval_required) if reval_required is not None else acc.revaluation_required})
        return Response({'updated': updated, 'skipped': len(ids) - updated, 'details': details})

    @action(detail=False, methods=['get'], url_path='db-templates')
    def db_templates(self, request):
        """List all available COA templates (system + org-custom)."""
        from apps.finance.models.coa_template import COATemplate
        organization_id = get_current_tenant_id()

        # System templates (org=NULL) + custom templates for this org
        qs = COATemplate.objects.filter(
            models.Q(is_system=True, organization__isnull=True) |
            models.Q(is_custom=True, organization_id=organization_id)
        ).order_by('is_custom', 'name')

        data = []
        for tpl in qs:
            data.append({
                'key': tpl.key,
                'name': tpl.name,
                'region': tpl.region,
                'description': tpl.description,
                'icon': tpl.icon,
                'accent_color': tpl.accent_color,
                'is_system': tpl.is_system,
                'is_custom': tpl.is_custom,
                'account_count': tpl.account_count,
                'posting_rule_count': tpl.posting_rules.count(),
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='db-templates/(?P<template_key>[\\w]+)')
    def db_template_detail(self, request, template_key=None):
        """Get full template detail with accounts from normalized model."""
        from apps.finance.models.coa_template import COATemplate
        organization_id = get_current_tenant_id()

        tpl = COATemplate.objects.filter(
            models.Q(key=template_key, is_system=True, organization__isnull=True) |
            models.Q(key=template_key, is_custom=True, organization_id=organization_id)
        ).first()

        if not tpl:
            return Response({'error': f'Template {template_key} not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prefer normalized model, fallback to JSON
        norm_accounts = tpl.template_accounts.all()
        if norm_accounts.exists():
            accounts = [{
                'code': a.code, 'name': a.name, 'type': a.type,
                'sub_type': a.sub_type, 'system_role': a.system_role,
                'parent_code': a.parent_code, 'normal_balance': a.normal_balance,
                'posting_purpose': a.posting_purpose, 'business_domain': a.business_domain,
                'is_reconcilable': a.is_reconcilable, 'is_bank_account': a.is_bank_account,
                'is_tax_account': a.is_tax_account, 'normalized_name': a.normalized_name,
            } for a in norm_accounts]
        else:
            accounts = tpl.accounts

        return Response({
            'key': tpl.key, 'name': tpl.name, 'region': tpl.region,
            'description': tpl.description, 'icon': tpl.icon,
            'accent_color': tpl.accent_color, 'is_system': tpl.is_system,
            'is_custom': tpl.is_custom,
            'accounts': accounts, 'account_count': len(accounts),
        })

    @action(detail=False, methods=['get'], url_path='db-templates/(?P<template_key>[\\w]+)/posting-rules')
    def db_template_posting_rules(self, request, template_key=None):
        """Preview posting rules for a template BEFORE import."""
        from apps.finance.models.coa_template import COATemplate

        organization_id = get_current_tenant_id()
        tpl = COATemplate.objects.filter(
            models.Q(key=template_key, is_system=True, organization__isnull=True) |
            models.Q(key=template_key, is_custom=True, organization_id=organization_id)
        ).first()

        if not tpl:
            return Response({'error': f'Template {template_key} not found'}, status=status.HTTP_404_NOT_FOUND)

        rules = tpl.posting_rules.all().order_by('module', 'event_code')
        data = [{
            'event_code': r.event_code,
            'account_code': r.account_code,
            'module': r.module,
            'description': r.description,
        } for r in rules]

        return Response({
            'template_key': tpl.key,
            'template_name': tpl.name,
            'rules': data,
            'total': len(data),
        })

    @action(detail=False, methods=['post'], url_path='db-templates/create')
    def db_template_create(self, request):
        """Create a custom COA template for the current organization."""
        from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        key = request.data.get('key', '').strip().upper().replace(' ', '_')
        name = request.data.get('name', '').strip()

        if not key or not name:
            return Response({'error': 'key and name are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check uniqueness within this org
        if COATemplate.objects.filter(key=key, organization=organization).exists():
            return Response({'error': f'Template key {key} already exists'}, status=status.HTTP_400_BAD_REQUEST)

        tpl = COATemplate.objects.create(
            key=key,
            name=name,
            region=request.data.get('region', 'Custom'),
            description=request.data.get('description', ''),
            icon=request.data.get('icon', 'FileText'),
            accent_color=request.data.get('accent_color', 'var(--app-info)'),
            is_system=False,
            is_custom=True,
            organization=organization,
            accounts=request.data.get('accounts', []),
        )

        # Create posting rules if provided
        rules = request.data.get('posting_rules', [])
        if rules:
            rule_objects = [
                COATemplatePostingRule(
                    template=tpl,
                    event_code=r['event_code'],
                    account_code=r['account_code'],
                    description=r.get('description', ''),
                )
                for r in rules
            ]
            COATemplatePostingRule.objects.bulk_create(rule_objects)

        return Response({
            'key': tpl.key,
            'name': tpl.name,
            'account_count': tpl.account_count,
            'posting_rule_count': tpl.posting_rules.count(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['put'], url_path='db-templates/(?P<template_key>[\\w]+)/update')
    def db_template_update(self, request, template_key=None):
        """Update a custom template (system templates cannot be modified)."""
        from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
        organization_id = get_current_tenant_id()

        tpl = COATemplate.objects.filter(
            key=template_key, is_custom=True, organization_id=organization_id
        ).first()

        if not tpl:
            return Response({'error': 'Custom template not found (system templates cannot be edited)'},
                            status=status.HTTP_404_NOT_FOUND)

        # Update fields
        for field in ['name', 'region', 'description', 'icon', 'accent_color', 'accounts']:
            if field in request.data:
                setattr(tpl, field, request.data[field])
        tpl.save()

        # Update posting rules if provided
        if 'posting_rules' in request.data:
            COATemplatePostingRule.objects.filter(template=tpl).delete()
            rules = request.data['posting_rules']
            if rules:
                COATemplatePostingRule.objects.bulk_create([
                    COATemplatePostingRule(
                        template=tpl,
                        event_code=r['event_code'],
                        account_code=r['account_code'],
                        description=r.get('description', ''),
                    )
                    for r in rules
                ])

        return Response({'message': 'Template updated', 'account_count': tpl.account_count})

    @action(detail=False, methods=['delete'], url_path='db-templates/(?P<template_key>[\\w]+)/delete')
    def db_template_delete(self, request, template_key=None):
        """Delete a custom template (system templates cannot be deleted)."""
        from apps.finance.models.coa_template import COATemplate
        organization_id = get_current_tenant_id()

        deleted, _ = COATemplate.objects.filter(
            key=template_key, is_custom=True, organization_id=organization_id
        ).delete()

        if not deleted:
            return Response({'error': 'Custom template not found or is a system template'},
                            status=status.HTTP_404_NOT_FOUND)

        return Response({'message': f'Template {template_key} deleted'})
