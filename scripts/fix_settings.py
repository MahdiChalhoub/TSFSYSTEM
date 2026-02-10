import os

settings_path = '/root/TSFSYSTEM/erp_backend/core/settings.py'
with open(settings_path, 'r') as f:
    lines = f.readlines()

header = [
    'import os\n',
    'from dotenv import load_dotenv\n',
    'load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))\n'
]

# Only inject if not already present
content_str = ''.join(lines)
if 'from dotenv import load_dotenv' not in content_str:
    new_content = header + lines
    with open(settings_path, 'w') as f:
        f.writelines(new_content)
    print('Successfully updated settings.py')
else:
    print('settings.py already has load_dotenv')
