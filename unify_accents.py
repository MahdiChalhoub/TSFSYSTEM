import os
import glob
import re

TARGET_DIRS = [
    "/root/.gemini/antigravity/scratch/TSFSYSTEM/src"
]

files = []
for d in TARGET_DIRS:
    files.extend(glob.glob(f"{d}/**/*.tsx", recursive=True))

fixed_count = 0

color_pattern = re.compile(r'\b(text|bg|border|ring|divide|shadow|from|via|to|fill|stroke)-(blue|teal|cyan)-([0-9]{2,3})(/\d{1,2}|/\[[^\]]+\])?\b')

def replace_color(match):
    prefix = match.group(1)
    weight = match.group(3)
    opacity = match.group(4) if match.group(4) else ""
    return f"{prefix}-emerald-{weight}{opacity}"

for file_path in files:
    if "node_modules" in file_path or ".next" in file_path: continue

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = color_pattern.sub(replace_color, content)

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        fixed_count += 1

print(f"Auto-fixed {fixed_count} files replacing ad-hoc accents (blue/teal/cyan) with standard emerald token.")
