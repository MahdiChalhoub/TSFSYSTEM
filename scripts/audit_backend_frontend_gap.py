#!/usr/bin/env python3
"""
Backend to Frontend Coverage Audit
===================================
Scans ALL backend routes and checks if frontend pages exist.
"""

import os
import json
from pathlib import Path

# Base paths
BACKEND_ROOT = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/apps")
FRONTEND_ROOT = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)")

def find_all_viewsets():
    """Find all Django viewsets and their routes"""
    viewsets = {}

    for app_dir in BACKEND_ROOT.iterdir():
        if not app_dir.is_dir() or app_dir.name.startswith('_'):
            continue

        urls_file = app_dir / "urls.py"
        views_file = app_dir / "views.py"

        if urls_file.exists():
            app_name = app_dir.name
            try:
                content = urls_file.read_text()

                # Extract ViewSet registrations
                lines = content.split('\n')
                routes = []
                for line in lines:
                    if 'router.register' in line:
                        # Extract route path
                        if "r'" in line:
                            route = line.split("r'")[1].split("'")[0]
                            routes.append(route)
                        elif 'r"' in line:
                            route = line.split('r"')[1].split('"')[0]
                            routes.append(route)

                if routes:
                    viewsets[app_name] = routes

            except Exception as e:
                print(f"Error reading {urls_file}: {e}")

    return viewsets

def find_frontend_pages():
    """Find all frontend pages"""
    pages = []

    for root, dirs, files in os.walk(FRONTEND_ROOT):
        for file in files:
            if file in ['page.tsx', 'page.ts', 'page.jsx', 'page.js']:
                full_path = Path(root) / file
                relative = full_path.relative_to(FRONTEND_ROOT)
                route = '/' + str(relative.parent).replace('\\', '/')
                pages.append(route)

    return sorted(pages)

def main():
    print("=" * 80)
    print("BACKEND TO FRONTEND COVERAGE AUDIT")
    print("=" * 80)
    print()

    # Scan backend
    print("📊 Scanning backend routes...")
    viewsets = find_all_viewsets()

    total_routes = sum(len(routes) for routes in viewsets.values())
    print(f"Found {len(viewsets)} apps with {total_routes} routes")
    print()

    # Scan frontend
    print("📊 Scanning frontend pages...")
    frontend_pages = find_frontend_pages()
    print(f"Found {len(frontend_pages)} frontend pages")
    print()

    # Analysis
    print("=" * 80)
    print("BACKEND ROUTES vs FRONTEND PAGES")
    print("=" * 80)
    print()

    missing_pages = []

    for app_name, routes in sorted(viewsets.items()):
        print(f"\n📦 {app_name.upper()} Module")
        print("-" * 80)

        for route in routes:
            # Expected frontend paths
            frontend_path_list = f"/{app_name}/{route}"
            frontend_path_detail = f"/{app_name}/{route}/[id]"
            frontend_path_new = f"/{app_name}/{route}/new"

            has_list = frontend_path_list in frontend_pages
            has_detail = frontend_path_detail in frontend_pages
            has_new = frontend_path_new in frontend_pages

            status_list = "✅" if has_list else "❌"
            status_detail = "✅" if has_detail else "❌"
            status_new = "✅" if has_new else "❌"

            print(f"  Route: /{app_name}/{route}/")
            print(f"    {status_list} List page:   {frontend_path_list}")
            print(f"    {status_detail} Detail page: {frontend_path_detail}")
            print(f"    {status_new} Create page: {frontend_path_new}")

            if not has_list:
                missing_pages.append(f"{frontend_path_list} (LIST)")
            if not has_detail:
                missing_pages.append(f"{frontend_path_detail} (DETAIL)")
            if not has_new:
                missing_pages.append(f"{frontend_path_new} (CREATE)")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Backend routes: {total_routes}")
    print(f"Frontend pages: {len(frontend_pages)}")
    print(f"Missing pages: {len(missing_pages)}")
    print(f"Coverage: {((len(frontend_pages) / (total_routes * 3)) * 100):.1f}%")

    if missing_pages:
        print("\n⚠️  MISSING FRONTEND PAGES:")
        for page in sorted(missing_pages):
            print(f"  • {page}")

    # Output JSON for automated processing
    output = {
        "backend_routes": viewsets,
        "frontend_pages": frontend_pages,
        "missing_pages": missing_pages,
        "coverage_percent": (len(frontend_pages) / (total_routes * 3)) * 100 if total_routes > 0 else 0
    }

    output_file = Path("/root/.gemini/antigravity/scratch/TSFSYSTEM/BACKEND_FRONTEND_GAP.json")
    output_file.write_text(json.dumps(output, indent=2))
    print(f"\n📄 Full report saved to: {output_file}")

if __name__ == "__main__":
    main()
