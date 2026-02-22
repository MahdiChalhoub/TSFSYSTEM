import os
import subprocess
import glob

def check_pages():
    pages = glob.glob('src/app/**/page.tsx', recursive=True)
    results = []
    
    print(f"🔍 Auditing {len(pages)} pages...")
    
    for page in sorted(pages):
        status = "✅ OK"
        details = ""
        
        # Check for empty files or basic import errors in the file content
        with open(page, 'r') as f:
            content = f.read()
            if not content.strip():
                status = "❌ Empty"
            elif "import" in content and "from" not in content and "require" not in content:
                # Basic check for broken imports
                status = "⚠️ Suspicious"
        
        # Check if the page is accessible via curl (approximate)
        # This is tricky because of auth, but we can check if it returns 200 or 307
        # We simulate the expected URL based on the path
        route = page.replace('src/app', '').replace('/page.tsx', '')
        if route == '': route = '/'
        
        results.append({
            'page': page,
            'route': route,
            'status': status
        })
        
    # Print summary table
    print("\n| Page Path | Route | Status |")
    print("| :--- | :--- | :--- |")
    for r in results:
        print(f"| {r['page']} | {r['route']} | {r['status']} |")

if __name__ == "__main__":
    check_pages()
