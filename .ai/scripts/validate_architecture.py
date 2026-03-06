#!/usr/bin/env python3
"""
TSFSYSTEM Architecture Validator

Validates code against TSFSYSTEM architecture requirements:
- Models inherit TenantOwnedModel + AuditLogMixin
- No hardcoded values (must use get_config)
- No cross-module imports (must use events)
- Tenant isolation maintained
- RBAC permissions checked

Usage:
    python validate_architecture.py <file_path>
    python validate_architecture.py apps/finance/models.py

Exit Codes:
    0 - All checks passed
    1 - Architecture violations found
"""

import ast
import sys
import re
from pathlib import Path
from typing import List, Tuple

class ArchitectureValidator:
    """Validates Python files against TSFSYSTEM architecture rules"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.file_path_obj = Path(file_path)

        if not self.file_path_obj.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(file_path, 'r') as f:
            self.content = f.read()

        try:
            self.tree = ast.parse(self.content)
        except SyntaxError as e:
            raise SyntaxError(f"Cannot parse {file_path}: {e}")

        self.errors = []
        self.warnings = []
        self.current_module = self._get_current_module()

    def _get_current_module(self) -> str:
        """Extract module name from file path"""
        if '/apps/' in self.file_path:
            parts = self.file_path.split('/apps/')[-1].split('/')
            return parts[0] if parts else 'unknown'
        return 'unknown'

    def validate(self) -> Tuple[bool, List[str], List[str]]:
        """Run all validation checks"""
        self.check_model_inheritance()
        self.check_hardcoded_values()
        self.check_cross_module_imports()
        self.check_config_usage()
        self.check_event_usage()
        self.check_rbac_usage()

        is_valid = len(self.errors) == 0
        return is_valid, self.errors, self.warnings

    def check_model_inheritance(self):
        """Ensure Django models inherit from TenantOwnedModel and include AuditLogMixin"""
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.ClassDef):
                continue

            # Get base classes
            bases = [ast.unparse(b) for b in node.bases]
            bases_str = ' '.join(bases)

            # Check if it's a Django model
            is_model = any(
                'models.Model' in base or
                'Model' in base
                for base in bases
            )

            if not is_model:
                continue

            # Skip if it's an abstract model or test
            if 'Abstract' in node.name or 'Test' in node.name:
                continue

            # Check for TenantOwnedModel
            has_tenant_model = 'TenantOwnedModel' in bases_str
            has_audit_mixin = 'AuditLogMixin' in bases_str

            if not has_tenant_model:
                self.errors.append(
                    f"Line {node.lineno}: Model '{node.name}' must inherit from TenantOwnedModel\n"
                    f"  Fix: class {node.name}(AuditLogMixin, TenantOwnedModel):"
                )

            if not has_audit_mixin:
                self.warnings.append(
                    f"Line {node.lineno}: Model '{node.name}' should include AuditLogMixin for audit logging\n"
                    f"  Recommended: class {node.name}(AuditLogMixin, TenantOwnedModel):"
                )

    def check_hardcoded_values(self):
        """Check for hardcoded constants that should use get_config()"""
        lines = self.content.split('\n')

        # Patterns for hardcoded values
        constant_patterns = [
            (r'^\s*[A-Z_]{2,}\s*=\s*["\']', 'Hardcoded string constant'),
            (r'^\s*[A-Z_]{2,}\s*=\s*\d+\.?\d*$', 'Hardcoded numeric constant'),
            (r'^\s*[A-Z_]{2,}\s*=\s*\[', 'Hardcoded list constant'),
            (r'^\s*[A-Z_]{2,}\s*=\s*\{', 'Hardcoded dict constant'),
        ]

        # Allowed constants (don't flag these)
        allowed_constants = [
            'DEBUG', 'TESTING', '__version__', '__all__',
            'CHOICES', 'STATUS_CHOICES', '_META',  # Django patterns
        ]

        for i, line in enumerate(lines, 1):
            # Skip if line uses get_config
            if 'get_config' in line or 'settings.' in line:
                continue

            # Skip if it's a class or function definition
            if 'class ' in line or 'def ' in line:
                continue

            # Skip comments
            if line.strip().startswith('#'):
                continue

            for pattern, msg in constant_patterns:
                if re.match(pattern, line):
                    # Extract constant name
                    const_name = line.split('=')[0].strip()

                    # Skip allowed constants
                    if any(allowed in const_name for allowed in allowed_constants):
                        continue

                    self.errors.append(
                        f"Line {i}: {msg}: {const_name}\n"
                        f"  Fix: Use get_config('{const_name.lower()}', default=...)"
                    )

    def check_cross_module_imports(self):
        """Check for direct cross-module imports"""
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.ImportFrom):
                continue

            if not node.module or not node.module.startswith('apps.'):
                continue

            # Extract imported module
            parts = node.module.split('.')
            if len(parts) < 2:
                continue

            imported_module = parts[1]

            # Check if importing from different module
            if imported_module != self.current_module:
                imported_items = ', '.join(alias.name for alias in node.names)
                self.errors.append(
                    f"Line {node.lineno}: Cross-module import from 'apps.{imported_module}'\n"
                    f"  Importing: {imported_items}\n"
                    f"  Fix: Use events for cross-module communication:\n"
                    f"    from kernel.events import emit_event\n"
                    f"    emit_event('module.event_name', {{'data': ...}})"
                )

    def check_config_usage(self):
        """Ensure get_config is properly imported when used"""
        uses_config = 'get_config(' in self.content
        imports_config = any(
            'from kernel.config import' in line and 'get_config' in line
            for line in self.content.split('\n')
        )

        if uses_config and not imports_config:
            self.errors.append(
                "get_config() is used but not imported\n"
                "  Fix: Add 'from kernel.config import get_config' at the top"
            )

    def check_event_usage(self):
        """Check for proper event emission patterns"""
        uses_emit = 'emit_event(' in self.content
        imports_emit = any(
            'from kernel.events import' in line and 'emit_event' in line
            for line in self.content.split('\n')
        )

        if uses_emit and not imports_emit:
            self.errors.append(
                "emit_event() is used but not imported\n"
                "  Fix: Add 'from kernel.events import emit_event' at the top"
            )

    def check_rbac_usage(self):
        """Check for permission checking patterns"""
        # Look for views that might need permission checks
        has_view_function = False
        has_permission_check = False

        for node in ast.walk(self.tree):
            if isinstance(node, ast.FunctionDef):
                # Check if it's a view function (has request parameter)
                if any(arg.arg == 'request' for arg in node.args.args):
                    has_view_function = True

                    # Check for permission decorators
                    has_decorator = any(
                        'permission' in ast.unparse(dec).lower() or
                        'require_permission' in ast.unparse(dec)
                        for dec in node.decorator_list
                    )

                    if has_decorator:
                        has_permission_check = True

        if has_view_function and not has_permission_check:
            self.warnings.append(
                "View functions detected without @require_permission decorator\n"
                "  Recommended: Add permission checks:\n"
                "    from kernel.rbac.decorators import require_permission\n"
                "    @require_permission('module.action')"
            )


def print_results(file_path: str, is_valid: bool, errors: List[str], warnings: List[str]):
    """Print validation results"""
    print(f"\n{'='*80}")
    print(f"Architecture Validation: {file_path}")
    print(f"{'='*80}\n")

    if is_valid and not warnings:
        print(f"✅ PASS - No architecture violations found\n")
        return

    if errors:
        print(f"❌ ERRORS ({len(errors)}):")
        print(f"{'-'*80}")
        for i, error in enumerate(errors, 1):
            print(f"\n{i}. {error}")
        print()

    if warnings:
        print(f"⚠️  WARNINGS ({len(warnings)}):")
        print(f"{'-'*80}")
        for i, warning in enumerate(warnings, 1):
            print(f"\n{i}. {warning}")
        print()

    if errors:
        print(f"❌ VALIDATION FAILED - {len(errors)} error(s) must be fixed")
    else:
        print(f"✅ VALIDATION PASSED - {len(warnings)} warning(s) to review")

    print(f"\n{'='*80}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_architecture.py <file_path>")
        print("\nExample:")
        print("  python validate_architecture.py apps/finance/models.py")
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        validator = ArchitectureValidator(file_path)
        is_valid, errors, warnings = validator.validate()
        print_results(file_path, is_valid, errors, warnings)

        # Exit with error code if validation failed
        sys.exit(0 if is_valid else 1)

    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    except SyntaxError as e:
        print(f"❌ Syntax Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
