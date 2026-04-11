"""
Theme Engine Models - Organization Themes
=========================================
Tenant-customizable theme system with backend storage.

Architecture:
- System presets (built-in, read-only)
- Custom themes (per-tenant, user-created)
- Theme inheritance (dark/light variants)
"""

from django.db import models
from django.utils.text import slugify
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config


class OrganizationTheme(AuditLogMixin, TenantOwnedModel):
    """
    Custom theme presets for organizations.

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin

    Features:
    - Complete theme configuration (colors, layout, components, typography)
    - Dark/light mode variants in single theme
    - System presets (read-only) vs custom themes (editable)
    - Usage tracking for analytics
    """

    # Basic info
    name = models.CharField(
        max_length=100,
        help_text="Display name (e.g., 'Finance Pro', 'My Custom Theme')"
    )
    slug = models.SlugField(
        max_length=100,
        help_text="URL-safe identifier (auto-generated from name)"
    )
    description = models.TextField(
        blank=True,
        help_text="User-friendly description of the theme"
    )

    # Theme data (complete configuration)
    preset_data = models.JSONField(
        help_text="""
        Complete theme configuration:
        {
            "colors": {
                "dark": { "primary": "#10B981", "bg": "#020617", ... },
                "light": { "primary": "#10B981", "bg": "#FFFFFF", ... }
            },
            "layout": {
                "density": "dense",
                "whitespace": "minimal",
                "structure": "grid",
                "spacing": { "container": "1rem", ... }
            },
            "components": {
                "cards": { "borderRadius": "0.5rem", ... },
                "buttons": { "height": "2.5rem", ... },
                "inputs": { "height": "2.5rem", ... },
                "typography": { "headingFont": "Inter", ... }
            },
            "navigation": {
                "position": "side",
                "style": "compact",
                "width": "220px",
                "collapsible": true
            }
        }
        """
    )

    # Categorization
    category = models.CharField(
        max_length=50,
        choices=[
            ('professional', 'Professional'),
            ('creative', 'Creative'),
            ('efficiency', 'Efficiency'),
            ('specialized', 'Specialized'),
            ('custom', 'Custom'),
        ],
        default='custom',
        help_text="Theme category for organization"
    )

    # System vs Custom
    is_system = models.BooleanField(
        default=False,
        help_text="System preset (built-in, cannot be edited/deleted)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Active themes appear in selector"
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Default theme for new users in this organization"
    )

    # Metadata
    base_theme = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='variants',
        help_text="Parent theme if this is a customized variant"
    )

    # Usage tracking
    usage_count = models.IntegerField(
        default=0,
        help_text="Number of users currently using this theme"
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time this theme was selected"
    )

    # Tags for filtering
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Tags for search/filter (e.g., ['dark', 'compact', 'blue'])"
    )

    class Meta:
        db_table = 'core_organization_theme'
        indexes = [
            models.Index(fields=['organization', 'slug']),
            models.Index(fields=['organization', 'is_active']),
            models.Index(fields=['organization', 'is_default']),
            models.Index(fields=['is_system', 'is_active']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'slug'],
                name='unique_theme_slug_per_tenant'
            )
        ]
        ordering = ['-is_system', 'category', 'name']

    def __str__(self):
        prefix = "[SYSTEM] " if self.is_system else ""
        return f"{prefix}{self.name}"

    def save(self, *args, **kwargs):
        # Auto-generate slug from name
        if not self.slug:
            self.slug = slugify(self.name)

        # Validate preset_data structure
        self._validate_preset_data()

        super().save(*args, **kwargs)

    def _validate_preset_data(self):
        """Validate theme data structure — auto-fill missing keys with defaults instead of crashing."""
        if not isinstance(self.preset_data, dict):
            raise ValueError("preset_data must be a dict")

        # Auto-fill missing top-level keys with sensible defaults
        defaults = {
            'colors': {
                'dark': {'primary': '#10B981', 'bg': '#020617', 'surface': '#0F172A',
                         'text': '#F1F5F9', 'textMuted': '#94A3B8', 'border': 'rgba(255,255,255,0.08)'},
                'light': {'primary': '#10B981', 'bg': '#FFFFFF', 'surface': '#F8FAFC',
                          'text': '#1E293B', 'textMuted': '#64748B', 'border': 'rgba(0,0,0,0.08)'},
            },
            'layout': {
                'density': 'medium', 'whitespace': 'balanced',
                'structure': 'single-column',
                'spacing': {'container': '1.5rem', 'section': '1.75rem', 'card': '1.25rem', 'element': '0.875rem'},
            },
            'components': {
                'cards': {'borderRadius': '0.625rem', 'shadow': '0 1px 3px rgba(0,0,0,0.08)',
                          'border': '1px solid var(--app-border)', 'padding': '1rem', 'style': 'subtle'},
                'buttons': {'borderRadius': '0.5rem', 'height': '2.5rem', 'padding': '0 1.25rem',
                            'fontSize': '0.875rem', 'fontWeight': '500'},
            },
            'navigation': {
                'position': 'side', 'style': 'minimal', 'width': '240px', 'collapsible': True,
            },
        }

        for key, default_val in defaults.items():
            if key not in self.preset_data:
                self.preset_data[key] = default_val

        # Ensure colors have both variants
        if 'dark' not in self.preset_data.get('colors', {}):
            self.preset_data.setdefault('colors', {})['dark'] = defaults['colors']['dark']
        if 'light' not in self.preset_data.get('colors', {}):
            self.preset_data.setdefault('colors', {})['light'] = defaults['colors']['light']

    @classmethod
    def get_default_for_tenant(cls, organization):
        """Get default theme for organization"""
        # Try to get tenant's default
        default = cls.objects.filter(
            organization=organization,
            is_default=True,
            is_active=True
        ).first()

        if default:
            return default

        # Fallback to system default
        return cls.get_system_default()

    @classmethod
    def get_system_default(cls):
        """Get global system default theme"""
        return cls.objects.filter(
            is_system=True,
            slug='finance-pro',
            is_active=True
        ).first()

    def increment_usage(self):
        """Increment usage counter"""
        from django.utils import timezone
        self.usage_count += 1
        self.last_used_at = timezone.now()
        self.save(update_fields=['usage_count', 'last_used_at'])

    def export_json(self):
        """Export theme as JSON for import/export"""
        return {
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'preset_data': self.preset_data,
            'tags': self.tags,
        }

    @classmethod
    def import_from_json(cls, data, organization, user):
        """Import theme from JSON"""
        return cls.objects.create(
            organization=organization,
            name=data['name'],
            description=data.get('description', ''),
            category=data.get('category', 'custom'),
            preset_data=data['preset_data'],
            tags=data.get('tags', []),
            created_by=user
        )


