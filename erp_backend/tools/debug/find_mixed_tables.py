import os
import re

def find_mixed_case_db_tables(root_dir):
    pattern = re.compile(r"db_table\s*=\s*['\"]([^'\"]+)['\"]")
    results = []
    
    for root, dirs, files in os.walk(root_dir):
        if 'venv' in dirs:
            dirs.remove('venv')
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        matches = pattern.findall(content)
                        for table in matches:
                            if any(c.isupper() for c in table):
                                results.append((path, table))
                except Exception as e:
                    print(f"Error reading {path}: {e}")
                    
    return results

if __name__ == "__main__":
    mixed_tables = find_mixed_case_db_tables('.')
    if mixed_tables:
        print("Found mixed-case db_table definitions:")
        for path, table in mixed_tables:
            print(f" - {path}: {table}")
    else:
        print("No mixed-case db_table definitions found.")
