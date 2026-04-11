"""
List Preference Models
Per-user and per-organization column/filter customization for universal list views.
"""
from django.db import models


class OrgListDefault(models.Model):
    """Organization-wide default columns/filters for a list view."""
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        related_name='list_defaults',
        db_column='tenant_id',
    )
    list_key = models.CharField(
        max_length=100,
        help_text='Unique list identifier, e.g. inventory.products, inventory.transfers'
    )
    visible_columns = models.JSONField(
        default=list,
        help_text='Ordered list of column keys to display'
    )
    default_filters = models.JSONField(
        default=dict,
        help_text='Default filter values as key:value pairs'
    )
    page_size = models.IntegerField(default=25)
    sort_column = models.CharField(max_length=100, default='', blank=True)
    sort_direction = models.CharField(
        max_length=4, default='asc',
        choices=[('asc', 'Ascending'), ('desc', 'Descending')]
    )

    class Meta:
        db_table = 'org_list_default'
        unique_together = ('organization', 'list_key')

    def __str__(self):
        return f"{self.organization} → {self.list_key}"


class UserListPreference(models.Model):
    """Per-user overrides for a specific list view."""
    user = models.ForeignKey(
        'erp.User', on_delete=models.CASCADE,
        related_name='list_preferences'
    )
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        related_name='user_list_preferences',
        db_column='tenant_id',
    )
    list_key = models.CharField(max_length=100)
    visible_columns = models.JSONField(
        default=list,
        help_text='Ordered list of column keys to display'
    )
    default_filters = models.JSONField(
        default=dict,
        help_text='Saved filter values'
    )
    page_size = models.IntegerField(default=25)
    sort_column = models.CharField(max_length=100, default='', blank=True)
    sort_direction = models.CharField(
        max_length=4, default='asc',
        choices=[('asc', 'Ascending'), ('desc', 'Descending')]
    )
    # ── V2: Customize Panel profiles ──
    view_profiles = models.JSONField(
        default=list, blank=True,
        help_text='Array of DajingoViewProfile objects [{id, name, columns, filters, columnOrder}]'
    )
    active_profile_id = models.CharField(
        max_length=100, default='default', blank=True,
        help_text='ID of the currently active profile'
    )

    class Meta:
        db_table = 'user_list_preference'
        unique_together = ('user', 'organization', 'list_key')

    def __str__(self):
        return f"{self.user} → {self.list_key}"
