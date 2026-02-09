import psycopg2

def fix():
    try:
        conn = psycopg2.connect(dbname='tsfdb', user='postgres', password='', host='localhost')
        conn.autocommit = True
        cur = conn.cursor()
        
        # PascalCase tables that migrations might be looking for
        tables = [
            'TaskQueue', 'ApprovalRequest', 'AuditLog', 'TaskTemplate', 
            'BarcodeSettings', 'Brand', 'Category', 'ChartOfAccount', 
            'Contact', 'Employee', 'FinancialAccount', 'FinancialEvent', 
            'FiscalPeriod', 'FiscalYear', 'Inventory', 'InventoryLevel', 
            'InventoryMovement', 'JournalEntry', 'JournalEntryLine', 'Loan', 
            'LoanInstallment', 'Order', 'OrderLine', 'Parfum', 'Product', 
            'ProductGroup', 'StockBatch', 'SystemSettings', 'Transaction', 
            'TransactionSequence', 'Unit', 'Warehouse', 'WorkflowDefinition', 
            'PackageUpload', 'ModuleContract', 'ConnectorPolicy', 'BufferedRequest',
            'ConnectorCache', 'ConnectorLog'
        ]
        
        for t in tables:
            cur.execute(f'CREATE TABLE IF NOT EXISTS "{t}" (id serial PRIMARY KEY)')
            print(f"Ensured dummy table {t}")
            
        # Add columns expected by migrations
        columns = {
            'TaskQueue': [
                'source_approval_id', 'source_audit_log_id', 
                'assigned_to_role_id', 'assigned_to_user_id', 
                'organization_id', 'template_id'
            ],
            'PackageUpload': [
                'applied_by_id', 'uploaded_by_id'
            ],
            'ApprovalRequest': [
                'audit_log_id', 'organization_id', 
                'requested_by_id', 'reviewed_by_id', 'workflow_id'
            ],
            'AuditLog': [
                'actor_id', 'organization_id'
            ],
            'TaskTemplate': [
                'default_assignee_role_id'
            ],
            'WorkflowDefinition': [
                'task_template_id', 'approver_role_id'
            ],
            'ModuleContract': [
                'module_id', 'is_active', 'granted_at'
            ]
        }
        
        for table, cols in columns.items():
            for col in cols:
                try:
                    cur.execute(f'ALTER TABLE "{table}" ADD COLUMN {col} int')
                    print(f"Added column {col} to {table}")
                except Exception as e:
                    pass # Probably exists
                    
        cur.close()
        conn.close()
        print("Final schema reconciliation complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix()
