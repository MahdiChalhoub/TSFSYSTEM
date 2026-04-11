"""
Contract Documentation Generator
=================================
Generates beautiful markdown documentation for all event contracts.

Usage:
    from kernel.contracts.docs_generator import generate_contract_docs
    generate_contract_docs('docs/EVENT_CONTRACTS.md')
"""

from typing import Dict, List, Any
from .event_contracts import get_all_contracts, get_contracts_by_module
import json


def generate_contract_docs(output_file: str = None) -> str:
    """
    Generate comprehensive markdown documentation for all contracts.

    Args:
        output_file: Optional file path to write output

    Returns:
        Generated markdown string
    """
    contracts = get_all_contracts()

    # Group by module
    modules = {}
    for name, contract in contracts.items():
        owner = contract.get('owner_module', 'unknown')
        if owner not in modules:
            modules[owner] = []
        modules[owner].append({'name': name, **contract})

    # Generate markdown
    md = []
    md.append("# 📋 EVENT CONTRACTS REFERENCE\n")
    md.append("**Generated**: Auto-generated from contract registry\n")
    md.append("**Version**: 1.0.0\n")
    md.append("**Total Events**: {}\n".format(len(contracts)))
    md.append("\n---\n")

    # Table of Contents
    md.append("## 📑 Table of Contents\n")
    for module_name in sorted(modules.keys()):
        module_contracts = modules[module_name]
        md.append(f"- [{module_name.upper()} ({len(module_contracts)} events)](#️-{module_name}-module)\n")
    md.append("\n---\n")

    # Quick Reference Table
    md.append("## 🚀 Quick Reference\n")
    md.append("| Event | Producer | Consumers | Version |\n")
    md.append("|-------|----------|-----------|----------|\n")
    for name in sorted(contracts.keys()):
        contract = contracts[name]
        producer = contract.get('producer', '-')
        consumers = ', '.join(contract.get('consumers', []))
        version = contract.get('version', '1.0.0')
        md.append(f"| `{name}` | {producer} | {consumers} | {version} |\n")
    md.append("\n---\n")

    # Detailed documentation by module
    for module_name in sorted(modules.keys()):
        module_contracts = modules[module_name]

        md.append(f"## 🏗️ {module_name.upper()} Module\n")
        md.append(f"**Events**: {len(module_contracts)}\n\n")

        for contract in sorted(module_contracts, key=lambda x: x['name']):
            md.append(_generate_contract_detail(contract['name'], contract))
            md.append("\n---\n")

    markdown = ''.join(md)

    if output_file:
        with open(output_file, 'w') as f:
            f.write(markdown)

    return markdown


def _generate_contract_detail(name: str, contract: Dict[str, Any]) -> str:
    """Generate detailed documentation for a single contract"""
    md = []

    md.append(f"### `{name}`\n\n")

    # Description
    description = contract.get('description', 'No description')
    md.append(f"**Description**: {description}\n\n")

    # Metadata
    md.append("**Metadata**:\n")
    md.append(f"- **Producer**: `{contract.get('producer', 'unknown')}`\n")
    consumers = contract.get('consumers', [])
    if consumers:
        md.append(f"- **Consumers**: {', '.join(f'`{c}`' for c in consumers)}\n")
    md.append(f"- **Version**: {contract.get('version', '1.0.0')}\n")
    md.append(f"- **Owner Module**: `{contract.get('owner_module', 'unknown')}`\n\n")

    # Schema
    schema = contract.get('schema', {})
    md.append("**Payload Schema**:\n\n")
    md.append("```json\n")
    md.append(json.dumps(schema, indent=2))
    md.append("\n```\n\n")

    # Required fields
    if 'properties' in schema:
        required = schema.get('required', [])
        md.append("**Fields**:\n\n")
        md.append("| Field | Type | Required | Description |\n")
        md.append("|-------|------|----------|-------------|\n")

        for field_name, field_schema in schema.get('properties', {}).items():
            field_type = field_schema.get('type', 'any')
            is_required = '✅' if field_name in required else '❌'
            field_desc = field_schema.get('description', '-')

            # Handle enums
            if 'enum' in field_schema:
                field_type = f"{field_type} (enum)"

            md.append(f"| `{field_name}` | {field_type} | {is_required} | {field_desc} |\n")
        md.append("\n")

    # Usage example
    md.append("**Example Usage**:\n\n")
    md.append("```python\n")
    md.append("from kernel.events import emit_event\n\n")
    md.append(f"emit_event('{name}', {{\n")

    # Generate example payload
    if 'properties' in schema:
        required = schema.get('required', [])
        for i, field_name in enumerate(required[:5]):  # Show first 5 required fields
            field_schema = schema['properties'].get(field_name, {})
            example_value = _get_example_value(field_schema)
            comma = ',' if i < len(required[:5]) - 1 else ''
            md.append(f"    '{field_name}': {example_value}{comma}\n")

    md.append("})\n")
    md.append("```\n\n")

    return ''.join(md)


