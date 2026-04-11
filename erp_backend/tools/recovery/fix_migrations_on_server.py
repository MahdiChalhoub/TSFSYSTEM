import os
import re

apps_dir = '/root/TSFSYSTEM/erp_backend/apps'
erp_dir = '/root/TSFSYSTEM/erp_backend/erp'

def fix_migration_content(content):
    # Only replace .organization' when used as a field name in migrations
    # Handle fields=[.organization'
    content = content.replace("fields=[.organization'", "fields=[.organization'")
    # Handle model_name='...', name=.organization'
    content = re.sub(r"(model_name='[^']+',\s+name=).organization'", r"\1.organization'", content)
    # Handle (.organization', models.ForeignKey(...)) in AddField/CreateModel
    content = re.sub(r"\(.organization',\s+models\.ForeignKey", r"(.organization', models.ForeignKey", content)
    
    return content

processed = 0
for root_dir in [apps_dir, erp_dir]:
    for root, dirs, files in os.walk(root_dir):
        if 'migrations' in root:
            for f in files:
                if f.endswith('.py') and f != '__init__.py':
                    path = os.path.join(root, f)
                    with open(path, 'r') as file:
                        content = file.read()
                    
                    new_content = fix_migration_content(content)
                    # Add pattern for Index(fields=[.organization'
                    new_content = new_content.replace('Index(fields=[.organization"', 'Index(fields=[.organization"')
                    new_content = new_content.replace("Index(fields=[.organization'", "Index(fields=[.organization'")
                    
                    if new_content != content:
                        print(f"Fixing {path}")
                        with open(path, 'w') as file:
                            file.write(new_content)
                        processed += 1

print(f"Total processed: {processed}")
