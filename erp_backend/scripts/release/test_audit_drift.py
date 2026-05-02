#!/usr/bin/env python3
"""Unit tests for audit_drift.py.

Builds three fixture migration trees under tests/drift_fixtures/ exemplifying
Categories A, F, and J, then asserts the detector finds them.

Run with:
    cd erp_backend/
    python3 -m unittest scripts.release.test_audit_drift
or:
    python3 scripts/release/test_audit_drift.py
"""
from __future__ import annotations

import shutil
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

# Make audit_drift importable when running this file directly.
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import audit_drift  # noqa: E402


# ──────────────────────────────────────────────────────────────────────
# Fixture builders
# ──────────────────────────────────────────────────────────────────────

# Cat A — AlterField on a field that was never added to state.
CAT_A_0001 = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        initial = True
        dependencies = []
        operations = [
            migrations.CreateModel(
                name='Widget',
                fields=[
                    ('id', models.BigAutoField(primary_key=True, serialize=False)),
                    ('label', models.CharField(max_length=50)),
                ],
            ),
        ]
''')

CAT_A_0002 = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        dependencies = [('cat_a_app', '0001_initial')]
        operations = [
            # Cat A: alter a field that was never added in any prior migration.
            migrations.AlterField(
                model_name='widget',
                name='ghost_field',
                field=models.IntegerField(null=True),
            ),
        ]
''')

# Cat F — AddField on a field already present in state.
CAT_F_0001 = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        initial = True
        dependencies = []
        operations = [
            migrations.CreateModel(
                name='Gadget',
                fields=[
                    ('id', models.BigAutoField(primary_key=True, serialize=False)),
                    ('color', models.CharField(max_length=20)),
                ],
            ),
        ]
''')

CAT_F_0002 = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        dependencies = [('cat_f_app', '0001_initial')]
        operations = [
            # Cat F: add a field that already exists in state from CreateModel.
            migrations.AddField(
                model_name='gadget',
                name='color',
                field=models.CharField(max_length=30),
            ),
        ]
''')

# Cat J — Two parallel branches at 0002 with no merge above them.
CAT_J_0001 = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        initial = True
        dependencies = []
        operations = [
            migrations.CreateModel(
                name='Sprocket',
                fields=[('id', models.BigAutoField(primary_key=True, serialize=False))],
            ),
        ]
''')

CAT_J_0002A = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        dependencies = [('cat_j_app', '0001_initial')]
        operations = [
            migrations.AddField(
                model_name='sprocket',
                name='size',
                field=models.IntegerField(default=1),
            ),
        ]
''')

CAT_J_0002B = textwrap.dedent('''\
    from django.db import migrations, models


    class Migration(migrations.Migration):
        dependencies = [('cat_j_app', '0001_initial')]
        operations = [
            migrations.AddField(
                model_name='sprocket',
                name='weight',
                field=models.IntegerField(default=0),
            ),
        ]
''')


def _write_migration_app(
    base: Path, app_dir_name: str, files: dict[str, str],
) -> Path:
    """Materialise a fake app at <base>/apps/<app_dir_name>/ with migration files."""
    app_dir = base / 'apps' / app_dir_name
    migrations_dir = app_dir / 'migrations'
    migrations_dir.mkdir(parents=True, exist_ok=True)
    (migrations_dir / '__init__.py').write_text('')
    # An empty models.py keeps Cat E happy.
    (app_dir / 'models.py').write_text('')
    for name, body in files.items():
        (migrations_dir / name).write_text(body)
    return app_dir


# ──────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────


