import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from erp.services import BarcodeService
output = BarcodeService.generate_base64_image('1234567890128')
print("SUCCESS!" if str(output).startswith('data:image/png;base64,') else f"FAILED: {output}")
