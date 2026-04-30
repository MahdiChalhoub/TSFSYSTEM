"""
ChartOfAccountViewSet mixin — Migration map CRUD + quality KPIs.

Hosts the @action methods registered under
`/api/finance/coa/db-templates/migration-maps/...` (excluding the heavy
re-match algorithm which lives in `coa_migration_rematch_views.py`).
Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
)
from django.db import models


class COAMigrationMapMixin:
    """@action methods for migration-map listing, save, quality, and status."""

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps/(?P<source_key>[\\w]+)/(?P<target_key>[\\w]+)')
    def migration_map(self, request, source_key=None, target_key=None):
        """Get pre-built account mapping between two templates with quality KPIs."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        maps = COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).order_by('source_account_code', 'mapping_type', 'target_account_code').values(
            'source_account_code', 'target_account_code', 'notes',
            'match_level', 'confidence_score', 'status', 'mapping_type',
            'is_manual_override', 'mapping_reason',
            'group_key', 'allocation_percent',
        )
        maps_list = list(maps)

        # Quality KPIs
        total = len(maps_list)
        by_level = {}
        mapped = unmapped = 0
        for m in maps_list:
            by_level[m.get('match_level', 'UNMAPPED')] = by_level.get(m.get('match_level', 'UNMAPPED'), 0) + 1
            if m.get('target_account_code'):
                mapped += 1
            else:
                unmapped += 1

        # Critical roles coverage
        critical_roles = ['CASH_ACCOUNT', 'RECEIVABLE', 'PAYABLE', 'REVENUE', 'COGS',
                          'VAT_INPUT', 'VAT_OUTPUT', 'RETAINED_EARNINGS', 'P_L_SUMMARY']
        source_roles = set(source.template_accounts.exclude(
            system_role__isnull=True
        ).exclude(system_role='').values_list('system_role', flat=True))
        critical_present = [r for r in critical_roles if r in source_roles]
        critical_mapped = 0
        for r in critical_present:
            src_acct = source.template_accounts.filter(system_role=r).first()
            if src_acct and any(m['source_account_code'] == src_acct.code and m.get('target_account_code') for m in maps_list):
                critical_mapped += 1

        return Response({
            'source_key': source_key, 'target_key': target_key,
            'source_name': source.name, 'target_name': target.name,
            'mappings': maps_list, 'total': total,
            'quality': {
                'mapped': mapped, 'unmapped': unmapped,
                'by_level': by_level,
                'coverage_pct': round((mapped / max(total, 1)) * 100, 1),
                'critical_roles_total': len(critical_present),
                'critical_roles_mapped': critical_mapped,
                'critical_roles_coverage_pct': round((critical_mapped / max(len(critical_present), 1)) * 100, 1),
            },
        })

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps')
    def migration_maps_list(self, request):
        """List all available migration map pairs (which template→template maps exist)."""
        from apps.finance.models.coa_template import COATemplateMigrationMap

        pairs = COATemplateMigrationMap.objects.values(
            'source_template__key', 'source_template__name',
            'target_template__key', 'target_template__name',
        ).annotate(mapping_count=models.Count('id')).order_by('source_template__key')

        return Response([{
            'source_key': p['source_template__key'],
            'source_name': p['source_template__name'],
            'target_key': p['target_template__key'],
            'target_name': p['target_template__name'],
            'mapping_count': p['mapping_count'],
        } for p in pairs])

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/save')
    def migration_map_save(self, request):
        """Create or update migration mappings between two templates with match metadata."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')
        mappings = request.data.get('mappings', [])

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        # Map for confidence inference from notes
        def infer_match_metadata(notes_str):
            notes = (notes_str or '').lower()
            if 'role' in notes:
                return 'ROLE', 1.0
            elif 'same code' in notes or 'code' in notes:
                return 'CODE', 0.8
            elif 'name' in notes:
                return 'NAME', 0.6
            elif 'type' in notes:
                return 'TYPE_SUBTYPE', 0.4
            elif notes_str:
                return 'MANUAL', 0.5
            return 'UNMAPPED', 0.0

        # Upsert all mappings
        created, updated = 0, 0
        for m in mappings:
            match_level = m.get('match_level')
            confidence = m.get('confidence_score')
            if not match_level:
                match_level, confidence = infer_match_metadata(m.get('notes', ''))

            defaults = {
                'target_account_code': m.get('target_account_code', ''),
                'notes': m.get('notes', ''),
                'match_level': match_level,
                'confidence_score': confidence or 0.0,
                'status': m.get('status', 'AUTO_MATCHED'),
                'mapping_type': m.get('mapping_type', 'ONE_TO_ONE'),
                'mapping_reason': m.get('notes', ''),
                'is_manual_override': m.get('is_manual_override', False),
            }

            obj, was_created = COATemplateMigrationMap.objects.update_or_create(
                source_template=source,
                target_template=target,
                source_account_code=m['source_account_code'],
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response({
            'message': f'Saved {created + updated} mappings ({created} new, {updated} updated)',
            'created': created, 'updated': updated,
        })

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps/quality')
    def migration_map_quality(self, request):
        """Compute quality KPIs for a template migration map."""
        from apps.finance.models.coa_template import (
            COATemplate, COATemplateAccount, COATemplateMigrationMap
        )

        source_key = request.query_params.get('source_key')
        target_key = request.query_params.get('target_key')
        if not source_key or not target_key:
            return Response({'error': 'source_key and target_key required'}, status=status.HTTP_400_BAD_REQUEST)

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        maps = list(COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ))
        source_accts = list(COATemplateAccount.objects.filter(template=source))
        target_accts = list(COATemplateAccount.objects.filter(template=target))

        total = len(maps)
        if total == 0:
            return Response({'error': 'No migration maps found', 'total': 0})

        # ── Match Level Distribution ──
        by_level = {}
        for m in maps:
            lvl = m.match_level or 'UNKNOWN'
            by_level[lvl] = by_level.get(lvl, 0) + 1

        # ── Confidence Distribution ──
        conf_high = sum(1 for m in maps if (m.confidence_score or 0) >= 0.7)
        conf_med = sum(1 for m in maps if 0.3 <= (m.confidence_score or 0) < 0.7)
        conf_low = sum(1 for m in maps if (m.confidence_score or 0) < 0.3 and m.target_account_code)
        conf_none = sum(1 for m in maps if not m.target_account_code)

        # ── Mapping Type Distribution ──
        by_type = {}
        for m in maps:
            mt = m.mapping_type or 'ONE_TO_ONE'
            by_type[mt] = by_type.get(mt, 0) + 1

        # ── Coverage ──
        mapped_source_codes = set(m.source_account_code for m in maps if m.target_account_code)
        mapped_target_codes = set(m.target_account_code for m in maps if m.target_account_code)
        source_codes = set(a.code for a in source_accts)
        target_codes = set(a.code for a in target_accts)
        unmapped_sources = source_codes - mapped_source_codes
        unmapped_targets = target_codes - mapped_target_codes

        # ── Critical Role Coverage ──
        CRITICAL_ROLES = {
            'CASH_ACCOUNT', 'BANK_ACCOUNT', 'RECEIVABLE', 'PAYABLE',
            'REVENUE', 'COGS', 'P_L_SUMMARY', 'RETAINED_EARNINGS',
            'INVENTORY_ASSET', 'INPUT_VAT', 'OUTPUT_VAT',
        }
        critical_source = [a for a in source_accts if a.system_role in CRITICAL_ROLES]
        critical_mapped = [a for a in critical_source if a.code in mapped_source_codes]
        critical_unmapped = [a for a in critical_source if a.code not in mapped_source_codes]

        # ── Risk Metrics ──
        no_direct = sum(1 for m in maps if m.mapping_type == 'NO_DIRECT_MATCH')
        manual_review = sum(1 for m in maps if m.status == 'MANUAL_REVIEW')

        # ── Overall Score (0-100) ──
        coverage_pct = (len(mapped_source_codes) / len(source_codes) * 100) if source_codes else 0
        critical_pct = (len(critical_mapped) / len(critical_source) * 100) if critical_source else 100
        avg_confidence = (sum(m.confidence_score or 0 for m in maps) / total * 100) if total else 0
        quality_score = round(
            coverage_pct * 0.4 +        # 40% weight: overall coverage
            critical_pct * 0.35 +        # 35% weight: critical role coverage
            avg_confidence * 0.25,       # 25% weight: average confidence
            1
        )

        return Response({
            'source_key': source_key,
            'target_key': target_key,
            'quality_score': quality_score,
            'total_mappings': total,
            'coverage': {
                'source_total': len(source_codes),
                'source_mapped': len(mapped_source_codes),
                'source_pct': round(coverage_pct, 1),
                'target_total': len(target_codes),
                'target_covered': len(mapped_target_codes),
                'target_pct': round(len(mapped_target_codes) / len(target_codes) * 100, 1) if target_codes else 0,
                'unmapped_sources': sorted(list(unmapped_sources))[:20],
                'unmapped_targets': sorted(list(unmapped_targets))[:20],
            },
            'match_levels': by_level,
            'mapping_types': by_type,
            'confidence': {
                'high': conf_high,
                'medium': conf_med,
                'low': conf_low,
                'unmapped': conf_none,
                'avg': round(avg_confidence, 1),
            },
            'critical_roles': {
                'total': len(critical_source),
                'mapped': len(critical_mapped),
                'pct': round(critical_pct, 1),
                'unmapped': [{'code': a.code, 'name': a.name, 'role': a.system_role} for a in critical_unmapped],
            },
            'risk': {
                'no_direct_match': no_direct,
                'manual_review': manual_review,
                'risk_level': 'LOW' if quality_score >= 80 else 'MEDIUM' if quality_score >= 60 else 'HIGH',
            },
        })

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/set-status')
    def migration_map_set_status(self, request):
        """Set approval status on a migration map pair (Draft → Reviewed → Approved → Published)."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')
        new_status = request.data.get('status', '').upper()
        VALID_STATUSES = ('DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED')
        if new_status not in VALID_STATUSES:
            return Response({'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}, status=status.HTTP_400_BAD_REQUEST)

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        updated = COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).update(status=new_status)

        return Response({
            'source_key': source_key,
            'target_key': target_key,
            'status': new_status,
            'updated': updated,
            'message': f'Set {updated} mappings to {new_status}',
        })
