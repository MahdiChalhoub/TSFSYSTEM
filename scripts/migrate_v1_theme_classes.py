import os
import re

TARGET_DIRS = [
    os.path.abspath('src/app'),
    os.path.abspath('src/components'),
]

# 1. Strip remaining dark variants
STRIP_DARK_PATTERNS = [
    r'\bdark:bg-(slate|gray|zinc|neutral|stone)-[0-9]+(/[0-9]+)?\b',
    r'\bdark:text-(slate|gray|zinc|neutral|stone|white)-[0-9]*(/[0-9]+)?\b',
    r'\bdark:border-(slate|gray|zinc|neutral|stone)-[0-9]+(/[0-9]+)?\b',
    r'\bdark:ring-(slate|gray|zinc|neutral|stone)-[0-9]+(/[0-9]+)?\b',
    r'\bdark:bg-\[[#A-Fa-f0-9]+\]\b',
    r'\bdark:text-white\b',
]

# 2. Map standard classes
MAPPING_PATTERNS = [
    # Backgrounds
    (r'\bbg-white(?!\/)\b', 'bg-app-surface'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-50(?!\/)\b', 'bg-app-bg'),
    (r'\bbg-(slate|gray|zinc|neutral|stone)-100(?!\/)\b', 'bg-app-surface-2'),
    
    # Texts
    (r'\btext-white\b', 'text-app-text'),
    (r'\btext-white/(\d+)\b', r'text-app-text/\1'),
    (r'\btext-white/\[(.*?)\]\b', r'text-app-text/[\1]'),
    (r'\btext-(slate|gray|zinc|neutral|stone)-900(?!\/)\b', 'text-app-text'),
    (r'\btext-(slate|gray|zinc|neutral|stone)-800(?!\/)\b', 'text-app-text'),
    (r'\btext-(slate|gray|zinc|neutral|stone)-600(?!\/)\b', 'text-app-text-muted'),
    (r'\btext-(slate|gray|zinc|neutral|stone)-500(?!\/)\b', 'text-app-text-muted'),
    (r'\btext-(slate|gray|zinc|neutral|stone)-400(?!\/)\b', 'text-app-text-faint'),
    
    # Overlays (white transparent mapped to app-text transparent)
    (r'\bbg-white/(\d+)\b', r'bg-app-text/\1'),
    (r'\bbg-white/\[(.*?)\]\b', r'bg-app-text/[\1]'),
    
    # Borders
    (r'\bborder-white/(\d+)\b', r'border-app-text/\1'),
    (r'\bborder-white/\[(.*?)\]\b', r'border-app-text/[\1]'),
    (r'\bborder-(slate|gray|zinc|neutral|stone)-100(?!\/)\b', 'border-app-border'),
    (r'\bborder-(slate|gray|zinc|neutral|stone)-200(?!\/)\b', 'border-app-border'),
    (r'\bborder-(slate|gray|zinc|neutral|stone)-300(?!\/)\b', 'border-app-border'),
]

compiled_strips = [re.compile(p) for p in STRIP_DARK_PATTERNS]
compiled_maps = [(re.compile(p), r) for p, r in MAPPING_PATTERNS]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    for p in compiled_strips:
        content = p.sub('', content)
        
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