def _get_example_value(field_schema: Dict[str, Any]) -> str:
    """Generate example value for a field based on its schema"""
    field_type = field_schema.get('type', 'string')

    if 'enum' in field_schema:
        return f"'{field_schema['enum'][0]}'"

    if field_type == 'integer':
        return '123'
    elif field_type == 'number':
        return '99.99'
    elif field_type == 'boolean':
        return 'True'
    elif field_type == 'array':
        return '[]'
    elif field_type == 'object':
        return '{}'
    else:  # string
        if field_schema.get('format') == 'date':
            return "'2026-03-04'"
        elif field_schema.get('format') == 'date-time':
            return "'2026-03-04T10:30:00Z'"
        elif field_schema.get('format') == 'email':
            return "'user@example.com'"
        else:
            return "'value'"


def generate_module_communication_map() -> str:
    """
    Generate a visual map of module communication via events.

    Returns:
        Markdown with mermaid diagram
    """
    contracts = get_all_contracts()

    # Build relationships
    relationships = []
    for name, contract in contracts.items():
        producer = contract.get('producer', '')
        consumers = contract.get('consumers', [])

        for consumer in consumers:
            relationships.append((producer, consumer, name))

    # Generate mermaid diagram
    md = []
    md.append("# 🗺️ MODULE COMMUNICATION MAP\n\n")
    md.append("```mermaid\n")
    md.append("graph LR\n")

    # Group by producer
    by_producer = {}
    for producer, consumer, event in relationships:
        if producer not in by_producer:
            by_producer[producer] = []
        by_producer[producer].append((consumer, event))

    for producer, connections in sorted(by_producer.items()):
        for consumer, event in connections:
            md.append(f"    {producer}[{producer}] -->|{event}| {consumer}[{consumer}]\n")

    md.append("```\n\n")

    # Legend
    md.append("## Legend\n\n")
    md.append("- **Arrow**: Event flow direction (Producer → Consumer)\n")
    md.append("- **Label**: Event name\n")

    return ''.join(md)


def generate_module_contract_summary(module_name: str) -> str:
    """
    Generate summary of contracts for a specific module.

    Args:
        module_name: Module name (e.g., 'finance')

    Returns:
        Markdown summary
    """
    contracts = get_all_contracts()

    produces = []
    consumes = []

    for name, contract in contracts.items():
        if contract.get('producer') == module_name:
            produces.append(name)
        if module_name in contract.get('consumers', []):
            consumes.append(name)

    md = []
    md.append(f"# 📊 {module_name.upper()} Module Contracts\n\n")

    md.append(f"## 📤 Events Produced ({len(produces)})\n\n")
    if produces:
        for event in sorted(produces):
            md.append(f"- `{event}`\n")
    else:
        md.append("*No events produced*\n")

    md.append(f"\n## 📥 Events Consumed ({len(consumes)})\n\n")
    if consumes:
        for event in sorted(consumes):
            md.append(f"- `{event}`\n")
    else:
        md.append("*No events consumed*\n")

    return ''.join(md)
