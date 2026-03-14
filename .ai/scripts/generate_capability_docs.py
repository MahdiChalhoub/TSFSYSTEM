#!/usr/bin/env python3
"""
Auto-Generate Capability Documentation
=======================================
Scans connector_service.py files and generates comprehensive documentation.

Usage:
    python .ai/scripts/generate_capability_docs.py

Output:
    DOCUMENTATION/CONNECTOR_CAPABILITIES.md
"""

import os
import ast
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict


def extract_capabilities(module_path):
    """Extract capabilities from connector_service.py"""
    capabilities = []

    service_file = os.path.join(module_path, 'connector_service.py')
    if not os.path.exists(service_file):
        return capabilities

    try:
        with open(service_file, 'r') as f:
            content = f.read()
            tree = ast.parse(content)

        # Find register_capabilities function
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Look for decorator pattern @_cap(registry, 'name', ...)
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Call):
                        # Extract capability info
                        cap_info = extract_capability_info(decorator, node)
                        if cap_info:
                            capabilities.append(cap_info)

    except Exception as e:
        print(f"Error parsing {service_file}: {e}")

    return capabilities


def extract_capability_info(decorator, func_node):
    """Extract capability information from decorator"""
    try:
        # Get capability name from args
        if len(decorator.args) >= 2:
            cap_name = ast.literal_eval(decorator.args[1])

            # Extract metadata from keywords
            description = ''
            fallback_type = 'READ'
            critical = False
            cacheable = True
            cache_ttl = 300

            for keyword in decorator.keywords:
                if keyword.arg == 'description':
                    description = ast.literal_eval(keyword.value)
                elif keyword.arg == 'fallback_type':
                    fallback_type = ast.literal_eval(keyword.value)
                elif keyword.arg == 'critical':
                    critical = ast.literal_eval(keyword.value)
                elif keyword.arg == 'cacheable':
                    cacheable = ast.literal_eval(keyword.value)
                elif keyword.arg == 'cache_ttl':
                    cache_ttl = ast.literal_eval(keyword.value)

            return {
                'name': cap_name,
                'function': func_node.name,
                'description': description,
                'fallback_type': fallback_type,
                'critical': critical,
                'cacheable': cacheable,
                'cache_ttl': cache_ttl,
            }
    except:
        pass

    return None


