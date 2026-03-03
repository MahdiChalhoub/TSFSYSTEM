import os
import re

TARGET_DIRS = [
    os.path.abspath('src/app'),
    os.path.abspath('src/components'),
]

MAPPING_PATTERNS = [
    # Backgrounds
    (r'\bbg-(slate|gray|zinc|neutral|stone)-[9]50(?!\/)\b', 'bg-app-bg'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-900(?!\/)\b', 'bg-app-surface'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-800(?!\/)\b', 'bg-app-surface-2'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-[5]0(?!\/)\b', 'bg-app-bg'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-100(?!\/)\b', 'bg-app-surface-2'),

    # Background opacities
    (r'\bbg-(slate|gray|zinc|neutral|stone)-[9]50/(\d+)\b', r'bg-app-bg/\2'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-900/(\d+)\b', r'bg-app-surface/\2'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-800/(\d+)\b', r'bg-app-surface-2/\2'),
]

compiled_maps = [(re.compile(p), r) for p, r in MAPPING_PATTERNS]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
        
    for p, replacement in compiled_maps:
        content = p.sub(replacement, content)
        
    content = re.sub(r' {2,}', ' ', content)
    content = content.replace('className=" "', 'className=""')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    skip_dirs = ['ARCHIVE', 'ui', 'app-theme-engine.css', 'globals.css']
    modified = 0
    
    for target_dir in TARGET_DIRS:
        if not os.path.exists(target_dir):
            continue
            
        for root, dirs, files in os.walk(target_dir):
            if any(s in root for s in skip_dirs):
                continue
                
            for file in files:
                if file.endswith(('.tsx', '.ts')):
                    if process_file(os.path.join(root, file)):
                        modified += 1
                        print(f"Patched: {os.path.join(root, file)}")
                        
    print(f"Migration complete. Modified {modified} files.")

if __name__ == '__main__':
    main()

