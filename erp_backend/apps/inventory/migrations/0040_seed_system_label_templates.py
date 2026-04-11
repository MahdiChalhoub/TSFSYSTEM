"""
Seed 5 default system label templates (is_system=True).

These ship with every org and cannot be deleted, only cloned.
Templates use {variable} placeholders that are substituted at render time.
"""
from django.db import migrations


SHELF_HTML = """<div style="padding: 6px; font-family: 'Inter', sans-serif; text-align: center; border: 1px solid #ddd;">
  <div style="font-size: 11px; font-weight: 600; color: #333; margin-bottom: 4px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{name}</div>
  <div style="font-size: 28px; font-weight: 900; color: #111; letter-spacing: -0.5px; margin: 4px 0;">{price}</div>
  <div style="font-size: 8px; color: #888; text-transform: uppercase;">{unit} — {category}</div>
  <div style="margin-top: 4px; font-family: 'Libre Barcode 128', monospace; font-size: 32px; line-height: 1;">{barcode}</div>
  <div style="font-size: 7px; font-family: monospace; color: #666; letter-spacing: 1px;">{barcode}</div>
</div>"""

SHELF_CSS = """div { box-sizing: border-box; }"""

BARCODE_HTML = """<div style="padding: 4px; font-family: 'Inter', sans-serif; text-align: center;">
  <div style="font-size: 9px; font-weight: 700; color: #222; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{name}</div>
  <div style="font-family: 'Libre Barcode 128', monospace; font-size: 42px; line-height: 1; margin: 2px 0;">{barcode}</div>
  <div style="font-size: 8px; font-family: monospace; color: #555; letter-spacing: 1.5px;">{barcode}</div>
  <div style="font-size: 7px; color: #999; margin-top: 2px;">{sku}</div>
</div>"""

BARCODE_CSS = """div { box-sizing: border-box; }"""

PACKAGING_HTML = """<div style="padding: 8px; font-family: 'Inter', sans-serif; border: 1px solid #ccc;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
    <div style="font-size: 12px; font-weight: 800; color: #111;">{name}</div>
    <div style="font-size: 14px; font-weight: 900; color: #111;">{price}</div>
  </div>
  <div style="font-size: 9px; color: #666; margin-bottom: 4px;">{packaging_name} — {unit}</div>
  <div style="font-size: 8px; color: #888;">SKU: {sku} | Supplier: {supplier}</div>
  <div style="margin-top: 6px; text-align: center;">
    <div style="font-family: 'Libre Barcode 128', monospace; font-size: 36px; line-height: 1;">{barcode}</div>
    <div style="font-size: 7px; font-family: monospace; color: #666; letter-spacing: 1px;">{barcode}</div>
  </div>
</div>"""

PACKAGING_CSS = """div { box-sizing: border-box; }"""

FRESH_HTML = """<div style="padding: 6px; font-family: 'Inter', sans-serif; border: 1px solid #aaa;">
  <div style="font-size: 11px; font-weight: 700; color: #222; text-align: center; margin-bottom: 3px;">{name}</div>
  <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 4px 0;">
    <div style="font-size: 22px; font-weight: 900; color: #111;">{price}</div>
    <div style="font-size: 10px; color: #666;">/ {unit}</div>
  </div>
  <div style="font-size: 9px; color: #888; text-align: center;">Weight: {weight} {unit}</div>
  <div style="font-size: 8px; color: #999; text-align: center; margin-top: 3px;">Packed: {date}</div>
  <div style="margin-top: 4px; text-align: center;">
    <div style="font-family: 'Libre Barcode 128', monospace; font-size: 28px; line-height: 1;">{barcode}</div>
    <div style="font-size: 7px; font-family: monospace; color: #666;">{barcode}</div>
  </div>
</div>"""

FRESH_CSS = """div { box-sizing: border-box; }"""

BARCODE_ONLY_HTML = """<div style="padding: 3px; text-align: center;">
  <div style="font-family: 'Libre Barcode 128', monospace; font-size: 48px; line-height: 1;">{barcode}</div>
  <div style="font-size: 9px; font-family: monospace; color: #444; letter-spacing: 2px; margin-top: 1px;">{barcode}</div>
</div>"""

BARCODE_ONLY_CSS = """div { box-sizing: border-box; }"""


