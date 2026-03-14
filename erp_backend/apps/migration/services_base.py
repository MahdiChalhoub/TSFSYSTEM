"""
Migration Service — Orchestrates the full UltimatePOS → TSF migration.
Runs entity imports in dependency order with transaction safety and progress tracking.
"""
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.parsers import SQLDumpParser, DirectDBReader
from apps.migration.mappers import (
    UnitMapper, CategoryMapper, BrandMapper, ProductMapper,
    ContactMapper, TransactionMapper, SellLineMapper, PurchaseLineMapper,
    AccountMapper, SiteMapper, ExpenseMapper, TransactionPaymentMapper,
    safe_int, safe_bool, safe_decimal, safe_str
)

logger = logging.getLogger(__name__)



class MigrationBaseMixin:

    def __init__(self, job: MigrationJob, organization_id: int):
        self.job = job
        self.organization_id = organization_id
        self.errors = []
        self.parser = None
        self.id_maps = {
            'SITE': {},
            'UNIT': {},
            'CATEGORY': {},
            'BRAND': {},
            'PRODUCT': {},
            'CONTACT': {},
            'TRANSACTION': {},
            'ACCOUNT': {},
            'PAYMENT': {},
            'EXPENSE': {},
            'USER': {},
            'JOURNAL_ENTRY': {},
            'ORDER_LINE': {},
            'COMBO_LINK': {},
        }
        # Extra mappings for cross-referencing
        self.expense_category_map = {}      # source_id -> category_name
        self.transaction_contact_map = {}   # source_tx_id -> source_contact_id
        self.transaction_type_map = {}      # source_tx_id -> UPOS type string
        self.combo_data = {}                # source_product_id -> combo_variations JSON
        self._load_existing_mappings()


    def run(self, resume_from=None):
        """Execute the full migration pipeline. If resume_from is set, skip completed steps."""
        try:
            completed = list(self.job.completed_steps or [])

            if not resume_from:
                self.job.status = 'PARSING'
                self.job.started_at = timezone.now()
                self._heartbeat()
                self.job.save()

                # Step 1: Parse source data
                self.job.current_step = 'Analyzing SQL Dump & Preparing Import...'
                self.job.progress = 2
                self.job.save()
                self._parse_source()
            else:
                # Resume mode: skip parsing, just reload mappings
                self.job.status = 'RUNNING'
                self.job.current_step = f'Resuming from step: {resume_from}'
                self._heartbeat()
                self.job.save()
                self._parse_source()
                logger.info(f"Resuming migration #{self.job.id} from step: {resume_from}")

            # Step 2: Run migration steps
            self.job.status = 'RUNNING'
            self.job.save()

            skip_mode = resume_from is not None
            for step_name, step_label, progress in self.MIGRATION_STEPS:
                # Skip already-completed steps
                if skip_mode:
                    if step_name in completed:
                        logger.info(f"Skipping completed step: {step_name}")
                        continue
                    elif step_name == resume_from:
                        skip_mode = False
                        logger.info(f"Resuming at step: {step_name}")
                    elif resume_from and step_name != resume_from:
                        # Skip until we reach the resume_from step
                        if step_name in completed:
                            continue

                self.job.current_step = step_label
                self.job.progress = progress
                self._heartbeat()
                self.job.save()

                method = getattr(self, f'_migrate_{step_name}', None)
                if method:
                    try:
                        method()
                        # Track this step as completed
                        if step_name not in completed:
                            completed.append(step_name)
                            self.job.completed_steps = completed
                            self.job.save()
                    except Exception as e:
                        self._log_error(f"Error in {step_label}: {str(e)}")
                        logger.exception(f"Migration step failed: {step_name}")
                        # Save partial error log on each step failure
                        self.job.total_errors = len(self.errors)
                        if self.errors:
                            self.job.error_log = '\n'.join(self.errors[-200:])
                        self.job.save()

            # Complete
            self.job.status = 'COMPLETED'
            self.job.progress = 100
            self.job.completed_at = timezone.now()
            self.job.total_errors = len(self.errors)
            if self.errors:
                self.job.error_log = '\n'.join(self.errors[-200:])
            
            # Update error summary
            summary = {}
            for err in self.errors:
                etype = err.split(':')[0] if ':' in err else 'Unknown'
                summary[etype] = summary.get(etype, 0) + 1
            self.job.error_summary = summary
            
            self._heartbeat()
            self.job.save()

            logger.info(f"Migration #{self.job.id} completed. Errors: {len(self.errors)}")

        except Exception as e:
            self.job.status = 'FAILED'
            self.job.error_log = (self.job.error_log or '') + '\n\nFATAL CRASH:\n' + traceback.format_exc()
            self.job.completed_at = timezone.now()
            self.job.total_errors = len(self.errors)
            self.job.save()
            logger.exception(f"Migration #{self.job.id} failed catastrophically")
            raise


    def _load_existing_mappings(self):
        """Pre-load existing mappings for this job into memory to prevent N+1 DB lookups."""
        mappings = MigrationMapping.objects.filter(job=self.job)
        for m in mappings:
            if m.entity_type in self.id_maps:
                self.id_maps[m.entity_type][m.source_id] = m.target_id
        logger.info(f"Pre-loaded {len(mappings)} mappings for job {self.job.id}")


    def _heartbeat(self, sub_progress=None):
        """Notify the system that the task is alive and optionally update sub-step progress."""
        self.job.last_heartbeat = timezone.now()
        if sub_progress is not None:
            self.job.current_step_detail = sub_progress
        try:
            self.job.save(update_fields=['last_heartbeat', 'current_step_detail'] if sub_progress else ['last_heartbeat'])
        except Exception:
            pass  # Don't crash migration on heartbeat save failure


    def _parse_source(self):
        """Parse the data source: scan SQL offsets or connect to Direct DB."""
        if self.job.source_type == 'SQL_DUMP':
            from apps.storage.backends import get_local_path
            
            # Use stored_file if available, else fallback to legacy file_path
            file_path = None
            if self.job.stored_file:
                from apps.storage.models import StorageProvider
                provider = StorageProvider.get_for_organization(self.job.organization)
                logger.info(f"Using StoredFile {self.job.stored_file_id} for migration")
                file_path = get_local_path(
                    provider,
                    self.job.stored_file.storage_key,
                    self.job.stored_file.bucket
                )
            else:
                file_path = self.job.file_path

            if not file_path:
                raise ValueError("No migration file found (stored_file and file_path are both null)")

            self.parser = SQLDumpParser(file_path=file_path)
            self.parser.parse()
            logger.info("SQL dump parser initialized (streaming mode)")

        elif self.job.source_type == 'DIRECT_DB':
            from apps.migration.parsers import DirectDBReader
            self.db_reader = DirectDBReader(
                host=self.job.db_host,
                port=self.job.db_port or 3306,
                database=self.job.db_name,
                user=self.job.db_user,
                password=self.job.db_password,
            )
            self.db_reader.connect()
            logger.info("Direct DB connection established (streaming mode)")


    def _get_rows(self, table_name):
        """Helper to get rows: either from streaming parser or Direct DB connection."""
        biz_id = self.job.source_business_id
        if self.parser:
            return self.parser.stream_rows(table_name, business_id=biz_id)
        
        if hasattr(self, 'db_reader'):
            where = f"business_id = {biz_id}" if biz_id else None
            # Some tables don't have business_id (e.g. variations linked via products)
            if table_name in ('variations', 'transaction_sell_lines', 'purchase_lines', 'account_transactions', 'combo_variations', 'stock_adjustment_lines', 'product_variations', 'variation_location_details'):
                where = None # Will filter in logic if needed
            
            return self.db_reader.read_table(table_name, where)
        
        return []


    def _log_error(self, message):
        """Log an error for reporting."""
        self.errors.append(f"[{timezone.now().isoformat()}] {message}")
        logger.warning(message)


    def _get_or_create_mapping(self, entity_type, source_id, source_table):
        """
        Check if a mapping already exists (for idempotency).
        In SYNC mode, also checks mappings from ALL previous jobs for the same org,
        so we skip records that were imported in any prior migration.
        """
        # Check current job memory cache first
        cached = self.id_maps.get(entity_type, {}).get(source_id)
        if cached:
            return cached

        # In SYNC mode, check all previous completed jobs for the same org
        if self.job.migration_mode == 'SYNC':
            try:
                previous = MigrationMapping.objects.filter(
                    job__tenant_id=self.organization_id,
                    job__status__in=['COMPLETED', 'RUNNING'],
                    entity_type=entity_type,
                    source_id=source_id,
                ).exclude(job=self.job).first()
                if previous:
                    # Record it in current job too for completeness and caching
                    self._save_mapping(entity_type, source_id, previous.target_id,
                                        source_table, {'synced_from_job': previous.job_id})
                    self.id_maps.setdefault(entity_type, {})[source_id] = previous.target_id
                    return previous.target_id
            except Exception:
                pass

        return None


    def _save_mapping(self, entity_type, source_id, target_id, source_table, extra_data=None):
        """Save an old_id → new_id mapping and update memory cache."""
        MigrationMapping.objects.create(
            job=self.job,
            entity_type=entity_type,
            source_id=source_id,
            target_id=target_id,
            source_table=source_table,
            extra_data=extra_data,
        )
        self.id_maps.setdefault(entity_type, {})[source_id] = target_id


    def _migrate_finalize(self):
        """Final cleanup and summary."""
        if hasattr(self, 'db_reader'):
            self.db_reader.close()
        
        logger.info(f"Migration #{self.job.id} finalized")
        logger.info(f"  Sites: {len(self.id_maps['SITE'])}")
        logger.info(f"  Units: {len(self.id_maps['UNIT'])}")
        logger.info(f"  Categories: {len(self.id_maps['CATEGORY'])}")
        logger.info(f"  Brands: {len(self.id_maps['BRAND'])}")
        logger.info(f"  Products: {len(self.id_maps['PRODUCT'])}")
        logger.info(f"  Contacts: {len(self.id_maps['CONTACT'])}")
        logger.info(f"  Transactions: {len(self.id_maps['TRANSACTION'])}")
        logger.info(f"  Accounts: {len(self.id_maps['ACCOUNT'])}")
        logger.info(f"  Payments: {len(self.id_maps['PAYMENT'])}")
        logger.info(f"  Expenses: {len(self.id_maps.get('EXPENSE', {}))}")
        logger.info(f"  Journal Entries: {len(self.id_maps.get('JOURNAL_ENTRY', {}))}")
        logger.info(f"  Total errors: {len(self.errors)}")

