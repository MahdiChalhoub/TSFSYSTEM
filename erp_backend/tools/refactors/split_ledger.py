import ast

def split_file():
    with open("apps/finance/services/ledger_service.py", "r", encoding="utf-8") as f:
        src = f.read()
    
    lines = src.split("\n")
    tree = ast.parse(src)
    
    # Identify imports (top of file)
    import_lines = []
    class_nodes = []
    
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            start = node.lineno - 1
            end = node.end_lineno
            import_lines.append("\n".join(lines[start:end]))
        elif isinstance(node, ast.ClassDef):
            class_nodes.append(node)
            
    header = "\n".join(import_lines)
    header += "\n\nfrom apps.finance.models import JournalEntry, JournalEntryLine, ChartOfAccount, FinancialEvent\n"

    def get_ast_node_source(node):
        start = node.lineno - 1
        if hasattr(node, "decorator_list") and node.decorator_list:
            start = node.decorator_list[0].lineno - 1
            
        c_idx = start - 1
        comments = []
        while c_idx >= 0 and (lines[c_idx].strip().startswith("#") or not lines[c_idx].strip()):
            comments.insert(0, lines[c_idx])
            c_idx -= 1
            if len(comments) > 1 and not comments[0].strip() and not comments[1].strip():
                comments.pop(0)

        node_body = lines[start:node.end_lineno]
        return "\n".join(comments) + "\n" + "\n".join(node_body)

    for node in class_nodes:
        if node.name == "LedgerService":
            ledger_node = node
        elif node.name == "FinancialEventService":
            events_node = node

    methods = {}
    for node in ledger_node.body:
        if isinstance(node, ast.FunctionDef):
            methods[node.name] = get_ast_node_source(node)

    groups = {
        'ledger_core.py': {
            'mixin': 'LedgerCoreMixin',
            'methods': ['create_journal_entry', 'post_journal_entry', 'update_journal_entry', 'reverse_journal_entry', 'recalculate_balances', 'clear_all_data']
        },
        'ledger_coa.py': {
            'mixin': 'LedgerCOAMixin',
            'methods': ['create_linked_account', 'apply_coa_template', 'migrate_coa', 'get_chart_of_accounts', 'get_trial_balance', 'get_profit_loss', 'get_balance_sheet', 'validate_closure', 'get_account_statement']
        }
    }
    
    for name, group in groups.items():
        with open(f"apps/finance/services/{name}", "w", encoding="utf-8") as f:
            f.write(header + "\n\n")
            f.write(f"class {group['mixin']}:\n")
            for m in group['methods']:
                if m in methods:
                    f.write(methods[m] + "\n\n")
                    
    with open("apps/finance/services/ledger_events.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write(get_ast_node_source(events_node) + "\n")
        
    with open("apps/finance/services/ledger_service.py", "w", encoding="utf-8") as f:
        f.write(header + "\n\n")
        f.write("from .ledger_core import LedgerCoreMixin\n")
        f.write("from .ledger_coa import LedgerCOAMixin\n")
        f.write("from .ledger_events import FinancialEventService\n\n")
        f.write("class LedgerService(LedgerCoreMixin, LedgerCOAMixin):\n")
        f.write("    pass\n")

if __name__ == "__main__":
    split_file()
