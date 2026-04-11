"""
Module Manifest Parser

Parses and validates module.json files.
"""

from typing import Dict, Any, List
import json
import os
from dataclasses import dataclass


@dataclass
class ModuleManifest:
    """
    Represents a parsed module.json manifest.

    Example module.json:
    {
      "name": "inventory",
      "display_name": "Inventory Management",
      "version": "1.2.0",
      "description": "Stock management, warehouses, transfers",
      "author": "TSFSYSTEM Team",
      "license": "Proprietary",
      "category": "inventory",
      "depends_on": ["core", "sales"],
      "permissions": [
        "inventory.view_product",
        "inventory.create_product",
        "inventory.adjust_stock"
      ],
      "events_emitted": [
        "inventory.stock_moved",
        "inventory.product_created"
      ],
      "events_consumed": [
        "sales.order_created",
        "sales.order_cancelled"
      ],
      "config_schema": {
        "allow_negative_stock": {
          "type": "boolean",
          "default": false,
          "description": "Allow stock to go negative"
        }
      },
      "models": [
        "Product",
        "Warehouse",
        "StockMovement"
      ],
      "migrations": [
        "0001_initial.py",
        "0002_add_warehouse.py"
      ],
      "api_endpoints": [
        "/api/inventory/products",
        "/api/inventory/stock"
      ]
    }
    """

    # Required fields
    name: str
    version: str
    description: str

    # Optional fields
    display_name: str = ''
    author: str = ''
    license: str = 'Proprietary'
    category: str = ''

    # Dependencies
    depends_on: List[str] = None

    # RBAC
    permissions: List[str] = None

    # Events
    events_emitted: List[str] = None
    events_consumed: List[str] = None

    # Configuration
    config_schema: Dict[str, Any] = None

    # Database
    models: List[str] = None
    migrations: List[str] = None

    # API
    api_endpoints: List[str] = None

    def __post_init__(self):
        """Set defaults for list fields."""
        if self.depends_on is None:
            self.depends_on = []
        if self.permissions is None:
            self.permissions = []
        if self.events_emitted is None:
            self.events_emitted = []
        if self.events_consumed is None:
            self.events_consumed = []
        if self.config_schema is None:
            self.config_schema = {}
        if self.models is None:
            self.models = []
        if self.migrations is None:
            self.migrations = []
        if self.api_endpoints is None:
            self.api_endpoints = []
        if not self.display_name:
            self.display_name = self.name.title()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'version': self.version,
            'description': self.description,
            'author': self.author,
            'license': self.license,
            'category': self.category,
            'depends_on': self.depends_on,
            'permissions': self.permissions,
            'events_emitted': self.events_emitted,
            'events_consumed': self.events_consumed,
            'config_schema': self.config_schema,
            'models': self.models,
            'migrations': self.migrations,
            'api_endpoints': self.api_endpoints,
        }

    def validate(self) -> List[str]:
        """
        Validate manifest.

        Returns:
            List of error messages (empty if valid)
        """
        errors = []

        # Required fields
        if not self.name:
            errors.append("Missing required field: name")
        if not self.version:
            errors.append("Missing required field: version")
        if not self.description:
            errors.append("Missing required field: description")

        # Validate version format (semantic versioning)
        if self.version:
            parts = self.version.split('.')
            if len(parts) != 3:
                errors.append(f"Invalid version format: {self.version} (expected X.Y.Z)")
            else:
                for part in parts:
                    if not part.isdigit():
                        errors.append(f"Invalid version format: {self.version} (all parts must be numbers)")
                        break

        # Validate name (lowercase, alphanumeric, underscores)
        if self.name:
            if not self.name.replace('_', '').replace('-', '').isalnum():
                errors.append(f"Invalid module name: {self.name} (use lowercase, alphanumeric, underscore, hyphen)")

        return errors


def parse_manifest(manifest_path: str) -> ModuleManifest:
    """
    Parse module.json file.

    Args:
        manifest_path: Path to module.json file

    Returns:
        ModuleManifest instance

    Raises:
        FileNotFoundError: If manifest file doesn't exist
        ValueError: If manifest is invalid

    Example:
        manifest = parse_manifest('apps/inventory/module.json')
        print(manifest.name, manifest.version)
    """
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Manifest file not found: {manifest_path}")

    with open(manifest_path, 'r') as f:
        data = json.load(f)

    # Create manifest
    manifest = ModuleManifest(
        name=data.get('name', ''),
        display_name=data.get('display_name', ''),
        version=data.get('version', ''),
        description=data.get('description', ''),
        author=data.get('author', ''),
        license=data.get('license', 'Proprietary'),
        category=data.get('category', ''),
        depends_on=data.get('depends_on', []),
        permissions=data.get('permissions', []),
        events_emitted=data.get('events_emitted', []),
        events_consumed=data.get('events_consumed', []),
        config_schema=data.get('config_schema', {}),
        models=data.get('models', []),
        migrations=data.get('migrations', []),
        api_endpoints=data.get('api_endpoints', []),
    )

    # Validate
    errors = manifest.validate()
    if errors:
        raise ValueError(f"Invalid manifest: {'; '.join(errors)}")

    return manifest


def create_manifest_template(module_name: str) -> Dict[str, Any]:
    """
    Create a template module.json.

    Args:
        module_name: Module name

    Returns:
        Template manifest as dict

    Example:
        template = create_manifest_template('inventory')
        with open('apps/inventory/module.json', 'w') as f:
            json.dump(template, f, indent=2)
    """
    return {
        "name": module_name,
        "display_name": module_name.title(),
        "version": "1.0.0",
        "description": f"{module_name.title()} module",
        "author": "TSFSYSTEM Team",
        "license": "Proprietary",
        "category": module_name,
        "depends_on": ["core"],
        "permissions": [
            f"{module_name}.view",
            f"{module_name}.create",
            f"{module_name}.edit",
            f"{module_name}.delete"
        ],
        "events_emitted": [
            f"{module_name}.created",
            f"{module_name}.updated",
            f"{module_name}.deleted"
        ],
        "events_consumed": [],
        "config_schema": {},
        "models": [],
        "migrations": [],
        "api_endpoints": [
            f"/api/{module_name}"
        ]
    }
