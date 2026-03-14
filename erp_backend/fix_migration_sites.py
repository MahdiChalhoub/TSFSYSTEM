
import os
import sys
import django
from decimal import Decimal

# Set up Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.migration.models import MigrationJob, MigrationMapping
from apps.inventory.models import Warehouse, Inventory
from apps.pos.models import Order
from apps.migration.parsers import SQLDumpParser

def run_fix():
    job = MigrationJob.objects.get(id=12)
    org_id = job.organization_id
    sql_path = "/app/media/saas/migration/2026-02/a2620838744e_u739151801_dataPOS.sql"
    
    # In docker, path might be different. But the shell command will run it in docker.
    # So I use the internal path.
    parser = SQLDumpParser(sql_path)
    parser.parse()
    
    print(f"--- STEP 1: FIXING SITE MAPPINGS FOR JOB 12 ---")
    loc_rows = list(parser.stream_rows('business_locations', business_id=job.source_business_id))
    
    id_map = {} # source_id -> target_id
    
    for row in loc_rows:
        sid = int(row.get('id'))
        name = row.get('name')
        
        # Check if a warehouse with this name already exists for the org
        w = Warehouse.objects.filter(organization_id=org_id, name=name).first()
        if not w:
            print(f"Creating Warehouse: {name}")
            w = Warehouse.objects.create(
                organization_id=org_id,
                name=name,
                code=row.get('location_id') or f"LOC-{sid}",
                location_type='BRANCH',
                is_active=True
            )
        
        # Save mapping for Job 12
        mapping, created = MigrationMapping.objects.get_or_create(
            job=job,
            entity_type='SITE',
            source_id=sid,
            defaults={
                'target_id': w.id,
                'source_table': 'business_locations',
                'extra_data': {'name': name}
            }
        )
        id_map[sid] = w.id
        print(f"Mapped Site {sid} ({name}) -> TSF {w.id}")

    print(f"--- STEP 2: RE-DISTRIBUTING SALES BY SITE ---")
    # We query all transactions from SQL to get the correct location_id
    txn_rows = parser.stream_rows('transactions', business_id=job.source_business_id)
    
    # Build target_id -> source_id map from existing mappings
    order_mappings = MigrationMapping.objects.filter(job=job, entity_type='TRANSACTION').values('source_id', 'target_id')
    source_to_order = {m['source_id']: m['target_id'] for m in order_mappings}
    
    updated_orders = 0
    for row in txn_rows:
        sid = int(row.get('id'))
        loc_id = int(row.get('location_id'))
        
        order_id = source_to_order.get(sid)
        target_site_id = id_map.get(loc_id)
        
        if order_id and target_site_id:
            Order.objects.filter(id=order_id).update(site_id=target_site_id, scope='INTERNAL')
            updated_orders += 1
            if updated_orders % 5000 == 0:
                print(f"Updated {updated_orders} orders...")

    print(f"Total orders re-distributed: {updated_orders}")

    print(f"--- STEP 3: MIGRATING STOCK LEVELS ---")
    stock_rows = parser.stream_rows('variation_location_details')
    
    # We need product mappings
    prod_mappings = MigrationMapping.objects.filter(job=job, entity_type='PRODUCT').values('source_id', 'target_id')
    source_to_prod = {m['source_id']: m['target_id'] for m in prod_mappings}
    
    stock_count = 0
    for row in stock_rows:
        pid = int(row.get('product_id'))
        loc_id = int(row.get('location_id'))
        qty = Decimal(row.get('qty_available') or 0)
        
        target_prod = source_to_prod.get(pid)
        target_wh = id_map.get(loc_id)
        
        if target_prod and target_wh:
            Inventory.objects.update_or_create(
                organization_id=org_id,
                product_id=target_prod,
                warehouse_id=target_wh,
                variant=None,
                defaults={'quantity': qty}
            )
            stock_count += 1
            if stock_count % 1000 == 0:
                print(f"Migrated {stock_count} stock records...")

    print(f"Total stock records migrated: {stock_count}")
    job.total_inventory = stock_count
    job.save()

if __name__ == "__main__":
    run_fix()
