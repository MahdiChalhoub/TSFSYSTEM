#!/usr/bin/env python3
"""
TSFSYSTEM Module Boundaries Enforcement Tool

Enforces architectural rules across the codebase:
- No direct cross-module imports (use events)
- No hardcoded values (use get_config)
- All models inherit TenantOwnedModel + AuditLogMixin
- RBAC checks on all views

Usage:
    python enforce.py check                    # Check all files
    python enforce.py check --staged           # Check only staged files
    python enforce.py check file.py            # Check specific file
    python enforce.py fix file.py              # Auto-fix violations (if possible)
    python enforce.py baseline                 # Create baseline of existing violations
    python enforce.py report                   # Generate detailed report
"""

import ast
import sys
import os
import re
import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime
import yaml

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


@dataclass
class Violation:
    """Represents a single architecture violation"""
    file: str
    line: int
    column: int
    rule: str
    severity: str  # error, warning
    message: str
    suggestion: Optional[str] = None
    code_snippet: Optional[str] = None


class EnforcementConfig:
    """Loads and manages enforcement configuration"""

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = PROJECT_ROOT / ".ai" / "enforcement" / "config.yaml"

        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)

    def get(self, path: str, default=None):
        """Get config value by dot notation path"""
        keys = path.split('.')
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def is_rule_enabled(self, rule: str) -> bool:
        """Check if a specific rule is enabled"""
        return self.get(f'enforcement.rules.{rule}', False) is not False

    def get_module_dependencies(self, module: str) -> List[str]:
        """Get allowed dependencies for a module"""
        return self.get(f'modules.{module}.allowed_dependencies', [])

    def is_whitelisted_import(self, import_line: str) -> bool:
        """Check if import matches whitelist patterns"""
        patterns = self.get('whitelist.imports', [])
        for pattern in patterns:
            if re.match(pattern, import_line):
                return True
        return False

    def is_whitelisted_hardcode(self, file_path: str, line: str) -> bool:
        """Check if hardcoded value is whitelisted"""
        hardcoded_whitelist = self.get('whitelist.hardcoded', [])

        for item in hardcoded_whitelist:
            file_pattern = item.get('file', '')
            code_pattern = item.get('pattern', '')

            # Check file pattern
            if '*' in file_pattern:
                file_regex = file_pattern.replace('*', '.*')
                if not re.search(file_regex, file_path):
                    continue
            elif file_pattern not in file_path:
                continue

            # Check code pattern
            if re.match(code_pattern, line.strip()):
                return True

        return False


