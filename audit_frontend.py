import os
import glob
import re

TARGET_DIR = "/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)"

REQUIRED_CLASSES = {
    "page-container": "Missing standard page container",
    "page-header-title": "Missing standard header typography",
}

PREMIUM_CLASSES = ["card-premium", "card-section", "card-kpi"]

files = glob.glob(f"{TARGET_DIR}/**/*.tsx", recursive=True)

issues = []

for file_path in files:
    if "node_modules" in file_path or ".next" in file_path:
        continue
    
    # We only care about page.tsx, layout.tsx, or PageClient.tsx
    basename = os.path.basename(file_path)
    if basename not in ["page.tsx", "client.tsx", "PageClient.tsx"] and not basename.endswith("ListView.tsx"):
        continue
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Check if file has any UI rendering (return <...>)
    if "return (" not in content and "return <" not in content:
        continue
        
    file_issues = []
    
    if "page-container" not in content:
        # Check if it has a main div that should be page-container
        if re.search(r'className="[^"]*(p-\d+|px-\d+|max-w-|mx-auto)[^"]*"', content):
            file_issues.append("Uses hardcoded padding/margins instead of page-container")
            
    if "page-header-title" not in content and "<h1" in content:
        file_issues.append("Uses <h1 without page-header-title")
        
    if "bg-white" in content and "shadow" in content and not any(cls in content for cls in PREMIUM_CLASSES):
        file_issues.append("Uses ad-hoc styling for cards instead of card-premium or card-section")
        
    if "rounded-" in content and not any(cls in content for cls in PREMIUM_CLASSES + ["rounded-full", "rounded-md"]):
        # A lot of hardcoded rounded-2xl or rounded-xl might be present instead of standard classes
        # This is a soft warning
        pass

    if file_issues:
        rel_path = os.path.relpath(file_path, TARGET_DIR)
        issues.append((rel_path, file_issues))

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/frontend_audit_output.txt", "w") as f:
    for rel_path, file_issues in sorted(issues):
        f.write(f"{rel_path}:\n")
        for i in file_issues:
            f.write(f"  - {i}\n")

print(f"Audit complete. Found {len(issues)} non-compliant files.")
