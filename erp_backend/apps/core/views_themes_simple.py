"""
Simple Theme Views - Minimal Working Version
No middleware, no tenant checking, just return themes
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([AllowAny])
def list_themes_simple(request):
    """Super simple theme list - just return hardcoded data"""
    return Response({
        'system': [
            {
                'id': 1,
                'slug': 'finance-pro',
                'name': 'Finance Pro',
                'description': 'Professional dark theme optimized for finance dashboards',
                'category': 'professional',
                'is_system': True,
                'tags': []
            },
            {
                'id': 2,
                'slug': 'sky-blue',
                'name': 'Sky Blue',
                'description': 'Clean light theme with sky blue accents',
                'category': 'professional',
                'is_system': True,
                'tags': []
            },
            {
                'id': 3,
                'slug': 'sunset-orange',
                'name': 'Sunset Orange',
                'description': 'Warm theme with orange gradients',
                'category': 'creative',
                'is_system': True,
                'tags': []
            },
        ],
        'custom': [],
        'current': {
            'theme_slug': 'finance-pro',
            'color_mode': 'dark'
        }
    })
