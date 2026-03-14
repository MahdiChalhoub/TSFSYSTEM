import os
import django
from django.core.management import call_command
from io import StringIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

out = StringIO()
err = StringIO()

try:
    call_command('check', stdout=out, stderr=err)
    print("STDOUT:")
    print(out.getvalue())
    print("STDERR:")
    print(err.getvalue())
except Exception as e:
    print("ERROR DURING CHECK:")
    print(str(e))
    print("STDOUT:")
    print(out.getvalue())
    print("STDERR:")
    print(err.getvalue())