class ModuleBoundaryEnforcer:
    """Enforces module boundary rules"""

    def __init__(self, config: EnforcementConfig):
        self.config = config
        self.violations: List[Violation] = []

    def check_file(self, file_path: str) -> List[Violation]:
        """Check a single file for violations"""
        self.violations = []
        file_path_obj = Path(file_path)

        if not file_path_obj.exists():
            return []

        # Skip non-Python files
        if file_path_obj.suffix != '.py':
            return []

        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        # Parse AST
        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError as e:
            self.violations.append(Violation(
                file=file_path,
                line=e.lineno or 0,
                column=e.offset or 0,
                rule='syntax',
                severity='error',
                message=f'Syntax error: {e.msg}',
                suggestion='Fix syntax errors before running enforcement'
            ))
            return self.violations

        # Get current module
        current_module = self._extract_module_name(file_path)

        # Run checks
        if self.config.is_rule_enabled('cross_module_imports'):
            self._check_cross_module_imports(tree, file_path, current_module, lines)

        if self.config.is_rule_enabled('hardcoded_values'):
            self._check_hardcoded_values(lines, file_path)

        if self.config.is_rule_enabled('tenant_isolation'):
            self._check_tenant_isolation(tree, file_path, lines)

        if self.config.is_rule_enabled('audit_logging'):
            self._check_audit_logging(tree, file_path, lines)

        if self.config.is_rule_enabled('rbac_checks'):
            self._check_rbac(tree, file_path, lines)

        return self.violations

    def _extract_module_name(self, file_path: str) -> str:
        """Extract module name from file path"""
        if '/apps/' in file_path:
            parts = file_path.split('/apps/')[-1].split('/')
            return parts[0] if parts else 'unknown'
        return 'unknown'

    def _check_cross_module_imports(self, tree: ast.AST, file_path: str,
                                     current_module: str, lines: List[str]):
        """Check for direct cross-module imports"""
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom):
                continue

            if not node.module or not node.module.startswith('apps.'):
                continue

            # Extract imported module
            parts = node.module.split('.')
            if len(parts) < 2:
                continue

            imported_module = parts[1]

            # Skip if importing from same module
            if imported_module == current_module:
                continue

            # Get line content
            line_content = lines[node.lineno - 1] if node.lineno <= len(lines) else ''

            # Check if whitelisted
            if self.config.is_whitelisted_import(line_content):
                continue

            # Check if dependency is allowed
            allowed_deps = self.config.get_module_dependencies(current_module)
            if imported_module in allowed_deps:
                continue

            # Violation found
            imported_items = ', '.join(alias.name for alias in node.names)
            self.violations.append(Violation(
                file=file_path,
                line=node.lineno,
                column=node.col_offset,
                rule='cross_module_import',
                severity='error',
                message=f'Cross-module import: {current_module} → {imported_module}',
                suggestion=(
                    f'Replace direct import with event-driven communication:\n'
                    f'  from kernel.events import emit_event\n'
                    f'  emit_event("{current_module}.needs_{imported_module}_data", {{"data": ...}})'
                ),
                code_snippet=line_content.strip()
            ))

    def _check_hardcoded_values(self, lines: List[str], file_path: str):
        """Check for hardcoded constant values"""
        constant_pattern = re.compile(r'^\s*([A-Z_]{3,})\s*=\s*(["\'].*["\']|[\d.]+)\s*$')

        for i, line in enumerate(lines, 1):
            # Skip comments
            if line.strip().startswith('#'):
                continue

            # Check if whitelisted
            if self.config.is_whitelisted_hardcode(file_path, line):
                continue

            # Skip if uses get_config or settings
            if 'get_config' in line or 'settings.' in line:
                continue

            # Skip Django model choices (allowed pattern)
            if 'CHOICES' in line or '_CHOICES' in line:
                continue

            # Check for constant assignment
            match = constant_pattern.match(line)
            if not match:
                continue

            const_name = match.group(1)
            const_value = match.group(2)

            # Skip allowed constants
            if const_name in ['DEBUG', 'TESTING', '__version__', '__all__']:
                continue

            # Violation found
            self.violations.append(Violation(
                file=file_path,
                line=i,
                column=0,
                rule='hardcoded_value',
                severity='error',
                message=f'Hardcoded constant: {const_name} = {const_value}',
                suggestion=(
                    f'Replace with configurable value:\n'
                    f'  from kernel.config import get_config\n'
                    f'  {const_name.lower()} = get_config("{const_name.lower()}", default={const_value})'
                ),
                code_snippet=line.strip()
            ))

    def _check_tenant_isolation(self, tree: ast.AST, file_path: str, lines: List[str]):
        """Check that models inherit from TenantOwnedModel"""
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue

            # Get base classes
            bases = [ast.unparse(b) for b in node.bases]
            bases_str = ' '.join(bases)

            # Check if it's a Django model
            is_model = any('models.Model' in base or 'Model' in base for base in bases)
            if not is_model:
                continue

            # Skip abstract models and special cases
            if 'Abstract' in node.name or node.name in self.config.get('whitelist.non_tenant_models', []):
                continue

            # Check for mixins (skip)
            if node.name.endswith('Mixin'):
                continue

            # Check for TenantOwnedModel
            has_tenant_model = 'TenantOwnedModel' in bases_str

            if not has_tenant_model:
                line_content = lines[node.lineno - 1] if node.lineno <= len(lines) else ''
                self.violations.append(Violation(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    rule='tenant_isolation',
                    severity='error',
                    message=f'Model "{node.name}" must inherit from TenantOwnedModel',
                    suggestion=(
                        f'Fix inheritance:\n'
                        f'  from kernel.tenancy.models import TenantOwnedModel\n'
                        f'  from kernel.audit.mixins import AuditLogMixin\n'
                        f'  class {node.name}(AuditLogMixin, TenantOwnedModel):'
                    ),
                    code_snippet=line_content.strip()
                ))

    def _check_audit_logging(self, tree: ast.AST, file_path: str, lines: List[str]):
        """Check that models include AuditLogMixin"""
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue

            bases = [ast.unparse(b) for b in node.bases]
            bases_str = ' '.join(bases)

            is_model = any('TenantOwnedModel' in base for base in bases)
            if not is_model:
                continue

            has_audit = 'AuditLogMixin' in bases_str

            if not has_audit:
                line_content = lines[node.lineno - 1] if node.lineno <= len(lines) else ''
                self.violations.append(Violation(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    rule='audit_logging',
                    severity='warning',
                    message=f'Model "{node.name}" should include AuditLogMixin',
                    suggestion=(
                        f'Add audit logging:\n'
                        f'  from kernel.audit.mixins import AuditLogMixin\n'
                        f'  class {node.name}(AuditLogMixin, TenantOwnedModel):'
                    ),
                    code_snippet=line_content.strip()
                ))

    def _check_rbac(self, tree: ast.AST, file_path: str, lines: List[str]):
        """Check for RBAC permission checks on views"""
        # Only check views.py files
        if 'views.py' not in file_path:
            return

        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue

            # Check if it's a view function
            has_request_param = any(arg.arg == 'request' for arg in node.args.args)
            if not has_request_param:
                continue

            # Check for permission decorator
            has_permission_dec = any(
                'permission' in ast.unparse(dec).lower() or
                'require_permission' in ast.unparse(dec)
                for dec in node.decorator_list
            )

            if not has_permission_dec:
                line_content = lines[node.lineno - 1] if node.lineno <= len(lines) else ''
                self.violations.append(Violation(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    rule='rbac_check',
                    severity='warning',
                    message=f'View "{node.name}" missing @require_permission decorator',
                    suggestion=(
                        f'Add permission check:\n'
                        f'  from kernel.rbac.decorators import require_permission\n'
                        f'  @require_permission("module.action")\n'
                        f'  def {node.name}(...):'
                    ),
                    code_snippet=line_content.strip()
                ))


