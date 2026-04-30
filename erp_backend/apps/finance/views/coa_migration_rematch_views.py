"""
ChartOfAccountViewSet mixin — Server-side migration map re-match.

Hosts the heavy `migration_map_rematch` action: a 4-level matching
algorithm with optional N:1 fallback. Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
)


class COAMigrationRematchMixin:
    """@action method that re-runs server-side migration matching."""

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/rematch')
    def migration_map_rematch(self, request):
        """Server-side re-match using the 4-level algorithm with used_targets tracking."""
        import unicodedata, re
        from apps.finance.models.coa_template import (
            COATemplate, COATemplateAccount, COATemplateMigrationMap
        )

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        def normalize_name(name):
            name = unicodedata.normalize('NFD', name)
            name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
            name = name.lower().strip()
            name = re.sub(r'[^a-z0-9 ]', '', name)
            name = re.sub(r'\s+', ' ', name)
            return name

        SYNONYMS = {
            'cash in hand': ['caisse', 'petty cash', 'encaisse'],
            'accounts receivable': ['trade receivables', 'clients', 'creances clients', 'clients et comptes rattaches'],
            'accounts payable': ['trade payables', 'fournisseurs', 'fournisseurs et comptes rattaches'],
            'revenue': ['sales revenue', 'ventes', 'ventes de marchandises', 'chiffre daffaires'],
            'cost of goods sold': ['cogs', 'cout des ventes', 'achats de marchandises', 'achats'],
            'retained earnings': ['report a nouveau', 'resultats reportes'],
            'salary expense': ['salaires et traitements', 'charges de personnel', 'frais de personnel'],
            'depreciation expense': ['dotations aux amortissements', 'amortissements'],
            'bank account': ['banques', 'banques comptes courants'],
            'vat input': ['tva deductible', 'tva recuperable'],
            'vat output': ['tva collectee', 'tva facturee'],
            'inventory': ['stocks', 'marchandises', 'stocks de marchandises'],
            'buildings': ['constructions', 'batiments'],
            'equipment': ['materiel et outillage', 'materiel technique'],
            'vehicles': ['materiel de transport'],
            'furniture': ['mobilier', 'materiel de bureau'],
            'land': ['terrains'],
            'software': ['logiciels'],
        }

        def find_synonym_group(normalized):
            for key, syns in SYNONYMS.items():
                if normalized == normalize_name(key) or normalized in [normalize_name(s) for s in syns]:
                    return key
            return None

        src_accts = list(COATemplateAccount.objects.filter(template=source).order_by('code'))
        tgt_accts = list(COATemplateAccount.objects.filter(template=target).order_by('code'))

        # Build target indexes
        tgt_by_role, tgt_by_code, tgt_by_norm, tgt_by_syn, tgt_by_key = {}, {}, {}, {}, {}
        for t in tgt_accts:
            if t.system_role:
                tgt_by_role.setdefault(t.system_role, []).append(t)
            tgt_by_code[t.code] = t
            norm = t.normalized_name or normalize_name(t.name)
            tgt_by_norm.setdefault(norm, []).append(t)
            syn = find_synonym_group(norm)
            if syn:
                tgt_by_syn.setdefault(syn, []).append(t)
            key = f"{t.type}|{t.sub_type}|{t.business_domain}"
            tgt_by_key.setdefault(key, []).append(t)

        used = set()
        new_maps = []

        for src in src_accts:
            tgt_code, level, conf, reason = '', 'UNMAPPED', 0.0, 'No suitable match found'

            # Level 1: Role
            if src.system_role and src.system_role in tgt_by_role:
                cands = [t for t in tgt_by_role[src.system_role] if t.code not in used]
                if cands:
                    tgt_code, level, conf = cands[0].code, 'ROLE', 1.0
                    reason = f"System role: {src.system_role}"
                    used.add(tgt_code)

            # Level 2: Code + type + balance
            if not tgt_code and src.code in tgt_by_code:
                t = tgt_by_code[src.code]
                if t.code not in used and t.type == src.type and t.normal_balance == src.normal_balance:
                    tgt_code, level, conf = t.code, 'CODE', 0.8
                    reason = f"Code+type+balance: {src.code}"
                    used.add(tgt_code)

            # Level 3: Name / synonym
            if not tgt_code:
                src_norm = src.normalized_name or normalize_name(src.name)
                if src_norm in tgt_by_norm:
                    cands = [t for t in tgt_by_norm[src_norm] if t.code not in used]
                    if cands:
                        tgt_code, level, conf = cands[0].code, 'NAME', 0.7
                        reason = f"Name: '{src_norm}'"
                        used.add(tgt_code)
                if not tgt_code:
                    syn = find_synonym_group(src_norm)
                    if syn and syn in tgt_by_syn:
                        cands = [t for t in tgt_by_syn[syn] if t.code not in used and t.type == src.type]
                        if cands:
                            tgt_code, level, conf = cands[0].code, 'NAME', 0.6
                            reason = f"Synonym: '{syn}'"
                            used.add(tgt_code)

            # Level 4: Type+SubType+Domain
            if not tgt_code:
                key = f"{src.type}|{src.sub_type}|{src.business_domain}"
                if key in tgt_by_key:
                    cands = [t for t in tgt_by_key[key] if t.code not in used]
                    if cands:
                        tgt_code, level, conf = cands[0].code, 'TYPE_SUBTYPE', 0.4
                        reason = f"Type+SubType+Domain: {key}"
                        used.add(tgt_code)

            new_maps.append((src.code, tgt_code, level, conf, reason))

        # ── Pass 2: fallback for remaining unmapped — allow target reuse (N:1) ──
        for i, (sc, tc, lv, co, rs) in enumerate(new_maps):
            if tc:
                continue  # already matched

            src = next((a for a in src_accts if a.code == sc), None)
            if not src:
                continue

            # Try role match (without used constraint)
            if src.system_role and src.system_role in tgt_by_role:
                cands = tgt_by_role[src.system_role]
                if cands:
                    new_maps[i] = (sc, cands[0].code, 'ROLE', 0.5, f"Role (shared): {src.system_role}")
                    continue

            # Try name/synonym match
            src_norm = src.normalized_name or normalize_name(src.name)
            if src_norm in tgt_by_norm:
                new_maps[i] = (sc, tgt_by_norm[src_norm][0].code, 'NAME', 0.4, f"Name (shared): '{src_norm}'")
                continue
            syn = find_synonym_group(src_norm)
            if syn and syn in tgt_by_syn:
                cands = [t for t in tgt_by_syn[syn] if t.type == src.type]
                if cands:
                    new_maps[i] = (sc, cands[0].code, 'NAME', 0.35, f"Synonym (shared): '{syn}'")
                    continue

            # Try type match (without used constraint)
            key = f"{src.type}|{src.sub_type}|{src.business_domain}"
            if key in tgt_by_key:
                new_maps[i] = (sc, tgt_by_key[key][0].code, 'TYPE_SUBTYPE', 0.2, f"Type (shared): {key}")
                continue

        # Delete old maps for this pair and bulk create new ones
        COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).delete()

        objs = [COATemplateMigrationMap(
            source_template=source, target_template=target,
            source_account_code=sc, target_account_code=tc,
            match_level=lv, confidence_score=co,
            status='AUTO_MATCHED' if tc else 'UNMAPPED_OPTIONAL',
            mapping_type='ONE_TO_ONE', mapping_reason=rs, notes=rs,
        ) for sc, tc, lv, co, rs in new_maps]
        COATemplateMigrationMap.objects.bulk_create(objs)

        mapped = sum(1 for _, tc, _, _, _ in new_maps if tc)
        by_level = {}
        for _, _, lv, _, _ in new_maps:
            by_level[lv] = by_level.get(lv, 0) + 1

        return Response({
            'message': f'Re-matched: {mapped}/{len(new_maps)} mapped',
            'total': len(new_maps), 'mapped': mapped,
            'by_level': by_level,
        })
