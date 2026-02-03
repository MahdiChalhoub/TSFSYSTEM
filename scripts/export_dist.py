
import os
import shutil
import zipfile
import json
from django.conf import settings

# Manual setup since we are running as script
BASE_DIR = r'c:\tsfci'
APPS_DIR = os.path.join(BASE_DIR, 'erp_backend', 'apps')
DIST_DIR = os.path.join(BASE_DIR, 'dist')

def export_modules():
    if not os.path.exists(DIST_DIR):
        os.makedirs(DIST_DIR)
        
    print(f"📦 Exporting modules from {APPS_DIR} to {DIST_DIR}...")
    
    exported_count = 0
    
    for item in os.listdir(APPS_DIR):
        if item == 'core':
            continue
            
        module_path = os.path.join(APPS_DIR, item)
        if not os.path.isdir(module_path):
            continue
            
        # Check for manifest
        manifest_path = os.path.join(module_path, 'manifest.json')
        if not os.path.exists(manifest_path):
            print(f"⚠️ Skipping {item}: No manifest.json found.")
            continue
            
        try:
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)
                version = manifest.get('version', '1.0.0')
                
            # Create Zip
            zip_name = f"{item}_{version}.modpkg.zip"
            zip_path = os.path.join(DIST_DIR, zip_name)
            
            print(f"  > Packaging {item} v{version}...")
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(module_path):
                    for file in files:
                        # Don't include pycache or git files
                        if '__pycache__' in root or '.git' in root:
                            continue
                            
                        file_path = os.path.join(root, file)
                        # Archive name should be relative to module root to create FLAT structure
                        # expected by the new ModuleManager logic? 
                        # WAIT. My logic in module_manager.py (lines 138-147) handles both.
                        # But for safety, let's keep the structure clean.
                        # If I write relative to module_path, it's flat.
                        arcname = os.path.relpath(file_path, module_path)
                        zipf.write(file_path, arcname)
                        
            print(f"  ✅ Created {zip_name}")
            exported_count += 1
            
        except Exception as e:
            print(f"  ❌ Failed to export {item}: {str(e)}")

    print(f"\n🎉 Export Complete. {exported_count} modules ready in {DIST_DIR}")

if __name__ == '__main__':
    export_modules()
