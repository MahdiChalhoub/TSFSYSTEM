import os
import re

TARGET_DIR = os.path.abspath('src')

def search_hardcoded_styles():
    patterns = {
        'bg-white': re.compile(r'\bbg-white(?!\/)\b'),
        'bg-gray': re.compile(r'\bbg-gray-\d{2,3}(?!\/)\b'),
        'bg-slate': re.compile(r'\bbg-slate-\d{2,3}(?!\/)\b'),
        'text-gray': re.compile(r'\btext-gray-\d{2,3}(?!\/)\b'),
        'text-slate': re.compile(r'\btext-slate-\d{2,3}(?!\/)\b'),
        'border-gray': re.compile(r'\bborder-gray-\d{2,3}(?!\/)\b'),
        'border-slate': re.compile(r'\bborder-slate-\d{2,3}(?!\/)\b'),
        'shadow': re.compile(r'\bshadow-(sm|md|lg|xl|2xl)\b')
    }
    
    results = {key: 0 for key in patterns}
    file_matches = []
    
    for root, _, files in os.walk(TARGET_DIR):
        if 'ARCHIVE' in root or 'ui' in root:
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                file_has_match = False
                for key, pattern in patterns.items():
                    matches = pattern.findall(content)
                    if matches:
                        results[key] += len(matches)
                        file_has_match = True
                
                if file_has_match:
                    file_matches.append(filepath.replace(TARGET_DIR, 'src'))

    print("--- DEEP THEME AUDIT RESULTS ---")
    for key, count in results.items():
        if count > 0:
            print(f"Found {count} instances of {key} pattern")
            
    print(f"\nFiles needing manual attention: {len(file_matches)}")
    if len(file_matches) > 0:
        print("\nTop 20 files with remaining hardcoded classes:")
        for file in file_matches[:20]:
            print(f" - {file}")

if __name__ == '__main__':
    search_hardcoded_styles()
