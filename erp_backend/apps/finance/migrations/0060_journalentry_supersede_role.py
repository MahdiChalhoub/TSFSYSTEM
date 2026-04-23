"""
JournalEntry hardening for OB → JE unification (Phase 2/3):

  1. is_superseded + superseded_by + superseded_at
     Replaces the description-prefix "[SUPERSEDED ...]" hack with proper
     referential semantics. Balance services that filter POSTED only were
     already auto-excluding DRAFT-flipped superseded rows; the flag makes
     the intent explicit and queryable.

  2. journal_role (USER_GENERAL / SYSTEM_OPENING / SYSTEM_CLOSING /
     SYSTEM_ADJUSTMENT)
     Ownership axis, separate from journal_type. Drives edit-lock rules
     (system-owned JEs can't be edited from the normal UI) and audit
     exports.

  3. Partial unique constraint — scoped to SYSTEM_OPENING only
     A tenant can legitimately have multiple journal_type='OPENING' JEs:
     one user-created capital injection entry and one system-generated
     carry-forward. The constraint MUST only enforce uniqueness across
     the latter (journal_role='SYSTEM_OPENING').

  Data migration:
     Historical JEs created by ClosingService carry source_module='finance'
     + source_model='FiscalYear' — we backfill those to
     journal_role='SYSTEM_OPENING' / 'SYSTEM_CLOSING' so the partial
     unique constraint applies correctly on day one. Everything else
     keeps the default 'USER_GENERAL'.
"""
from django.db import migrations, models
import django.db.models.deletion


def _backfill_journal_role(apps, schema_editor):
    """Classify historical system-generated JEs so the partial unique
    constraint applies to the right subset."""
    JE = apps.get_model('finance', 'JournalEntry')
    JE.objects.filter(
        source_module='finance',
        source_model='FiscalYear',
        journal_type='OPENING',
    ).update(journal_role='SYSTEM_OPENING')
    JE.objects.filter(
        source_module='finance',
        source_model='FiscalYear',
        journal_type='CLOSING',
    ).update(journal_role='SYSTEM_CLOSING')


def _unbackfill_journal_role(apps, schema_editor):
    """Reverse of _backfill_journal_role — reset to default."""
    JE = apps.get_model('finance', 'JournalEntry')
    JE.objects.filter(
        source_module='finance',
        source_model='FiscalYear',
        journal_role__in=('SYSTEM_OPENING', 'SYSTEM_CLOSING'),
    ).update(journal_role='USER_GENERAL')


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0059_alter_zatcaconfig_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='journalentry',
            name='is_superseded',
            field=models.BooleanField(
                default=False, db_index=True,
                help_text='True when this JE has been replaced by a newer system-generated one',
            ),
        ),
        migrations.AddField(
            model_name='journalentry',
            name='superseded_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='supersedes',
                to='finance.journalentry',
                help_text='Newer JE that replaced this one',
            ),
        ),
        migrations.AddField(
            model_name='journalentry',
            name='superseded_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='journalentry',
            name='journal_role',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('USER_GENERAL', 'User General'),
                    ('SYSTEM_OPENING', 'System Opening'),
                    ('SYSTEM_CLOSING', 'System Closing'),
                    ('SYSTEM_ADJUSTMENT', 'System Adjustment'),
                ],
                default='USER_GENERAL',
                db_index=True,
                help_text='Ownership axis — separate from journal_type; drives edit-lock rules',
            ),
        ),
        migrations.AddIndex(
            model_name='journalentry',
            index=models.Index(
                fields=['organization', 'is_superseded'],
                name='finance_je_org_supers_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='journalentry',
            index=models.Index(
                fields=['organization', 'journal_role'],
                name='finance_je_org_role_idx',
            ),
        ),
        # Classify historical system-generated JEs before building the
        # partial unique index — otherwise the constraint would either
        # be too loose (covers user capital-injection entries with
        # journal_type='OPENING') or fail to build if it's too strict.
        migrations.RunPython(_backfill_journal_role, _unbackfill_journal_role),
        migrations.AddConstraint(
            model_name='journalentry',
            constraint=models.UniqueConstraint(
                fields=['fiscal_year', 'scope', 'organization'],
                condition=models.Q(
                    journal_type='OPENING',
                    status='POSTED',
                    is_superseded=False,
                    journal_role='SYSTEM_OPENING',
                ),
                name='unique_active_opening_je_per_fy_scope',
            ),
        ),
    ]