class AuditDriftTests(unittest.TestCase):
    """Verify the detector against synthetic fixture migrations."""

    @classmethod
    def setUpClass(cls):
        # Build fixtures under tests/drift_fixtures/ relative to this script.
        cls.fixtures_root = SCRIPT_DIR.parent.parent / 'tests' / 'drift_fixtures'
        if cls.fixtures_root.exists():
            shutil.rmtree(cls.fixtures_root)
        cls.fixtures_root.mkdir(parents=True)

        _write_migration_app(cls.fixtures_root, 'cat_a_app', {
            '0001_initial.py': CAT_A_0001,
            '0002_alter_widget.py': CAT_A_0002,
        })
        _write_migration_app(cls.fixtures_root, 'cat_f_app', {
            '0001_initial.py': CAT_F_0001,
            '0002_addfield_gadget_color.py': CAT_F_0002,
        })
        _write_migration_app(cls.fixtures_root, 'cat_j_app', {
            '0001_initial.py': CAT_J_0001,
            '0002_sprocket_size.py': CAT_J_0002A,
            '0002_sprocket_weight.py': CAT_J_0002B,
        })

        # Patch audit_drift to look at these fixtures only.
        cls._original_erp_backend = audit_drift.ERP_BACKEND
        audit_drift.ERP_BACKEND = cls.fixtures_root

    @classmethod
    def tearDownClass(cls):
        audit_drift.ERP_BACKEND = cls._original_erp_backend
        if cls.fixtures_root.exists():
            shutil.rmtree(cls.fixtures_root)

    def test_discovery_finds_all_three_apps(self):
        apps = audit_drift.discover_apps()
        labels = {label for label, _ in apps}
        self.assertIn('cat_a_app', labels)
        self.assertIn('cat_f_app', labels)
        self.assertIn('cat_j_app', labels)

    def test_category_a_detected(self):
        result = audit_drift.run_audit(app_filter='cat_a_app')
        a_findings = result.get('A', [])
        self.assertEqual(len(a_findings), 1, f"expected 1 Cat A finding, got {a_findings}")
        self.assertIn('ghost_field', a_findings[0].message)
        self.assertEqual(a_findings[0].app, 'cat_a_app')

    def test_category_f_detected(self):
        result = audit_drift.run_audit(app_filter='cat_f_app')
        f_findings = result.get('F', [])
        self.assertEqual(len(f_findings), 1, f"expected 1 Cat F finding, got {f_findings}")
        self.assertIn('gadget', f_findings[0].message)
        self.assertIn('color', f_findings[0].message)

    def test_category_j_detected(self):
        result = audit_drift.run_audit(app_filter='cat_j_app')
        j_findings = result.get('J', [])
        self.assertEqual(len(j_findings), 1, f"expected 1 Cat J finding, got {j_findings}")
        self.assertIn('0002', j_findings[0].message)
        self.assertEqual(j_findings[0].app, 'cat_j_app')

    def test_clean_app_emits_no_findings(self):
        # cat_a_app's 0001 alone is clean — but the 0002 makes it dirty.
        # Build a transient clean-only app under a temp dir to verify the
        # detector returns 0 findings for healthy migrations.
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            _write_migration_app(td_path, 'clean_app', {
                '0001_initial.py': CAT_A_0001,  # only the CreateModel; no drift
            })
            saved = audit_drift.ERP_BACKEND
            audit_drift.ERP_BACKEND = td_path
            try:
                result = audit_drift.run_audit(app_filter='clean_app')
            finally:
                audit_drift.ERP_BACKEND = saved
            for cat, items in result.items():
                self.assertEqual(items, [], f"clean_app had {cat} findings: {items}")

    def test_exit_code_zero_when_only_squash_required(self):
        # Cat J alone shouldn't flip exit to 1 (per spec, only critical cats do).
        result = audit_drift.run_audit(app_filter='cat_j_app')
        critical = sum(len(result.get(c, [])) for c in audit_drift.CRITICAL_CATEGORIES)
        squash = sum(len(result.get(c, [])) for c in audit_drift.SQUASH_REQUIRED_CATEGORIES)
        self.assertEqual(critical, 0)
        self.assertGreaterEqual(squash, 1)

    def test_json_render_round_trips(self):
        result = audit_drift.run_audit(app_filter='cat_a_app')
        rendered = audit_drift.render_json(result, exit_code=1)
        import json
        payload = json.loads(rendered)
        self.assertEqual(payload['exit_code'], 1)
        self.assertGreaterEqual(payload['critical_count'], 1)
        self.assertIn('A', payload['by_category'])


if __name__ == '__main__':
    unittest.main()