def print_violations(violations: List[Violation], config: EnforcementConfig):
    """Print violations in a readable format"""
    if not violations:
        print("✅ No violations found!")
        return

    # Group by severity
    errors = [v for v in violations if v.severity == 'error']
    warnings = [v for v in violations if v.severity == 'warning']

    print(f"\n{'='*80}")
    print(f"Module Boundary Enforcement Report")
    print(f"{'='*80}\n")

    if errors:
        print(f"❌ ERRORS ({len(errors)}):\n")
        for i, v in enumerate(errors, 1):
            print(f"{i}. {v.file}:{v.line}:{v.column}")
            print(f"   Rule: {v.rule}")
            print(f"   {v.message}")
            if v.code_snippet:
                print(f"   Code: {v.code_snippet}")
            if config.get('reporting.show_suggestions') and v.suggestion:
                print(f"   Fix: {v.suggestion}")
            print()

    if warnings:
        print(f"⚠️  WARNINGS ({len(warnings)}):\n")
        for i, v in enumerate(warnings, 1):
            print(f"{i}. {v.file}:{v.line}:{v.column}")
            print(f"   Rule: {v.rule}")
            print(f"   {v.message}")
            if config.get('reporting.show_suggestions') and v.suggestion:
                print(f"   Fix: {v.suggestion}")
            print()

    print(f"{'='*80}")
    print(f"Summary: {len(errors)} error(s), {len(warnings)} warning(s)")
    print(f"{'='*80}\n")


def check_files(files: List[str], config: EnforcementConfig) -> List[Violation]:
    """Check multiple files for violations"""
    enforcer = ModuleBoundaryEnforcer(config)
    all_violations = []

    for file_path in files:
        violations = enforcer.check_file(file_path)
        all_violations.extend(violations)

    return all_violations


def get_staged_files() -> List[str]:
    """Get list of staged Python files"""
    import subprocess
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
        capture_output=True,
        text=True
    )
    files = result.stdout.strip().split('\n')
    return [f for f in files if f.endswith('.py')]


def get_all_python_files() -> List[str]:
    """Get all Python files in apps directory"""
    apps_dir = PROJECT_ROOT / 'erp_backend' / 'apps'
    if not apps_dir.exists():
        return []

    python_files = []
    for path in apps_dir.rglob('*.py'):
        # Skip migrations
        if '/migrations/' in str(path):
            continue
        python_files.append(str(path))

    return python_files


def create_baseline(violations: List[Violation], config: EnforcementConfig):
    """Create baseline of existing violations"""
    baseline_path = config.get('migration.baseline_file')
    baseline_data = {
        'created_at': datetime.now().isoformat(),
        'violations': [asdict(v) for v in violations],
        'counts': {
            'total': len(violations),
            'errors': len([v for v in violations if v.severity == 'error']),
            'warnings': len([v for v in violations if v.severity == 'warning'])
        }
    }

    baseline_file = Path(baseline_path)
    baseline_file.parent.mkdir(parents=True, exist_ok=True)

    with open(baseline_file, 'w') as f:
        json.dump(baseline_data, f, indent=2)

    print(f"✅ Baseline created: {baseline_path}")
    print(f"   Total violations: {baseline_data['counts']['total']}")


def main():
    parser = argparse.ArgumentParser(description='TSFSYSTEM Module Boundaries Enforcement')
    parser.add_argument('command', choices=['check', 'fix', 'baseline', 'report'],
                       help='Command to run')
    parser.add_argument('files', nargs='*', help='Specific files to check')
    parser.add_argument('--staged', action='store_true', help='Check only staged files')
    parser.add_argument('--config', help='Path to config file')

    args = parser.parse_args()

    # Load config
    config = EnforcementConfig(args.config)

    # Get files to check
    if args.files:
        files = args.files
    elif args.staged:
        files = get_staged_files()
        if not files:
            print("No staged Python files to check")
            return 0
    else:
        files = get_all_python_files()

    print(f"Checking {len(files)} file(s)...")

    # Check files
    violations = check_files(files, config)

    # Handle command
    if args.command == 'check':
        print_violations(violations, config)

        # Determine exit code
        errors = [v for v in violations if v.severity == 'error']
        if config.get('ci.fail_on_error') and errors:
            return 1

        warnings = [v for v in violations if v.severity == 'warning']
        if config.get('ci.fail_on_warning') and warnings:
            return 1

        return 0

    elif args.command == 'baseline':
        create_baseline(violations, config)
        return 0

    elif args.command == 'report':
        # TODO: Generate detailed HTML/JSON report
        print_violations(violations, config)
        return 0

    elif args.command == 'fix':
        print("Auto-fix not yet implemented")
        return 1


if __name__ == '__main__':
    sys.exit(main())