def generate_markdown_docs(all_capabilities):
    """Generate markdown documentation"""

    md = "# Connector Capabilities Reference\n\n"
    md += f"**Auto-generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    md += f"**Total Capabilities:** {sum(len(caps) for caps in all_capabilities.values())}\n\n"

    md += "## Overview\n\n"
    md += "This document catalogs all connector capabilities across TSFSYSTEM modules. "
    md += "Capabilities are the building blocks of inter-module communication.\n\n"

    # Statistics table
    md += "### Statistics\n\n"
    md += "| Module | Capabilities | Critical | Cacheable |\n"
    md += "|--------|:------------:|:--------:|:---------:|\n"

    for module, capabilities in sorted(all_capabilities.items()):
        critical_count = sum(1 for c in capabilities if c.get('critical'))
        cacheable_count = sum(1 for c in capabilities if c.get('cacheable'))
        md += f"| **{module}** | {len(capabilities)} | {critical_count} | {cacheable_count} |\n"

    md += "\n"

    # Detailed capability listing
    md += "## Capabilities by Module\n\n"

    for module, capabilities in sorted(all_capabilities.items()):
        md += f"### {module.upper()} Module\n\n"
        md += f"**Total:** {len(capabilities)} capabilities\n\n"

        # Group by domain
        by_domain = defaultdict(list)
        for cap in capabilities:
            parts = cap['name'].split('.')
            domain = parts[1] if len(parts) > 1 else 'general'
            by_domain[domain].append(cap)

        for domain, caps in sorted(by_domain.items()):
            md += f"#### {domain.title()}\n\n"

            for cap in sorted(caps, key=lambda x: x['name']):
                # Capability header
                md += f"**`{cap['name']}`**\n\n"

                # Badges
                badges = []
                if cap.get('critical'):
                    badges.append('🔴 CRITICAL')
                badges.append(f"📊 {cap['fallback_type']}")
                if cap.get('cacheable'):
                    badges.append(f"⚡ Cached ({cap.get('cache_ttl', 300)}s)")

                if badges:
                    md += " ".join(badges) + "\n\n"

                # Description
                if cap.get('description'):
                    md += f"{cap['description']}\n\n"

                # Usage example
                md += f"```python\n"
                if cap['fallback_type'] == 'READ':
                    md += f"result = connector.require(\n"
                    md += f"    '{cap['name']}',\n"
                    md += f"    org_id=organization.id\n"
                    md += f")\n"
                else:
                    md += f"connector.execute(\n"
                    md += f"    '{cap['name']}',\n"
                    md += f"    org_id=organization.id,\n"
                    md += f"    data={{}}\n"
                    md += f")\n"
                md += f"```\n\n"

                md += "---\n\n"

    # Usage guide
    md += "## Usage Guide\n\n"
    md += "### READ Operations (connector.require)\n\n"
    md += "```python\n"
    md += "from erp.connector_registry import connector\n\n"
    md += "# Get data from another module\n"
    md += "result = connector.require(\n"
    md += "    'inventory.products.get_detail',\n"
    md += "    org_id=request.tenant.id,\n"
    md += "    product_id=123,\n"
    md += "    fallback=None  # Returned if module unavailable\n"
    md += ")\n"
    md += "```\n\n"

    md += "### WRITE Operations (connector.execute)\n\n"
    md += "```python\n"
    md += "# Execute action in another module\n"
    md += "connector.execute(\n"
    md += "    'finance.journal.post_entry',\n"
    md += "    org_id=request.tenant.id,\n"
    md += "    data={'amount': 100, 'description': 'Sale'}\n"
    md += ")\n"
    md += "# Buffered if module unavailable, replayed when available\n"
    md += "```\n\n"

    md += "### Check Availability\n\n"
    md += "```python\n"
    md += "if connector.available('crm.contacts.get_detail', org_id=org.id):\n"
    md += "    contact = connector.require('crm.contacts.get_detail', ...)\n"
    md += "```\n\n"

    # Architecture notes
    md += "## Architecture Notes\n\n"
    md += "### Critical Capabilities\n\n"
    md += "Capabilities marked as **CRITICAL** will fail hard if the module is unavailable. "
    md += "Use for operations where silent failure would violate business logic (e.g., journal posting).\n\n"

    md += "### Caching\n\n"
    md += "Cached capabilities store responses in Redis for fast fallback when modules are degraded. "
    md += "Cache TTL ranges from 60-300 seconds depending on data volatility.\n\n"

    md += "### Module States\n\n"
    md += "- **AVAILABLE**: Normal operation\n"
    md += "- **DEGRADED**: Circuit breaker tripped, serving from cache\n"
    md += "- **DISABLED**: Admin disabled, buffering writes\n"
    md += "- **UNINSTALLED**: Module removed, returning fallback\n\n"

    return md


def main():
    """Main execution"""
    print("🔍 Scanning for connector capabilities...")

    apps_dir = 'erp_backend/apps'
    all_capabilities = {}

    # Scan all modules
    for module in os.listdir(apps_dir):
        module_path = os.path.join(apps_dir, module)
        if os.path.isdir(module_path):
            caps = extract_capabilities(module_path)
            if caps:
                all_capabilities[module] = caps
                print(f"✅ {module}: {len(caps)} capabilities")

    # Generate documentation
    md = generate_markdown_docs(all_capabilities)

    # Write to file
    output_file = 'DOCUMENTATION/CONNECTOR_CAPABILITIES.md'
    os.makedirs('DOCUMENTATION', exist_ok=True)

    with open(output_file, 'w') as f:
        f.write(md)

    total_caps = sum(len(c) for c in all_capabilities.values())
    print(f"\n✅ Generated documentation: {total_caps} capabilities across {len(all_capabilities)} modules")
    print(f"📄 Output: {output_file}")


if __name__ == '__main__':
    main()
