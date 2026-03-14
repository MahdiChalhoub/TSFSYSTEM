"""
Core App URLs
=============
URL patterns for core functionality including themes.
"""

from django.urls import path
from . import views_themes

app_name = 'core'

urlpatterns = [
    # Theme Management Endpoints
    path('api/themes/', views_themes.list_themes, name='themes-list'),
    path('api/themes/create/', views_themes.create_theme, name='themes-create'),
    path('api/themes/current/', views_themes.get_current_theme, name='themes-current'),
    path('api/themes/toggle-mode/', views_themes.toggle_color_mode, name='themes-toggle-mode'),
    path('api/themes/import/', views_themes.import_theme, name='themes-import'),
    path('api/themes/<int:theme_id>/', views_themes.get_theme, name='themes-detail'),
    path('api/themes/<int:theme_id>/update/', views_themes.update_theme, name='themes-update'),
    path('api/themes/<int:theme_id>/delete/', views_themes.delete_theme, name='themes-delete'),
    path('api/themes/<int:theme_id>/activate/', views_themes.activate_theme, name='themes-activate'),
    path('api/themes/<int:theme_id>/export/', views_themes.export_theme, name='themes-export'),
]
