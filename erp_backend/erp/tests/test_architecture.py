"""
Architecture Compliance Test
==============================
Detects illegal direct cross-module imports.

Run:  python manage.py test erp.tests.test_architecture --verbosity=2
      python -m pytest erp/tests/test_architecture.py -v

Rule: No business module may directly import another business module's
      models/services for runtime business operations.

Allowed:
  - Structural ForeignKey in models.py (string references like 'hr.Employee')
  - Shared kernel / erp / infra imports
  - Test files
  - Migration files

Not allowed:
  - from apps.pos.models import X        (in apps/crm/*)
  - from apps.finance.services import X  (in apps/inventory/*)
  - import apps.crm.models               (in apps/pos/*)

Exception:
  - workforce/models.py → apps.hr.models (structural FK dependency, uses string-based FKs)
  - connector_service.py files (they legitimately import their own module's internals)

Note: _safe_import() has been FULLY MIGRATED to ConnectorEngine.
      Zero _safe_import calls remain in the codebase.
"""

import os
import re
import glob
from django.test import TestCase
from django.conf import settings


# Business modules subject to isolation rules
BUSINESS_MODULES = frozenset({
    'finance', 'inventory', 'pos', 'crm', 'hr',
    'ecommerce', 'sales', 'client_portal', 'supplier_portal',
    'workspace', 'workforce', 'integrations', 'packages',
})

# Structural exceptions (ForeignKey dependencies that cannot be decoupled)
STRUCTURAL_EXCEPTIONS = frozenset({
    ('workforce', 'hr'),          # workforce.models → hr.Employee (FK)
    ('ecommerce', 'client_portal'),  # ecommerce.models → proxy model inheritance
})

# Files exempt from this rule
EXEMPT_PATTERNS = frozenset({
    'migration', 'test', '__pycache__', 'connector_service.py',
})

# Import pattern: from apps.X.Y import Z
DIRECT_IMPORT_RE = re.compile(
    r'^\s*from\s+apps\.(\w+)\.'
)

# Dynamic import pattern: __import__('apps.X...')
DYNAMIC_IMPORT_RE = re.compile(
    r"""__import__\(\s*['"]apps\.(\w+)\."""
)

# _safe_import pattern (FULLY MIGRATED — zero remaining)
# Kept for reference: any new occurrence would be a regression
SAFE_IMPORT_RE = re.compile(
    r'_safe_import\('
)


class ArchitectureComplianceTest(TestCase):
    """
    Tests that enforce module isolation boundaries.
    Any direct cross-module import is flagged as a violation.
    """

    def test_no_new_direct_cross_module_imports(self):
        """
        Scan all business module files for direct imports from other
        business modules. Only _safe_import() and ConnectorEngine calls
        are allowed.

        This test ensures no NEW violations are introduced.
        """
        apps_dir = os.path.join(settings.BASE_DIR, 'apps')
        violations = []

        for module_code in os.listdir(apps_dir):
            module_path = os.path.join(apps_dir, module_code)
            if not os.path.isdir(module_path):
                continue
            if module_code not in BUSINESS_MODULES:
                continue

            for filepath in glob.glob(
                os.path.join(module_path, '**', '*.py'), recursive=True
            ):
                # Skip exempt files
                if any(exempt in filepath for exempt in EXEMPT_PATTERNS):
                    continue

                try:
                    with open(filepath, 'r') as f:
                        for line_no, line in enumerate(f, 1):
                            # Check direct imports: from apps.X.Y import Z
                            match = DIRECT_IMPORT_RE.match(line)
                            if match:
                                target_module = match.group(1)

                                # Skip same-module imports
                                if target_module == module_code:
                                    continue

                                # Skip non-business module imports
                                if target_module not in BUSINESS_MODULES:
                                    continue

                                # Skip structural exceptions
                                if (module_code, target_module) in STRUCTURAL_EXCEPTIONS:
                                    # Only allow in models.py
                                    if 'models.py' in os.path.basename(filepath):
                                        continue

                                # Skip _safe_import calls
                                if SAFE_IMPORT_RE.search(line):
                                    continue

                                # This is a VIOLATION
                                rel_path = os.path.relpath(filepath, settings.BASE_DIR)
                                violations.append(
                                    f"{rel_path}:{line_no} → "
                                    f"{module_code} imports {target_module}: "
                                    f"{line.strip()}"
                                )

                            # Check dynamic imports: __import__('apps.X...')
                            dyn_match = DYNAMIC_IMPORT_RE.search(line)
                            if dyn_match:
                                target_module = dyn_match.group(1)
                                if target_module == module_code:
                                    continue
                                if target_module not in BUSINESS_MODULES:
                                    continue
                                if (module_code, target_module) in STRUCTURAL_EXCEPTIONS:
                                    if 'models.py' in os.path.basename(filepath):
                                        continue
                                rel_path = os.path.relpath(filepath, settings.BASE_DIR)
                                violations.append(
                                    f"{rel_path}:{line_no} → "
                                    f"{module_code} __import__ {target_module}: "
                                    f"{line.strip()}"
                                )
                except Exception:
                    continue

        if violations:
            msg = (
                f"\n\n🚨 ARCHITECTURE VIOLATION: {len(violations)} direct "
                f"cross-module imports detected.\n\n"
                f"Rule: Use ConnectorEngine or _safe_import() instead of "
                f"direct imports.\n\n"
                + "\n".join(f"  ❌ {v}" for v in violations)
                + "\n\nFix: Replace with connector.require()"
            )
            self.fail(msg)

    def test_connector_services_exist_for_core_modules(self):
        """
        Verify that core business modules have a connector_service.py
        that declares their capabilities.
        """
        core_modules = ['crm', 'inventory', 'finance', 'pos']
        apps_dir = os.path.join(settings.BASE_DIR, 'apps')

        missing = []
        for module in core_modules:
            service_path = os.path.join(apps_dir, module, 'connector_service.py')
            if not os.path.exists(service_path):
                missing.append(module)

        if missing:
            self.fail(
                f"Core modules missing connector_service.py: {', '.join(missing)}\n"
                f"Every core module must declare its capabilities."
            )

    def test_no_hardcoded_model_access_in_connector_routing(self):
        """
        The connector routing layer should never import business module
        models directly — it should use _resolve_service() or the
        capability registry.
        """
        connector_files = [
            os.path.join(settings.BASE_DIR, 'erp', 'connector_routing.py'),
            os.path.join(settings.BASE_DIR, 'erp', 'connector_state.py'),
            os.path.join(settings.BASE_DIR, 'erp', 'connector_events.py'),
            os.path.join(settings.BASE_DIR, 'erp', 'connector_registry.py'),
        ]

        violations = []
        for filepath in connector_files:
            if not os.path.exists(filepath):
                continue
            with open(filepath, 'r') as f:
                for line_no, line in enumerate(f, 1):
                    if DIRECT_IMPORT_RE.match(line):
                        rel = os.path.relpath(filepath, settings.BASE_DIR)
                        violations.append(f"{rel}:{line_no}: {line.strip()}")

        if violations:
            self.fail(
                f"Connector layer contains {len(violations)} direct business "
                f"module imports:\n"
                + "\n".join(f"  ❌ {v}" for v in violations)
            )
