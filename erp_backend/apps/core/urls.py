"""
Core App URLs
=============
URL patterns for core functionality including themes.
"""

from django.urls import path
from . import views_themes

app_name = 'core'

urlpatterns = [
    # Theme Management Endpoints (no api/ prefix — included under api/ in core/urls.py)
    path('ui-themes/', views_themes.list_themes, name='themes-list'),
    path('ui-themes/create/', views_themes.create_theme, name='themes-create'),
    path('ui-themes/current/', views_themes.get_current_theme, name='themes-current'),
    path('ui-themes/toggle-mode/', views_themes.toggle_color_mode, name='themes-toggle-mode'),
    path('ui-themes/import/', views_themes.import_theme, name='themes-import'),
    path('ui-themes/<int:theme_id>/', views_themes.get_theme, name='themes-detail'),
    path('ui-themes/<int:theme_id>/update/', views_themes.update_theme, name='themes-update'),
    path('ui-themes/<int:theme_id>/delete/', views_themes.delete_theme, name='themes-delete'),
    path('ui-themes/<int:theme_id>/activate/', views_themes.activate_theme, name='themes-activate'),
    path('ui-themes/<int:theme_id>/export/', views_themes.export_theme, name='themes-export'),
]