class UserThemePreference(AuditLogMixin, TenantOwnedModel):
    """
    User-specific theme preferences.

    Stores:
    - Active theme
    - Color mode (dark/light)
    - Custom overrides (optional)
    """

    user = models.ForeignKey(
        'erp.User',
        on_delete=models.CASCADE,
        related_name='theme_preferences'
    )

    active_theme = models.ForeignKey(
        OrganizationTheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_preferences',
        help_text="Currently selected theme"
    )

    color_mode = models.CharField(
        max_length=10,
        choices=[
            ('dark', 'Dark Mode'),
            ('light', 'Light Mode'),
            ('auto', 'Auto (system preference)'),
        ],
        default='dark',
        help_text="Color mode override"
    )

    # Optional: per-user customizations
    custom_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="User-specific overrides to active theme (optional)"
    )

    class Meta:
        db_table = 'core_user_theme_preference'
        indexes = [
            models.Index(fields=['organization', 'user']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'organization'],
                name='unique_user_org_theme_pref'
            )
        ]

    def __str__(self):
        theme_name = self.active_theme.name if self.active_theme else "Default"
        return f"{self.user.username} - {theme_name} ({self.color_mode})"


    def get_effective_theme(self):
        """Get the theme user should use"""
        if self.active_theme and self.active_theme.is_active:
            return self.active_theme

        # Fallback to organization default or system default
        if self.organization:
            return OrganizationTheme.get_default_for_tenant(self.organization)
        else:
            return OrganizationTheme.get_system_default()
