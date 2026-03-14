
import os
import sys
import django
from decimal import Decimal
from django.utils import timezone

# Set up Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.migration.models import MigrationJob, MigrationMapping
from apps.inventory.models import Warehouse, StockTransferOrder, StockTransferLine
from apps.migration.parsers import SQLDumpParser
from apps.migration.mappers import safe_int, safe_decimal, safe_str

def run_transfers():
    job = MigrationJob.objects.get(id=12)
    org_id = job.organization_id
    sql_path = "/app/media/saas/migration/2026-02/a2620838744e_u739151801_dataPOS.sql"
    parser = SQLDumpParser(sql_path)
    parser.parse()
    
    mapping_job_id = 12
    # Load site maps
    site_mappings = MigrationMapping.objects.filter(job_id=mapping_job_id, entity_type='SITE')
    id_map = {m.source_id: m.target_id for m in site_mappings}
    
    # Load product maps
    prod_mappings = MigrationMapping.objects.filter(job_id=mapping_job_id, entity_type='PRODUCT').values('source_id', 'target_id')
    source_to_prod = {m['source_id']: m['target_id'] for m in prod_mappings}

    # Pre-index sell lines by transaction_id for speed
    print("Indexing transfer lines...")
    lines_by_tx = {}
    for line in parser.stream_rows('transaction_sell_lines'):
        tx_id = safe_int(line.get('transaction_id'))
        if tx_id:
            lines_by_tx.setdefault(tx_id, []).append(line)

    print(f"--- MIGRATING STOCK TRANSFERS ---")
    rows = parser.stream_rows('transactions', business_id=job.source_business_id)
    
    count = 0
    line_count = 0
    for row in rows:
        tx_type = safe_str(row.get('type')).lower()
        if tx_type not in ('purchase_transfer', 'sell_transfer'):
            continue
            
        source_id = safe_int(row.get('id'))
        # Check if already exists for THIS JOB
        if MigrationMapping.objects.filter(job=job, entity_type='TRANSACTION', source_id=source_id, extra_data__contains={'is_stock_transfer': True}).exists():
            continue
            
        try:
            loc_id = safe_int(row.get('location_id'))
            parent_id = safe_int(row.get('transfer_parent_id'))
            
            from_wh_id = id_map.get(loc_id)
            if not from_wh_id: continue
            
            from_wh_obj = Warehouse.objects.get(id=from_wh_id)
            to_wh_obj = from_wh_obj # Default fallback
            
            transfer = StockTransferOrder.objects.create(
                organization_id=org_id,
                reference=safe_str(row.get('ref_no')) or f"TRF-{source_id}",
                date=row.get('transaction_date', '')[:10] or timezone.now().date().isoformat(),
                from_warehouse=from_wh_obj,
                to_warehouse=to_wh_obj,
                reason=f"Imported from {tx_type}",
                notes=safe_str(row.get('additional_notes')),
                is_posted=False
            )
            
            MigrationMapping.objects.create(
                job=job, entity_type='TRANSACTION', source_id=source_id, 
                target_id=transfer.id, source_table='transactions',
                extra_data={'original_type': tx_type, 'is_stock_transfer': True}
            )
            
            # Migrate Lines
            tx_lines = lines_by_tx.get(source_id, [])
            for l in tx_lines:
                pid = safe_int(l.get('product_id'))
                target_prod_id = source_to_prod.get(pid)
                if not target_prod_id: continue
                
                from apps.inventory.models import Product
                prod_obj = Product.objects.get(id=target_prod_id)
                
                StockTransferLine.objects.create(
                    order=transfer,
                    product=prod_obj,
                    qty_transferred=safe_decimal(l.get('quantity')),
                    from_warehouse=from_wh_obj,
                    to_warehouse=to_wh_obj,
                )
                line_count += 1
            
            count += 1
            if count % 100 == 0:
                print(f"Migrated {count} transfers and {line_count} lines...")
        except Exception as e: 
            print(f"Error transfer {source_id}: {e}")

    print(f"COMPLETED: Migrated {count} transfers and {line_count} lines.")

if __name__ == "__main__":
    run_transfers()
