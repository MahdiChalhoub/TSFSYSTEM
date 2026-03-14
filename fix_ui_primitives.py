import os
import glob
import re

TARGET_DIR = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/ui"
files = glob.glob(f"{TARGET_DIR}/**/*.tsx", recursive=True)

fixed_count = 0

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content

    # Replace rounded-md and rounded-lg appropriately
    if "card.tsx" in file_path or "dialog.tsx" in file_path or "sheet.tsx" in file_path:
        new_content = re.sub(r'\brounded-lg\b', 'rounded-2xl', new_content)
    else:
        new_content = re.sub(r'\brounded-md\b', 'rounded-xl', new_content)
        new_content = re.sub(r'\brounded-sm\b', 'rounded-lg', new_content)

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        fixed_count += 1

print(f"Auto-fixed {fixed_count} UI primitive files.")
