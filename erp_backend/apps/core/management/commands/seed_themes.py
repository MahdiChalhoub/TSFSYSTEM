"""
Management Command: Seed System Theme Presets
==============================================
Seeds all 20 default system themes into the database.

Usage:
    python manage.py seed_themes
    python manage.py seed_themes --reset  # Delete existing and recreate
"""

from django.core.management.base import BaseCommand
from apps.core.models_themes import OrganizationTheme
from apps.core.default_theme_presets import (
    create_theme_preset,
    COMPONENTS_MINIMAL,
    COMPONENTS_COMPACT,
    COMPONENTS_SPACIOUS
)


class Command(BaseCommand):
    help = 'Seed 20 system theme presets into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing system themes and recreate them',
        )

    def handle(self, *args, **options):
        if options['reset']:
            deleted = OrganizationTheme.objects.filter(is_system=True).delete()
            self.stdout.write(self.style.WARNING(f'Deleted {deleted[0]} existing system themes'))

        # All 20 theme presets
        themes = self.get_all_themes()

        created_count = 0
        updated_count = 0

        for theme_data in themes:
            theme, created = OrganizationTheme.objects.update_or_create(
                slug=theme_data['slug'],
                is_system=True,
                organization=None,  # System themes have no organization
                defaults={
                    'name': theme_data['name'],
                    'description': theme_data['description'],
                    'category': theme_data['category'],
                    'preset_data': theme_data['preset_data'],
                    'tags': theme_data['tags'],
                    'is_active': True,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created: {theme.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated: {theme.name}'))

        self.stdout.write(self.style.SUCCESS(f'\n✅ Complete! {created_count} created, {updated_count} updated'))
        self.stdout.write(self.style.SUCCESS(f'Total system themes: {OrganizationTheme.objects.filter(is_system=True).count()}'))

    def get_all_themes(self):
        """Generate all 20 theme preset definitions"""

        # Helper for creative themes with prominent cards
        COMPONENTS_CREATIVE = {
            "cards": {
                "borderRadius": "0.75rem",
                "shadow": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                "border": "1px solid var(--theme-border)",
                "padding": "1.5rem",
                "style": "prominent"
            },
            "buttons": {
                "borderRadius": "0.5rem",
                "height": "2.75rem",
                "padding": "0 1.5rem",
                "fontSize": "0.938rem",
                "fontWeight": "600"
            },
            "inputs": {
                "borderRadius": "0.5rem",
                "height": "2.75rem",
                "padding": "0 1rem",
                "fontSize": "0.938rem",
                "border": "1px solid var(--theme-border)"
            },
            "typography": {
                "headingFont": "Poppins, system-ui, sans-serif",
                "bodyFont": "Inter, system-ui, sans-serif",
                "h1Size": "2.25rem",
                "h2Size": "1.75rem",
                "h3Size": "1.375rem",
                "bodySize": "0.938rem",
                "smallSize": "0.813rem"
            }
        }

        # Helper for POS fullscreen (no cards)
        COMPONENTS_FULLSCREEN = {
            "cards": {
                "borderRadius": "0",
                "shadow": "none",
                "border": "none",
                "padding": "1rem",
                "style": "none"
            },
            "buttons": {
                "borderRadius": "0.5rem",
                "height": "3.5rem",
                "padding": "0 2rem",
                "fontSize": "1.125rem",
                "fontWeight": "600"
            },
            "inputs": {
                "borderRadius": "0.5rem",
                "height": "3.5rem",
                "padding": "0 1.25rem",
                "fontSize": "1.125rem",
                "border": "2px solid var(--theme-border)"
            },
            "typography": {
                "headingFont": "Inter, system-ui, sans-serif",
                "bodyFont": "Inter, system-ui, sans-serif",
                "h1Size": "2.5rem",
                "h2Size": "2rem",
                "h3Size": "1.5rem",
                "bodySize": "1.125rem",
                "smallSize": "1rem"
            }
        }

        return [
            # =====================================================================
            # PROFESSIONAL THEMES (5)
            # =====================================================================
            create_theme_preset(
                slug="corporate-minimal",
                name="Corporate Minimal",
                description="Clean Apple-style design for professional environments",
                category="professional",
                tags=["professional", "clean", "apple", "minimal"],
                dark_colors={
                    "primary": "#007AFF", "primaryDark": "#0051D5",
                    "bg": "#1D1D1F", "surface": "#2C2C2E",
                    "surfaceHover": "rgba(255, 255, 255, 0.08)",
                    "text": "#F5F5F7", "textMuted": "#86868B",
                    "border": "rgba(255, 255, 255, 0.1)"
                },
                light_colors={
                    "primary": "#007AFF", "primaryDark": "#0051D5",
                    "bg": "#F5F5F7", "surface": "#FFFFFF",
                    "surfaceHover": "rgba(0, 0, 0, 0.04)",
                    "text": "#1D1D1F", "textMuted": "#86868B",
                    "border": "rgba(0, 0, 0, 0.1)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "single-column",
                              "spacing": {"container": "1.25rem", "section": "1.5rem", "card": "1rem", "element": "0.75rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "240px", "collapsible": True}
            ),

            create_theme_preset(
                slug="corporate-dark",
                name="Corporate Dark",
                description="Professional dark mode for night work",
                category="professional",
                tags=["dark", "professional", "night"],
                dark_colors={
                    "primary": "#3B82F6", "primaryDark": "#2563EB",
                    "bg": "#0F1419", "surface": "#1A1F2E",
                    "surfaceHover": "rgba(59, 130, 246, 0.1)",
                    "text": "#E5E7EB", "textMuted": "#9CA3AF",
                    "border": "rgba(255, 255, 255, 0.08)"
                },
                light_colors={
                    "primary": "#3B82F6", "primaryDark": "#2563EB",
                    "bg": "#FFFFFF", "surface": "#F9FAFB",
                    "surfaceHover": "rgba(59, 130, 246, 0.04)",
                    "text": "#111827", "textMuted": "#6B7280",
                    "border": "rgba(0, 0, 0, 0.1)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "two-column",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "240px", "collapsible": True}
            ),

            create_theme_preset(
                slug="finance-pro",
                name="Finance Pro",
                description="Dark emerald theme with compact layout for financial data",
                category="professional",
                tags=["dark", "finance", "compact", "data", "emerald"],
                dark_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#020617", "surface": "#0F172A",
                    "surfaceHover": "rgba(255, 255, 255, 0.07)",
                    "text": "#F1F5F9", "textMuted": "#94A3B8",
                    "border": "rgba(255, 255, 255, 0.08)",
                    "success": "#22C55E", "warning": "#F59E0B", "error": "#EF4444"
                },
                light_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#FFFFFF", "surface": "#F8FAFC",
                    "surfaceHover": "rgba(16, 185, 129, 0.04)",
                    "text": "#020617", "textMuted": "#64748B",
                    "border": "rgba(0, 0, 0, 0.1)",
                    "success": "#22C55E", "warning": "#F59E0B", "error": "#EF4444"
                },
                layout_config={"density": "dense", "whitespace": "minimal", "structure": "grid",
                              "spacing": {"container": "1rem", "section": "1.25rem", "card": "0.875rem", "element": "0.625rem"}},
                component_config=COMPONENTS_COMPACT,
                nav_config={"position": "side", "style": "compact", "width": "220px", "collapsible": True}
            ),

            create_theme_preset(
                slug="executive-spacious",
                name="Executive Spacious",
                description="Generous whitespace and premium feel for presentations",
                category="professional",
                tags=["spacious", "premium", "executive"],
                dark_colors={
                    "primary": "#6366F1", "primaryDark": "#4F46E5",
                    "bg": "#0F1419", "surface": "#1A1F2E",
                    "surfaceHover": "rgba(99, 102, 241, 0.1)",
                    "text": "#F3F4F6", "textMuted": "#9CA3AF",
                    "border": "rgba(255, 255, 255, 0.08)"
                },
                light_colors={
                    "primary": "#6366F1", "primaryDark": "#4F46E5",
                    "bg": "#FFFFFF", "surface": "#F9FAFB",
                    "surfaceHover": "rgba(99, 102, 241, 0.04)",
                    "text": "#111827", "textMuted": "#6B7280",
                    "border": "rgba(0, 0, 0, 0.08)"
                },
                layout_config={"density": "sparse", "whitespace": "generous", "structure": "single-column",
                              "spacing": {"container": "2.5rem", "section": "2.5rem", "card": "1.75rem", "element": "1.25rem"}},
                component_config=COMPONENTS_SPACIOUS,
                nav_config={"position": "top", "style": "minimal", "width": "100%", "collapsible": False}
            ),

            create_theme_preset(
                slug="executive-dark",
                name="Executive Dark",
                description="Premium dark mode for evening presentations",
                category="professional",
                tags=["dark", "spacious", "premium", "executive"],
                dark_colors={
                    "primary": "#818CF8", "primaryDark": "#6366F1",
                    "bg": "#0A0E1A", "surface": "#1A1F2E",
                    "surfaceHover": "rgba(129, 140, 248, 0.1)",
                    "text": "#F3F4F6", "textMuted": "#9CA3AF",
                    "border": "rgba(255, 255, 255, 0.08)"
                },
                light_colors={
                    "primary": "#6366F1", "primaryDark": "#4F46E5",
                    "bg": "#FFFFFF", "surface": "#F9FAFB",
                    "surfaceHover": "rgba(99, 102, 241, 0.04)",
                    "text": "#111827", "textMuted": "#6B7280",
                    "border": "rgba(0, 0, 0, 0.08)"
                },
                layout_config={"density": "sparse", "whitespace": "generous", "structure": "single-column",
                              "spacing": {"container": "2.5rem", "section": "2.5rem", "card": "1.75rem", "element": "1.25rem"}},
                component_config=COMPONENTS_SPACIOUS,
                nav_config={"position": "top", "style": "minimal", "width": "100%", "collapsible": False}
            ),

            # =====================================================================
            # CREATIVE THEMES (5)
            # =====================================================================
            create_theme_preset(
                slug="purple-dream",
                name="Purple Dream",
                description="Modern purple theme with card-heavy layout",
                category="creative",
                tags=["purple", "creative", "modern"],
                dark_colors={
                    "primary": "#9b87f5", "primaryDark": "#7E69AB",
                    "bg": "#0F0F1E", "surface": "#1A1A2E",
                    "surfaceHover": "rgba(155, 135, 245, 0.1)",
                    "text": "#E0E7FF", "textMuted": "#A5B4FC",
                    "border": "rgba(155, 135, 245, 0.2)",
                    "accent": "#F97316"
                },
                light_colors={
                    "primary": "#7C3AED", "primaryDark": "#6D28D9",
                    "bg": "#FAFAF9", "surface": "#FFFFFF",
                    "surfaceHover": "rgba(124, 58, 237, 0.04)",
                    "text": "#1C1917", "textMuted": "#78716C",
                    "border": "rgba(124, 58, 237, 0.2)",
                    "accent": "#F97316"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "grid",
                              "spacing": {"container": "2rem", "section": "2rem", "card": "1.5rem", "element": "1rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "280px", "collapsible": True}
            ),

            create_theme_preset(
                slug="ocean-blue",
                name="Ocean Blue",
                description="Deep blue theme for trust and stability",
                category="creative",
                tags=["blue", "ocean", "trust"],
                dark_colors={
                    "primary": "#3b82f6", "primaryDark": "#2563eb",
                    "bg": "#0A1929", "surface": "#1e3a5f",
                    "surfaceHover": "rgba(59, 130, 246, 0.1)",
                    "text": "#E3F2FD", "textMuted": "#90CAF9",
                    "border": "rgba(59, 130, 246, 0.2)"
                },
                light_colors={
                    "primary": "#0ea5e9", "primaryDark": "#0284c7",
                    "bg": "#f8fafc", "surface": "#ffffff",
                    "surfaceHover": "rgba(14, 165, 233, 0.05)",
                    "text": "#0f172a", "textMuted": "#64748b",
                    "border": "rgba(14, 165, 233, 0.2)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "two-column",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "260px", "collapsible": True}
            ),

            create_theme_preset(
                slug="sunset-orange",
                name="Sunset Energy",
                description="Bold orange theme for energetic workflows",
                category="creative",
                tags=["orange", "energetic", "bold"],
                dark_colors={
                    "primary": "#f97316", "primaryDark": "#ea580c",
                    "bg": "#1A0A00", "surface": "#2D1810",
                    "surfaceHover": "rgba(249, 115, 22, 0.1)",
                    "text": "#FFF7ED", "textMuted": "#FDBA74",
                    "border": "rgba(249, 115, 22, 0.2)"
                },
                light_colors={
                    "primary": "#f97316", "primaryDark": "#ea580c",
                    "bg": "#fff7ed", "surface": "#ffffff",
                    "surfaceHover": "rgba(249, 115, 22, 0.04)",
                    "text": "#1a0505", "textMuted": "#9a3412",
                    "border": "rgba(249, 115, 22, 0.2)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "grid",
                              "spacing": {"container": "1.75rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "260px", "collapsible": True}
            ),

            create_theme_preset(
                slug="forest-green",
                name="Forest Green",
                description="Natural green theme for growth and sustainability",
                category="creative",
                tags=["green", "nature", "eco"],
                dark_colors={
                    "primary": "#10b981", "primaryDark": "#059669",
                    "bg": "#022c22", "surface": "#064e3b",
                    "surfaceHover": "rgba(16, 185, 129, 0.1)",
                    "text": "#D1FAE5", "textMuted": "#6EE7B7",
                    "border": "rgba(16, 185, 129, 0.2)"
                },
                light_colors={
                    "primary": "#10b981", "primaryDark": "#059669",
                    "bg": "#f0fdf4", "surface": "#ffffff",
                    "surfaceHover": "rgba(16, 185, 129, 0.04)",
                    "text": "#022c22", "textMuted": "#047857",
                    "border": "rgba(16, 185, 129, 0.2)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "two-column",
                              "spacing": {"container": "1.75rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "260px", "collapsible": True}
            ),

            create_theme_preset(
                slug="ruby-red",
                name="Ruby Red",
                description="Urgent red theme for important alerts and tasks",
                category="creative",
                tags=["red", "urgent", "alert"],
                dark_colors={
                    "primary": "#ef4444", "primaryDark": "#dc2626",
                    "bg": "#1a0505", "surface": "#450a0a",
                    "surfaceHover": "rgba(239, 68, 68, 0.1)",
                    "text": "#FEE2E2", "textMuted": "#FCA5A5",
                    "border": "rgba(239, 68, 68, 0.2)"
                },
                light_colors={
                    "primary": "#ef4444", "primaryDark": "#dc2626",
                    "bg": "#fef2f2", "surface": "#ffffff",
                    "surfaceHover": "rgba(239, 68, 68, 0.04)",
                    "text": "#1a0505", "textMuted": "#991b1b",
                    "border": "rgba(239, 68, 68, 0.2)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "grid",
                              "spacing": {"container": "1.75rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "260px", "collapsible": True}
            ),

            # =====================================================================
            # EFFICIENCY THEMES (5)
            # =====================================================================
            create_theme_preset(
                slug="dashboard-compact",
                name="Dashboard Compact",
                description="Dense grid layout for maximum data visibility",
                category="efficiency",
                tags=["compact", "dense", "dashboard", "data"],
                dark_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#020617", "surface": "#0F172A",
                    "surfaceHover": "rgba(255, 255, 255, 0.05)",
                    "text": "#F1F5F9", "textMuted": "#94A3B8",
                    "border": "rgba(255, 255, 255, 0.06)"
                },
                light_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#FFFFFF", "surface": "#F8FAFC",
                    "surfaceHover": "rgba(16, 185, 129, 0.03)",
                    "text": "#020617", "textMuted": "#64748B",
                    "border": "rgba(0, 0, 0, 0.08)"
                },
                layout_config={"density": "dense", "whitespace": "minimal", "structure": "grid",
                              "spacing": {"container": "0.75rem", "section": "1rem", "card": "0.75rem", "element": "0.5rem"}},
                component_config=COMPONENTS_COMPACT,
                nav_config={"position": "side", "style": "compact", "width": "200px", "collapsible": True}
            ),

            create_theme_preset(
                slug="data-dense",
                name="Data Dense",
                description="Terminal-style dense layout for analytics",
                category="efficiency",
                tags=["dense", "analytics", "terminal"],
                dark_colors={
                    "primary": "#3B82F6", "primaryDark": "#2563EB",
                    "bg": "#0A0E1A", "surface": "#151922",
                    "surfaceHover": "rgba(59, 130, 246, 0.08)",
                    "text": "#E5E7EB", "textMuted": "#9CA3AF",
                    "border": "rgba(59, 130, 246, 0.15)"
                },
                light_colors={
                    "primary": "#3B82F6", "primaryDark": "#2563EB",
                    "bg": "#FFFFFF", "surface": "#F9FAFB",
                    "surfaceHover": "rgba(59, 130, 246, 0.03)",
                    "text": "#111827", "textMuted": "#6B7280",
                    "border": "rgba(59, 130, 246, 0.15)"
                },
                layout_config={"density": "dense", "whitespace": "minimal", "structure": "grid",
                              "spacing": {"container": "0.75rem", "section": "1rem", "card": "0.75rem", "element": "0.5rem"}},
                component_config=COMPONENTS_COMPACT,
                nav_config={"position": "top", "style": "compact", "width": "100%", "collapsible": False}
            ),

            create_theme_preset(
                slug="minimal-dark",
                name="Minimal Dark",
                description="Distraction-free dark mode for focus work",
                category="efficiency",
                tags=["minimal", "focus", "dark"],
                dark_colors={
                    "primary": "#ffffff", "primaryDark": "#d4d4d4",
                    "bg": "#0a0a0a", "surface": "#171717",
                    "surfaceHover": "rgba(255, 255, 255, 0.05)",
                    "text": "#fafafa", "textMuted": "#a3a3a3",
                    "border": "rgba(255, 255, 255, 0.1)"
                },
                light_colors={
                    "primary": "#000000", "primaryDark": "#404040",
                    "bg": "#ffffff", "surface": "#fafafa",
                    "surfaceHover": "rgba(0, 0, 0, 0.03)",
                    "text": "#0a0a0a", "textMuted": "#737373",
                    "border": "rgba(0, 0, 0, 0.1)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "single-column",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "220px", "collapsible": True}
            ),

            create_theme_preset(
                slug="minimal-light",
                name="Minimal Light",
                description="Clean light mode for daylight work",
                category="efficiency",
                tags=["minimal", "light", "clean"],
                dark_colors={
                    "primary": "#6366F1", "primaryDark": "#4F46E5",
                    "bg": "#18181b", "surface": "#27272a",
                    "surfaceHover": "rgba(99, 102, 241, 0.1)",
                    "text": "#fafafa", "textMuted": "#a1a1aa",
                    "border": "rgba(255, 255, 255, 0.1)"
                },
                light_colors={
                    "primary": "#6366F1", "primaryDark": "#4F46E5",
                    "bg": "#ffffff", "surface": "#fafafa",
                    "surfaceHover": "rgba(99, 102, 241, 0.04)",
                    "text": "#18181b", "textMuted": "#71717a",
                    "border": "rgba(0, 0, 0, 0.08)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "two-column",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "220px", "collapsible": True}
            ),

            create_theme_preset(
                slug="high-contrast",
                name="High Contrast",
                description="High contrast theme for accessibility",
                category="efficiency",
                tags=["accessibility", "contrast", "wcag"],
                dark_colors={
                    "primary": "#FFD700", "primaryDark": "#FFC700",
                    "bg": "#000000", "surface": "#1a1a1a",
                    "surfaceHover": "rgba(255, 215, 0, 0.1)",
                    "text": "#FFFFFF", "textMuted": "#CCCCCC",
                    "border": "rgba(255, 255, 255, 0.3)"
                },
                light_colors={
                    "primary": "#0066CC", "primaryDark": "#0052A3",
                    "bg": "#FFFFFF", "surface": "#F5F5F5",
                    "surfaceHover": "rgba(0, 102, 204, 0.08)",
                    "text": "#000000", "textMuted": "#333333",
                    "border": "rgba(0, 0, 0, 0.3)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "single-column",
                              "spacing": {"container": "1.5rem", "section": "2rem", "card": "1.5rem", "element": "1rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "240px", "collapsible": True}
            ),

            # =====================================================================
            # SPECIALIZED THEMES (5)
            # =====================================================================
            create_theme_preset(
                slug="pos-fullscreen",
                name="POS Fullscreen",
                description="Fullscreen mode for retail point-of-sale terminals",
                category="specialized",
                tags=["pos", "fullscreen", "retail", "kiosk"],
                dark_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#020617", "surface": "#0F172A",
                    "surfaceHover": "rgba(255, 255, 255, 0.07)",
                    "text": "#F1F5F9", "textMuted": "#94A3B8",
                    "border": "rgba(255, 255, 255, 0.08)"
                },
                light_colors={
                    "primary": "#10B981", "primaryDark": "#059669",
                    "bg": "#FFFFFF", "surface": "#F8FAFC",
                    "surfaceHover": "rgba(16, 185, 129, 0.04)",
                    "text": "#020617", "textMuted": "#64748B",
                    "border": "rgba(0, 0, 0, 0.1)"
                },
                layout_config={"density": "medium", "whitespace": "minimal", "structure": "fullscreen",
                              "spacing": {"container": "0", "section": "0.5rem", "card": "1rem", "element": "0.75rem"}},
                component_config=COMPONENTS_FULLSCREEN,
                nav_config={"position": "hidden", "style": "minimal", "width": "0", "collapsible": False}
            ),

            create_theme_preset(
                slug="pos-light",
                name="POS Light",
                description="Light mode for daytime retail operations",
                category="specialized",
                tags=["pos", "light", "retail", "daylight"],
                dark_colors={
                    "primary": "#0ea5e9", "primaryDark": "#0284c7",
                    "bg": "#0A1929", "surface": "#1e3a5f",
                    "surfaceHover": "rgba(14, 165, 233, 0.1)",
                    "text": "#E3F2FD", "textMuted": "#90CAF9",
                    "border": "rgba(14, 165, 233, 0.2)"
                },
                light_colors={
                    "primary": "#0ea5e9", "primaryDark": "#0284c7",
                    "bg": "#f8fafc", "surface": "#ffffff",
                    "surfaceHover": "rgba(14, 165, 233, 0.05)",
                    "text": "#0f172a", "textMuted": "#64748b",
                    "border": "rgba(14, 165, 233, 0.2)"
                },
                layout_config={"density": "medium", "whitespace": "minimal", "structure": "fullscreen",
                              "spacing": {"container": "0", "section": "0.5rem", "card": "1rem", "element": "0.75rem"}},
                component_config=COMPONENTS_FULLSCREEN,
                nav_config={"position": "hidden", "style": "minimal", "width": "0", "collapsible": False}
            ),

            create_theme_preset(
                slug="monochrome",
                name="Monochrome",
                description="Timeless black and white minimal design",
                category="specialized",
                tags=["monochrome", "minimal", "elegant"],
                dark_colors={
                    "primary": "#ffffff", "primaryDark": "#d4d4d4",
                    "bg": "#0a0a0a", "surface": "#171717",
                    "surfaceHover": "rgba(255, 255, 255, 0.05)",
                    "text": "#fafafa", "textMuted": "#a3a3a3",
                    "border": "rgba(255, 255, 255, 0.1)"
                },
                light_colors={
                    "primary": "#000000", "primaryDark": "#404040",
                    "bg": "#ffffff", "surface": "#fafafa",
                    "surfaceHover": "rgba(0, 0, 0, 0.03)",
                    "text": "#0a0a0a", "textMuted": "#737373",
                    "border": "rgba(0, 0, 0, 0.1)"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "single-column",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "220px", "collapsible": True}
            ),

            create_theme_preset(
                slug="cyber-neon",
                name="Cyber Neon",
                description="Futuristic neon theme for tech startups",
                category="specialized",
                tags=["neon", "futuristic", "tech", "gaming"],
                dark_colors={
                    "primary": "#06b6d4", "primaryDark": "#0891b2",
                    "bg": "#000000", "surface": "#0a0a0a",
                    "surfaceHover": "rgba(6, 182, 212, 0.1)",
                    "text": "#00ff9f", "textMuted": "#22d3ee",
                    "border": "rgba(6, 182, 212, 0.3)",
                    "accent": "#ff00ff"
                },
                light_colors={
                    "primary": "#06b6d4", "primaryDark": "#0891b2",
                    "bg": "#f0fdfa", "surface": "#ffffff",
                    "surfaceHover": "rgba(6, 182, 212, 0.05)",
                    "text": "#0f172a", "textMuted": "#0891b2",
                    "border": "rgba(6, 182, 212, 0.2)",
                    "accent": "#d946ef"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "grid",
                              "spacing": {"container": "1.5rem", "section": "1.75rem", "card": "1.25rem", "element": "0.875rem"}},
                component_config=COMPONENTS_CREATIVE,
                nav_config={"position": "side", "style": "expanded", "width": "260px", "collapsible": True}
            ),

            create_theme_preset(
                slug="colorblind-safe",
                name="Colorblind Safe",
                description="Accessible colors optimized for color vision deficiency",
                category="specialized",
                tags=["accessibility", "colorblind", "wcag"],
                dark_colors={
                    "primary": "#0077BB", "primaryDark": "#005A8C",
                    "bg": "#1a1a1a", "surface": "#2a2a2a",
                    "surfaceHover": "rgba(0, 119, 187, 0.1)",
                    "text": "#EEEEEE", "textMuted": "#BBBBBB",
                    "border": "rgba(0, 119, 187, 0.3)",
                    "success": "#009E73", "warning": "#F0E442", "error": "#CC3311"
                },
                light_colors={
                    "primary": "#0077BB", "primaryDark": "#005A8C",
                    "bg": "#FFFFFF", "surface": "#F5F5F5",
                    "surfaceHover": "rgba(0, 119, 187, 0.05)",
                    "text": "#222222", "textMuted": "#555555",
                    "border": "rgba(0, 119, 187, 0.2)",
                    "success": "#009E73", "warning": "#F0E442", "error": "#CC3311"
                },
                layout_config={"density": "medium", "whitespace": "balanced", "structure": "single-column",
                              "spacing": {"container": "1.5rem", "section": "2rem", "card": "1.5rem", "element": "1rem"}},
                component_config=COMPONENTS_MINIMAL,
                nav_config={"position": "side", "style": "minimal", "width": "240px", "collapsible": True}
            ),
        ]
