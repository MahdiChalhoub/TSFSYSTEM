"""
Data Migration: Migrate posting rules from JSON blob to PostingRule model.

Reads Organization.settings['finance_posting_rules'] and creates PostingRule rows.
Produces an audit summary with counts and any skipped/invalid entries.
"""
import logging
from django.db import migrations

logger = logging.getLogger(__name__)


def migrate_json_to_posting_rules(apps, schema_editor):
    """One-time forward migration: JSON → PostingRule rows."""
    Organization = apps.get_model('erp', 'Organization')
    PostingRule = apps.get_model('finance', 'PostingRule')
    ChartOfAccount = apps.get_model('finance', 'ChartOfAccount')

    stats = {'migrated': 0, 'skipped_no_account': 0, 'skipped_invalid_account': 0, 'skipped_not_found': 0, 'orgs_processed': 0}

    for org in Organization.objects.all():
        settings = org.settings or {}
        rules = settings.get('finance_posting_rules', {})
        if not rules:
            continue

        stats['orgs_processed'] += 1

        # Get all valid account IDs for this org (for validation)
        valid_account_ids = set(
            ChartOfAccount.objects.filter(organization=org).values_list('id', flat=True)
        )

        for section, mappings in rules.items():
            if not isinstance(mappings, dict):
                continue
            for key, account_id in mappings.items():
                if not account_id:
                    stats['skipped_no_account'] += 1
                    continue

                # Validate account exists and belongs to this org
                if account_id not in valid_account_ids:
                    stats['skipped_not_found'] += 1
                    logger.warning(
                        f"  ⚠️ Skipping {section}.{key}: account_id={account_id} "
                        f"not found in org '{org.name}' (id={org.id})"
                    )
                    continue

                event_code = f"{section}.{key}"

                # Derive module from section prefix
                module = section if section in [
                    'sales', 'purchases', 'inventory', 'tax', 'automation',
                    'suspense', 'partners', 'equity', 'fixedAssets', 'fx', 'payroll'
                ] else 'sales'

                PostingRule.objects.update_or_create(
                    organization=org,
                    event_code=event_code,
                    defaults={
                        'account_id': account_id,
                        'module': module,
                        'source': 'MIGRATION',
                        'description': f'Migrated from legacy JSON: {section}.{key}',
                        'is_active': True,
                    }
                )
                stats['migrated'] += 1

    # Audit summary
    logger.info(
        f"\n{'='*60}\n"
        f"📊 PostingRule Migration Report\n"
        f"{'='*60}\n"
        f"  Organizations processed: {stats['orgs_processed']}\n"
        f"  Rules migrated:          {stats['migrated']}\n"
        f"  Skipped (no account):    {stats['skipped_no_account']}\n"
        f"  Skipped (invalid ID):    {stats['skipped_not_found']}\n"
        f"{'='*60}"
    )


def reverse_migration(apps, schema_editor):
    """Reverse: delete all MIGRATION-sourced PostingRules."""
    PostingRule = apps.get_model('finance', 'PostingRule')
    count = PostingRule.objects.filter(source='MIGRATION').count()
    PostingRule.objects.filter(source='MIGRATION').delete()
    logger.info(f"Reversed PostingRule migration: deleted {count} MIGRATION-sourced rules")


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0027_posting_rule'),
    ]

    operations = [
        migrations.RunPython(
            migrate_json_to_posting_rules,
            reverse_code=reverse_migration,
        ),
    ]
