"""
ListViewPolicy — SaaS-level governance for list views
══════════════════════════════════════════════════════════
Allows SaaS admin to control per-organization:
  - Which columns are visible/hidden in list views
  - Which filters are available
  - Which columns are forced-visible (cannot be hidden by user)
  - Maximum page size
  - Locked sort overrides

If organization is NULL, the policy is the GLOBAL DEFAULT.
Organization-specific policies override the global default.
"""
from django.db import models


class ListViewPolicy(models.Model):
    """
    SaaS-level policy that governs what columns and filters
    an organization can see in a specific list view.

    config JSON schema:
    {
        "hidden_columns": ["balance", "cost_price", "margin"],
        "hidden_filters": ["profit_margin", "internal_notes"],
        "forced_columns": ["name", "status"],   # Can't be hidden by user
        "max_page_size": 50,                     # Cap page size
        "locked_sort": {"key": "name", "dir": "asc"},  # Optional forced sort
        "custom_labels": {"balance": "Account Status"},  # Rename columns
    }
    """
    organization = models.ForeignKey(
        'Organization', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='listview_policies',
        help_text='NULL = global default for all organizations'
    )
    view_key = models.CharField(
        max_length=100,
        help_text='List view identifier, e.g. "inventory_products", "crm_contacts", "finance_ledger". Use "*" for global default.'
    )
    config = models.JSONField(
        default=dict,
        help_text='Policy configuration (hidden_columns, hidden_filters, forced_columns, etc.)'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='', help_text='Admin notes about why this policy exists')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_listview_policies'
    )

    class Meta:
        db_table = 'listview_policy'
        unique_together = ('organization', 'view_key')
        ordering = ['view_key', 'organization']
        verbose_name = 'List View Policy'
        verbose_name_plural = 'List View Policies'

    def __str__(self):
        org_label = self.organization.name if self.organization else 'GLOBAL'
        return f"{self.view_key} → {org_label}"

    @classmethod
    def get_effective_policy(cls, organization_id, view_key):
        """
        Resolve the effective policy for an organization + view.
        Priority: org-specific > org-global (*) > system-specific > system-global (*)
        """
        policies = cls.objects.filter(
            is_active=True
        ).filter(
            models.Q(organization_id=organization_id) | models.Q(organization__isnull=True)
        ).filter(
            models.Q(view_key=view_key) | models.Q(view_key='*')
        ).order_by(
            # org-specific first, then global; exact view first, then wildcard
            models.F('organization').asc(nulls_last=True),
            models.Case(
                models.When(view_key=view_key, then=0),
                default=1,
                output_field=models.IntegerField(),
            ),
        )

        # Merge configs: global defaults < org-global < system-specific < org-specific
        merged = {
            'hidden_columns': [],
            'hidden_filters': [],
            'forced_columns': [],
            'max_page_size': None,
            'locked_sort': None,
            'custom_labels': {},
        }
        for policy in policies:
            cfg = policy.config or {}
            if 'hidden_columns' in cfg:
                merged['hidden_columns'] = list(set(merged['hidden_columns'] + cfg['hidden_columns']))
            if 'hidden_filters' in cfg:
                merged['hidden_filters'] = list(set(merged['hidden_filters'] + cfg['hidden_filters']))
            if 'forced_columns' in cfg:
                merged['forced_columns'] = list(set(merged['forced_columns'] + cfg['forced_columns']))
            if 'max_page_size' in cfg:
                merged['max_page_size'] = cfg['max_page_size']
            if 'locked_sort' in cfg:
                merged['locked_sort'] = cfg['locked_sort']
            if 'custom_labels' in cfg:
                merged['custom_labels'].update(cfg['custom_labels'])

        return merged
