import os
import glob
import re

TARGET_DIR = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)"
files = glob.glob(f"{TARGET_DIR}/**/*.tsx", recursive=True)

fixed_count = 0

for file_path in files:
    if "node_modules" in file_path or ".next" in file_path: continue
    basename = os.path.basename(file_path)
    if basename not in ["page.tsx", "client.tsx", "PageClient.tsx"] and not basename.endswith("ListView.tsx") and not basename.endswith("page.tsx"):
        continue

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content

    # 1. Fix page containers
    patterns_to_replace = [
        (r'className="max-w-7xl mx-auto p-4 md:p-8"', 'className="page-container"'),
        (r'className="max-w-7xl mx-auto p-4"', 'className="page-container"'),
        (r'className="p-4 md:p-8 max-w-\[1600px\] mx-auto pb-24"', 'className="page-container"'),
        (r'className="p-8 max-w-\[1600px\] mx-auto pb-24"', 'className="page-container"'),
        (r'className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto"', 'className="page-container"'),
        (r'className="p-4 md:p-6 space-y-6"', 'className="page-container"'),
        (r'className="p-6 space-y-6"', 'className="page-container"'),
        (r'className="p-4 space-y-6"', 'className="page-container"'),
        (r'className="p-4 max-w-7xl mx-auto space-y-6"', 'className="page-container"'),
        (r'className="space-y-6 p-4 md:p-8 pt-6"', 'className="page-container"'),
        (r'className="flex-1 space-y-6 p-4 md:p-8 pt-6"', 'className="page-container"'),
    ]
    for p, repl in patterns_to_replace:
        new_content = re.sub(p, repl, new_content)

    # 2. Fix standardize H1 tags
    new_content = re.sub(r'(<h1[^>]*?className="[^"]*)text-[2345]xl\s+font-(?:bold|black|semibold)(\s+text-gray-\d{3})?([^"]*")', r'\1page-header-title \3', new_content)
    new_content = re.sub(r'(<h1[^>]*?className="[^"]*)text-3xl\s+font-bold\s+tracking-tight([^"]*")', r'\1page-header-title \2', new_content)

    # Clean up double spaces efficiently (optional)
    new_content = new_content.replace('page-header-title  "', 'page-header-title"')

    # 3. Fix standard cards safely
    new_content = new_content.replace('bg-white shadow-sm rounded-lg', 'card-section')
    new_content = new_content.replace('bg-white shadow rounded-lg', 'card-section')
    new_content = new_content.replace('bg-white shadow-md rounded-lg', 'card-section')
    new_content = new_content.replace('bg-white rounded-2xl shadow-sm', 'card-section')
    new_content = new_content.replace('bg-white rounded-lg shadow', 'card-section')
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        fixed_count += 1

print(f"Auto-fixed {fixed_count} files to use uniform design tokens.")
