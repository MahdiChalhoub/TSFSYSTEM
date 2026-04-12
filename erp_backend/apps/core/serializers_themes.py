"""
Theme Serializers
=================
REST API serializers for theme engine.
"""

from rest_framework import serializers
from .models_themes import OrganizationTheme, UserThemePreference


class OrganizationThemeSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationTheme model"""

    class Meta:
        model = OrganizationTheme
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'category',
            'preset_data',
            'is_system',
            'is_active',
            'is_default',
            'tags',
            'usage_count',
            'last_used_at',
        ]
        read_only_fields = [
            'id',
            'is_system',
            'usage_count',
            'last_used_at',
        ]

    def validate_preset_data(self, value):
        """Validate theme preset data structure"""
        required_keys = ['colors', 'layout', 'components', 'navigation']
        for key in required_keys:
            if key not in value:
                raise serializers.ValidationError(
                    f"preset_data must contain '{key}'"
                )

        # Validate colors have dark and light variants
        if 'dark' not in value['colors'] or 'light' not in value['colors']:
            raise serializers.ValidationError(
                "preset_data.colors must have 'dark' and 'light' variants"
            )

        return value


class OrganizationThemeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for theme listings"""

    class Meta:
        model = OrganizationTheme
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'category',
            'is_system',
            'tags',
            'preset_data',
        ]


class UserThemePreferenceSerializer(serializers.ModelSerializer):
    """Serializer for UserThemePreference model"""

    active_theme_details = OrganizationThemeSerializer(
        source='active_theme',
        read_only=True
    )

    class Meta:
        model = UserThemePreference
        fields = [
            'id',
            'active_theme',
            'color_mode',
            'custom_overrides',
            'active_theme_details',
        ]
        read_only_fields = ['id']


class ThemeExportSerializer(serializers.Serializer):
    """Serializer for theme export/import"""

    name = serializers.CharField(max_length=100)
    description = serializers.CharField(allow_blank=True)
    category = serializers.ChoiceField(
        choices=['professional', 'creative', 'efficiency', 'specialized', 'design-system', 'custom']
    )
    preset_data = serializers.JSONField()
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
