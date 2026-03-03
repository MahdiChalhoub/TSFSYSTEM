import os
import re

TARGET_DIR = os.path.abspath('src')

MAPPING_PATTERNS = [
    # ---- 1. ERADICATE ALL HARDCODED LIGHT BACKGROUNDS ----
    (re.compile(r'\bbg-white(?!\/)\b'), 'bg-app-surface'),
    (re.compile(r'\bbg-(slate|gray|zinc|neutral|stone)-50(?!\/)\b'), 'bg-app-bg'),
    (re.compile(r'\bbg-(slate|gray|zinc|neutral|stone)-100(?!\/)\b'), 'bg-app-surface-2'),
    (re.compile(r'\bbg-(slate|gray|zinc|neutral|stone)-200(?!\/)\b'), 'bg-app-border'),
    
    # ---- 2. ERADICATE ALL HARDCODED DARK TEXTS ----
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-9[05]0(?!\/)\b'), 'text-app-text'),
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-800(?!\/)\b'), 'text-app-text'),
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-700(?!\/)\b'), 'text-app-text-muted'),
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-600(?!\/)\b'), 'text-app-text-muted'),
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-500(?!\/)\b'), 'text-app-text-faint'),
    (re.compile(r'\btext-(slate|gray|zinc|neutral|stone)-400(?!\/)\b'), 'text-app-text-faint'),
    
    # ---- 3. ERADICATE ALL HARDCODED LIGHT BORDERS ----
    (re.compile(r'\bborder-(slate|gray|zinc|neutral|stone)-100(?!\/)\b'), 'border-app-border'),
    (re.compile(r'\bborder-(slate|gray|zinc|neutral|stone)-200(?!\/)\b'), 'border-app-border'),
    (re.compile(r'\bborder-(slate|gray|zinc|neutral|stone)-300(?!\/)\b'), 'border-app-border'),
    
    # ---- 4. ERADICATE ALL HARDCODED DIVIDERS ----
    (re.compile(r'\bdivide-(slate|gray|zinc|neutral|stone)-100(?!\/)\b'), 'divide-app-border'),
    (re.compile(r'\bdivide-(slate|gray|zinc|neutral|stone)-200(?!\/)\b'), 'divide-app-border'),
    
    # ---- 5. STANDARDIZE SHADOWS (To prevent them from being jarring in dark mode) ----
    # Replace hard shadows with our unified shadow style
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
        
    for pattern, replacement in MAPPING_PATTERNS:
        content = pattern.sub(replacement, content)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    skip_dirs = ['ARCHIVE', 'ui']
    modified = 0
    total_files = 0
    
    for root, dirs, files in os.walk(TARGET_DIR):
        if any(s in root for s in skip_dirs):
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                total_files += 1
                if process_file(os.path.join(root, file)):
                    modified += 1
                    
    print(f"HYPER AUDIT COMPLETE. Scanned {total_files} files.")
    print(f"Successfully reprogrammed {modified} files to native V2 Theme engine.")

if __name__ == '__main__':
    main()

