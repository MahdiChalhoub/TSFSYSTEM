import os
import django
from django.conf import settings
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def list_urls(patterns, prefix=''):
    for pattern in patterns:
        if hasattr(pattern, 'url_patterns'):
            list_urls(pattern.url_patterns, prefix + str(pattern.pattern))
        else:
            print(f"{prefix}{str(pattern.pattern)} -> {pattern.name}")

resolver = get_resolver()
list_urls(resolver.url_patterns)