SYSTEM_TEMPLATES = [
    {
        'name': 'Shelf Price Label',
        'label_type': 'SHELF',
        'description': 'Standard shelf price label with product name, price, barcode, and category. 50×30mm landscape.',
        'html_template': SHELF_HTML,
        'css_template': SHELF_CSS,
        'variables_schema': ['name', 'price', 'barcode', 'unit', 'category'],
        'label_width_mm': 50, 'label_height_mm': 30,
        'orientation': 'LANDSCAPE', 'dpi': 203,
        'columns': 3, 'rows': 10,
        'gap_horizontal_mm': 2, 'gap_vertical_mm': 2,
        'margin_top_mm': 5, 'margin_right_mm': 5, 'margin_bottom_mm': 5, 'margin_left_mm': 5,
        'supports_barcode': True, 'supports_qr': False,
        'default_font_size': 12,
        'is_system': True, 'is_default': True, 'is_active': True,
    },
    {
        'name': 'Barcode Sticker',
        'label_type': 'BARCODE',
        'description': 'Barcode sticker with product name and SKU. 40×20mm landscape.',
        'html_template': BARCODE_HTML,
        'css_template': BARCODE_CSS,
        'variables_schema': ['name', 'barcode', 'sku'],
        'label_width_mm': 40, 'label_height_mm': 20,
        'orientation': 'LANDSCAPE', 'dpi': 203,
        'columns': 4, 'rows': 14,
        'gap_horizontal_mm': 2, 'gap_vertical_mm': 2,
        'margin_top_mm': 5, 'margin_right_mm': 5, 'margin_bottom_mm': 5, 'margin_left_mm': 5,
        'supports_barcode': True, 'supports_qr': False,
        'default_font_size': 10,
        'is_system': True, 'is_default': True, 'is_active': True,
    },
    {
        'name': 'Packaging Label',
        'label_type': 'PACKAGING',
        'description': 'Full packaging label with two-column layout. 70×40mm landscape.',
        'html_template': PACKAGING_HTML,
        'css_template': PACKAGING_CSS,
        'variables_schema': ['name', 'price', 'barcode', 'sku', 'unit', 'supplier', 'packaging_name'],
        'label_width_mm': 70, 'label_height_mm': 40,
        'orientation': 'LANDSCAPE', 'dpi': 203,
        'columns': 2, 'rows': 7,
        'gap_horizontal_mm': 3, 'gap_vertical_mm': 3,
        'margin_top_mm': 5, 'margin_right_mm': 5, 'margin_bottom_mm': 5, 'margin_left_mm': 5,
        'supports_barcode': True, 'supports_qr': False,
        'default_font_size': 11,
        'is_system': True, 'is_default': True, 'is_active': True,
    },
    {
        'name': 'Fresh / Weight Label',
        'label_type': 'FRESH',
        'description': 'Variable-weight label with price, weight, pack date, and barcode. 60×35mm landscape.',
        'html_template': FRESH_HTML,
        'css_template': FRESH_CSS,
        'variables_schema': ['name', 'price', 'barcode', 'unit', 'weight', 'date'],
        'label_width_mm': 60, 'label_height_mm': 35,
        'orientation': 'LANDSCAPE', 'dpi': 203,
        'columns': 3, 'rows': 8,
        'gap_horizontal_mm': 2, 'gap_vertical_mm': 2,
        'margin_top_mm': 5, 'margin_right_mm': 5, 'margin_bottom_mm': 5, 'margin_left_mm': 5,
        'supports_barcode': True, 'supports_qr': False,
        'default_font_size': 11,
        'is_system': True, 'is_default': True, 'is_active': True,
    },
    {
        'name': 'Barcode Only (Minimal)',
        'label_type': 'CUSTOM',
        'description': 'Minimal barcode-only sticker. 35×15mm landscape.',
        'html_template': BARCODE_ONLY_HTML,
        'css_template': BARCODE_ONLY_CSS,
        'variables_schema': ['barcode'],
        'label_width_mm': 35, 'label_height_mm': 15,
        'orientation': 'LANDSCAPE', 'dpi': 203,
        'columns': 5, 'rows': 18,
        'gap_horizontal_mm': 2, 'gap_vertical_mm': 2,
        'margin_top_mm': 5, 'margin_right_mm': 5, 'margin_bottom_mm': 5, 'margin_left_mm': 5,
        'supports_barcode': True, 'supports_qr': False,
        'default_font_size': 10,
        'is_system': True, 'is_default': False, 'is_active': True,
    },
]


def seed_system_templates(apps, schema_editor):
    """Seed system templates for org=0 (global). Each org gets copies on first use."""
    LabelTemplate = apps.get_model('inventory', 'LabelTemplate')
    for tmpl in SYSTEM_TEMPLATES:
        LabelTemplate.objects.update_or_create(
            organization=0,
            name=tmpl['name'],
            label_type=tmpl['label_type'],
            defaults=tmpl,
        )


def remove_system_templates(apps, schema_editor):
    LabelTemplate = apps.get_model('inventory', 'LabelTemplate')
    LabelTemplate.objects.filter(organization=0, is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0039_harden_print_session_models'),
    ]

    operations = [
        migrations.RunPython(seed_system_templates, remove_system_templates),
    ]
