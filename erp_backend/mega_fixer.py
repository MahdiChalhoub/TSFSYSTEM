import os
import psycopg2

MODEL_FILES = [
    'apps/core/models.py',
    'apps/crm/models.py',
    'apps/finance/models.py',
    'apps/hr/models.py',
    'apps/inventory/models.py',
    'apps/mcp/models.py',
    'apps/packages/models.py',
    'apps/pos/models.py',
    'erp/connector_models.py',
    'erp/models.py'
]

def fix_models():
    for path in MODEL_FILES:
        if not os.path.exists(path):
            print(f"Skipping {path} (not found)")
            continue
            
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 1. Fix datetime auto_now fields that cause migration prompts
        content = content.replace('models.DateTimeField(auto_now_add=True)', 'models.DateTimeField(auto_now_add=True, null=True, blank=True)')
        content = content.replace('models.DateTimeField(auto_now=True)', 'models.DateTimeField(auto_now=True, null=True, blank=True)')
        content = content.replace('models.DateTimeField()', 'models.DateTimeField(null=True, blank=True)')
        content = content.replace('models.DateField()', 'models.DateField(null=True, blank=True)')
        
        # 2. pos.OrderLine fix
        if 'apps/pos/models.py' in path:
            content = content.replace("db_table = 'orderline'", "db_table = 'pos_orderline'")
            
        # 3. finance fixes
        if 'apps/finance/models.py' in path:
            content = content.replace("contact = models.ForeignKey('crm.Contact', on_delete=models.PROTECT)", "contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)")
            content = content.replace("account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT)", "account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True)")

        # 4. Connector specific fixes (if not already done)
        if 'connector_models.py' in path:
            replacements = {
                'target_module = models.CharField(max_length=100)': 'target_module = models.CharField(max_length=100, null=True, blank=True)',
                'target_endpoint = models.CharField(max_length=255)': 'target_endpoint = models.CharField(max_length=255, null=True, blank=True)',
                'target_endpoint = models.TextField()': 'target_endpoint = models.TextField(null=True, blank=True)',
                'payload = models.JSONField()': 'payload = models.JSONField(null=True, blank=True)',
                'response_data = models.JSONField()': 'response_data = models.JSONField(null=True, blank=True)',
                'cache_key = models.CharField(max_length=255, unique=True)': 'cache_key = models.CharField(max_length=255, unique=True, null=True, blank=True)',
                'operation = models.CharField(max_length=10)': 'operation = models.CharField(max_length=10, null=True, blank=True)',
                'module_state = models.CharField(max_length=20)': 'module_state = models.CharField(max_length=20, null=True, blank=True)',
                'decision = models.CharField(max_length=20, choices=DECISION_CHOICES)': 'decision = models.CharField(max_length=20, choices=DECISION_CHOICES, null=True, blank=True)',
            }
            for old, new in replacements.items():
                content = content.replace(old, new)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")

def rename_db_tables():
    try:
        conn = psycopg2.connect(dbname="tsfdb", user="postgres", password="", host="localhost")
        conn.autocommit = True
        cur = conn.cursor()
        
        renames = [
            ('order', 'pos_order'),
            ('orderline', 'pos_orderline'),
            ('PackageUpload', 'packageupload'), 
        ]
        
        for old, new in renames:
            print(f"Processing rename '{old}' -> '{new}'...")
            try:
                # Check if 'new' exists
                cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = '{new}'")
                if cur.fetchone():
                    print(f"  '{new}' already exists. Dropping '{old}' if it exists as duplicate...")
                    cur.execute(f'DROP TABLE IF EXISTS "{old}" CASCADE')
                else:
                    cur.execute(f'ALTER TABLE "{old}" RENAME TO "{new}"')
                    print(f"  Renamed '{old}' to '{new}'.")
            except Exception as e:
                print(f"  Note: {e}")

        cur.close()
        conn.close()
        print("DB renames complete.")
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    fix_models()
    rename_db_tables()
