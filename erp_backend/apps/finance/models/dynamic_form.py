"""
Dynamic Form Builder
====================
Allows admins to define custom JSON-schema-driven forms that can be attached
to any entity (e.g. tax rules, expense categories, supplier profiles).

FormDefinition  — the schema (list of field descriptors).
FormResponse    — a filled-in instance of a FormDefinition.
"""

from django.db import models
from erp.models import TenantModel


FIELD_TYPES = [
    ('text',     'Single-line text'),
    ('textarea', 'Multi-line text'),
    ('number',   'Number'),
    ('decimal',  'Decimal / currency'),
    ('date',     'Date'),
    ('select',   'Select (dropdown)'),
    ('checkbox', 'Checkbox (boolean)'),
    ('email',    'Email address'),
    ('url',      'URL'),
]


class FormDefinition(TenantModel):
    """
    Defines the schema for a custom form.

    schema JSON shape:
    {
      "fields": [
        {
          "key":      "supplier_code",        # unique key within the form
          "label":    "Supplier Code",
          "type":     "text",                  # see FIELD_TYPES
          "required": true,
          "placeholder": "e.g. SUP-001",
          "help":     "The supplier's internal code.",
          "options":  ["OPT_A", "OPT_B"],      # for type=select only
          "min":      0,                        # for type=number/decimal
          "max":      100,
          "default":  "GENERAL"
        }
      ]
    }
    """
    key         = models.SlugField(max_length=100)
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    schema      = models.JSONField(default=dict)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'key')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.key})"

    @property
    def fields(self):
        """Return the fields list from schema, with defaults applied."""
        return self.schema.get('fields', [])


class FormResponse(TenantModel):
    """
    A filled-in instance of a FormDefinition.
    `data` mirrors the FormDefinition's schema keys → user-supplied values.
    """
    form_definition = models.ForeignKey(
        FormDefinition,
        on_delete=models.CASCADE,
        related_name='responses',
    )
    # Optional FK to any entity — stored as strings for flexibility
    entity_type = models.CharField(max_length=100, blank=True)  # e.g. 'PostingRule', 'Supplier'
    entity_id   = models.PositiveIntegerField(null=True, blank=True)

    data        = models.JSONField(default=dict)
    created_by  = models.ForeignKey(
        'erp.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='form_responses',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Response to {self.form_definition.name} [{self.id}]"
