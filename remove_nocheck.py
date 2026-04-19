import os
import glob
for root, dirs, files in os.walk('src/app'):
    if '(saas)' in root or 'settings' in root:
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts'):
                path = os.path.join(root, f)
                with open(path, 'r') as file:
                    content = file.read()
                if '// @ts-nocheck\n' in content:
                    print(f"Fixing {path}")
                    with open(path, 'w') as file:
                        file.write(content.replace('// @ts-nocheck\n', ''))
