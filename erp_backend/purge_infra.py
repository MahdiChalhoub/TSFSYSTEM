import os
import shutil

def purge_migrations(start_path):
    print(f"Purging migrations and pycache starting from {start_path}")
    count_migrations = 0
    count_pycache = 0
    
    for root, dirs, files in os.walk(start_path):
        # 1. Delete migration files (except __init__.py)
        if os.path.basename(root) == 'migrations':
            for file in files:
                if file != '__init__.py' and file.endswith('.py'):
                    full_path = os.path.join(root, file)
                    try:
                        os.remove(full_path)
                        count_migrations += 1
                        print(f"  Removed: {full_path}")
                    except Exception as e:
                        print(f"  Failed: {full_path} ({e})")
        
        # 2. Delete __pycache__
        if '__pycache__' in dirs:
            pycache_path = os.path.join(root, '__pycache__')
            try:
                shutil.rmtree(pycache_path)
                count_pycache += 1
                print(f"  Removed pycache: {pycache_path}")
            except Exception as e:
                print(f"  Failed pycache: {pycache_path} ({e})")
                
    print(f"\nDone! Purged {count_migrations} migrations and {count_pycache} pycache dirs.")

if __name__ == "__main__":
    purge_migrations('.')
