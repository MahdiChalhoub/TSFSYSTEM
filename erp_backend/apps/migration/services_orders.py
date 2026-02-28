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



class MigrationOrdersMixin:

    def _migrate_transactions(self):
        """Migrate transactions → Order with batch optimization."""
        from apps.pos.models import Order
        from apps.migration.models import MigrationMapping

        rows = self._get_rows('transactions')
        total_rows = self.job.discovered_data.get('global_counts', {}).get('transactions', 0)
        count = 0
        batch = []
        batch_meta = []  # (source_id, extra_data) for each item in batch
        draft_batch = []
        draft_meta = []
        BATCH_SIZE = 500

        for idx, row in enumerate(rows):
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Track type and contact for payment mapper
            upos_type = safe_str(row.get('type')).lower()
            self.transaction_type_map[source_id] = upos_type
            source_contact = safe_int(row.get('contact_id'))
            if source_contact:
                self.transaction_contact_map[source_id] = source_contact

            existing = self._get_or_create_mapping('TRANSACTION', source_id, 'transactions')
            if existing:
                self.id_maps['TRANSACTION'][source_id] = existing
                continue

            try:
                mapped = TransactionMapper.map_row(
                    row,
                    contact_mapping=self.id_maps['CONTACT'],
                    site_mapping=self.id_maps['SITE'],
                )

                if mapped is None:
                    continue

                order_kwargs = {
                    'organization_id': self.organization_id,
                    'type': mapped['type'],
                    'status': mapped.get('status', 'COMPLETED'),
                    'ref_code': mapped.get('ref_code'),
                    'invoice_number': mapped.get('invoice_number'),
                    'total_amount': mapped.get('total_amount', Decimal('0.00')),
                    'tax_amount': mapped.get('tax_amount', Decimal('0.00')),
                    'discount': mapped.get('discount', Decimal('0.00')),
                    'payment_method': mapped.get('payment_method', 'CASH'),
                    'notes': mapped.get('notes'),
                    'scope': mapped.get('scope', 'INTERNAL'),
                    'created_at': mapped.get('created_at'),
                }

                if mapped.get('contact_id'):
                    order_kwargs['contact_id'] = mapped['contact_id']
                if mapped.get('site_id'):
                    order_kwargs['site_id'] = mapped['site_id']

                batch.append(Order(**order_kwargs))
                batch_meta.append((source_id, TransactionMapper.extra_data(row)))

            except Exception as e:
                # Queue as DRAFT on mapping failure (reuse already-attempted mapped data)
                try:
                    mapped = TransactionMapper.map_row(row, contact_mapping=self.id_maps['CONTACT'], site_mapping=self.id_maps['SITE'])
                    if mapped is None:
                        continue
                    order_kwargs = {
                        'organization_id': self.organization_id,
                        'type': mapped['type'],
                        'status': 'DRAFT',
                        'ref_code': mapped.get('ref_code'),
                        'total_amount': mapped.get('total_amount', Decimal('0.00')),
                        'payment_method': mapped.get('payment_method', 'CASH'),
                        'notes': f"[NEEDS REVIEW] {mapped.get('notes') or ''} | Error: {str(e)}",
                        'scope': 'INTERNAL',
                        'created_at': mapped.get('created_at'),
                    }
                    if mapped.get('contact_id'): order_kwargs['contact_id'] = mapped['contact_id']
                    if mapped.get('site_id'): order_kwargs['site_id'] = mapped['site_id']
                    draft_batch.append(Order(**order_kwargs))
                    draft_meta.append((source_id, {'imported_as_draft': True, 'original_error': str(e)}))
                except Exception as e2:
                    self._log_error(f"Transaction {source_id}: {str(e)} → Draft failed: {str(e2)}")

            # Flush batch
            if len(batch) >= BATCH_SIZE:
                created = Order.objects.bulk_create(batch)
                mappings = []
                for i, obj in enumerate(created):
                    sid, extra = batch_meta[i]
                    self.id_maps['TRANSACTION'][sid] = obj.id
                    mappings.append(MigrationMapping(
                        job=self.job, entity_type='TRANSACTION',
                        source_id=sid, target_id=obj.id,
                        source_table='transactions', extra_data=extra
                    ))
                MigrationMapping.objects.bulk_create(mappings)
                count += len(created)
                batch, batch_meta = [], []
                self._heartbeat(sub_progress=f"{count:,}/{total_rows:,} transactions")

        # Flush remaining normal batch
        if batch:
            created = Order.objects.bulk_create(batch)
            mappings = []
            for i, obj in enumerate(created):
                sid, extra = batch_meta[i]
                self.id_maps['TRANSACTION'][sid] = obj.id
                mappings.append(MigrationMapping(
                    job=self.job, entity_type='TRANSACTION',
                    source_id=sid, target_id=obj.id,
                    source_table='transactions', extra_data=extra
                ))
            MigrationMapping.objects.bulk_create(mappings)
            count += len(created)

        # Flush draft batch
        if draft_batch:
            created = Order.objects.bulk_create(draft_batch)
            mappings = []
            for i, obj in enumerate(created):
                sid, extra = draft_meta[i]
                self.id_maps['TRANSACTION'][sid] = obj.id
                mappings.append(MigrationMapping(
                    job=self.job, entity_type='TRANSACTION',
                    source_id=sid, target_id=obj.id,
                    source_table='transactions', extra_data=extra
                ))
            MigrationMapping.objects.bulk_create(mappings)
            count += len(created)

        self.job.total_transactions = count
        self._heartbeat(sub_progress=f"{count:,} transactions done")
        logger.info(f"Migrated {count} transactions (bulk)")


    def _migrate_sell_lines(self):
        """Migrate transaction_sell_lines → OrderLine with bulk optimization."""
        from apps.pos.models import OrderLine

        rows = self._get_rows('transaction_sell_lines')
        batch = []
        row_data_batch = []
        count = 0

        # Optimization: pre-calculate valid transaction IDs
        valid_tx_ids = set(self.id_maps['TRANSACTION'].keys())

        for row in rows:
            source_id = safe_int(row.get('id'))
            tx_id = safe_int(row.get('transaction_id'))
            if not source_id or tx_id not in valid_tx_ids:
                continue

            if self._get_or_create_mapping('ORDER_LINE', source_id, 'transaction_sell_lines'):
                continue

            try:
                mapped = SellLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['TRANSACTION'],
                    product_mapping=self.id_maps['PRODUCT'],
                )
                if mapped is None:
                    continue

                batch.append(OrderLine(organization_id=self.organization_id, **mapped))
                row_data_batch.append((source_id, row))

                if len(batch) >= 1000:
                    self._bulk_save_lines(batch, row_data_batch, 'transaction_sell_lines')
                    count += len(batch)
                    batch = []
                    row_data_batch = []
                    self._heartbeat(sub_progress=f"{count:,} sell lines")
            except Exception as e:
                self._log_error(f"Sell line {source_id}: {str(e)}")

        if batch:
            self._bulk_save_lines(batch, row_data_batch, 'transaction_sell_lines')
            count += len(batch)

        logger.info(f"Migrated {count} sell lines (bulk)")


    def _migrate_purchase_lines(self):
        """Migrate purchase_lines → OrderLine with bulk optimization."""
        from apps.pos.models import OrderLine

        rows = self._get_rows('purchase_lines')
        batch = []
        row_data_batch = []
        count = 0

        # Optimization: pre-calculate valid transaction IDs
        valid_tx_ids = set(self.id_maps['TRANSACTION'].keys())

        for row in rows:
            source_id = safe_int(row.get('id'))
            tx_id = safe_int(row.get('transaction_id'))
            if not source_id or tx_id not in valid_tx_ids:
                continue

            # Use negative ID to distinguish from sell lines
            if self._get_or_create_mapping('ORDER_LINE', -source_id, 'purchase_lines'):
                continue

            try:
                mapped = PurchaseLineMapper.map_row(
                    row,
                    order_mapping=self.id_maps['TRANSACTION'],
                    product_mapping=self.id_maps['PRODUCT'],
                )
                if mapped is None:
                    continue

                line_obj = OrderLine(organization_id=self.organization_id, **mapped)
                
                batch.append(line_obj)
                row_data_batch.append((-source_id, row))

                if len(batch) >= 1000:
                    self._bulk_save_lines(batch, row_data_batch, 'purchase_lines')
                    count += len(batch)
                    batch = []
                    row_data_batch = []
                    self._heartbeat(sub_progress=f"{count:,} purchase lines")
            except Exception as e:
                self._log_error(f"Purchase line {source_id}: {str(e)}")

        if batch:
            self._bulk_save_lines(batch, row_data_batch, 'purchase_lines')
            count += len(batch)

        logger.info(f"Migrated {count} purchase lines (bulk)")


    def _bulk_save_lines(self, entity_batch, row_batch, table_name):
        """Hepler to perform bulk creation of lines and their mappings."""
        from apps.pos.models import OrderLine
        from apps.migration.models import MigrationMapping
        
        # bulk_create in Postgres returns IDs
        created_objs = OrderLine.objects.bulk_create(entity_batch)
        
        mappings = []
        for i, obj in enumerate(created_objs):
            source_id, original_row = row_batch[i]
            
            extra = {}
            if table_name == 'transaction_sell_lines':
                extra = SellLineMapper.extra_data(original_row)
            else:
                extra = PurchaseLineMapper.extra_data(original_row)

            mappings.append(MigrationMapping(
                job=self.job,
                entity_type='ORDER_LINE',
                source_id=source_id,
                target_id=obj.id,
                source_table=table_name,
                extra_data=extra
            ))
            # Cache in memory (though lines are usually not looked up)
            self.id_maps.setdefault('ORDER_LINE', {})[source_id] = obj.id
        
        MigrationMapping.objects.bulk_create(mappings)

