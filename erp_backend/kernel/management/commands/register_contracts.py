"""
Management command to register all event contracts.

Usage:
    python manage.py register_contracts
    python manage.py register_contracts --generate-docs
    python manage.py register_contracts --module finance
"""

from django.core.management.base import BaseCommand
from kernel.contracts.event_contracts import register_all_contracts, get_all_contracts
from kernel.contracts.docs_generator import (
    generate_contract_docs,
    generate_module_communication_map,
    generate_module_contract_summary
)


class Command(BaseCommand):
    help = 'Register all event contracts and optionally generate documentation'

    def add_arguments(self, parser):
        parser.add_argument(
            '--generate-docs',
            action='store_true',
            help='Generate contract documentation'
        )
        parser.add_argument(
            '--module',
            type=str,
            help='Generate summary for specific module'
        )
        parser.add_argument(
            '--output',
            type=str,
            default='docs/EVENT_CONTRACTS.md',
            help='Output file for documentation'
        )
        parser.add_argument(
            '--map',
            action='store_true',
            help='Generate module communication map'
        )

    def handle(self, *args, **options):
        self.stdout.write("🔍 Registering event contracts...")

        # Register all contracts
        register_all_contracts()

        contracts = get_all_contracts()
        self.stdout.write(self.style.SUCCESS(
            f"✅ Registered {len(contracts)} event contracts"
        ))

        # List contracts
        self.stdout.write("\n📋 Registered Contracts:")
        for name in sorted(contracts.keys()):
            contract = contracts[name]
            producer = contract.get('producer', 'unknown')
            consumers = ', '.join(contract.get('consumers', []))
            self.stdout.write(
                f"  • {name} ({producer} → {consumers})"
            )

        # Generate documentation if requested
        if options['generate_docs']:
            self.stdout.write("\n📝 Generating contract documentation...")
            output_file = options['output']
            generate_contract_docs(output_file)
            self.stdout.write(self.style.SUCCESS(
                f"✅ Documentation generated: {output_file}"
            ))

        # Generate module summary
        if options['module']:
            module_name = options['module']
            self.stdout.write(f"\n📊 Module Summary: {module_name}")
            summary = generate_module_contract_summary(module_name)
            self.stdout.write(summary)

        # Generate communication map
        if options['map']:
            self.stdout.write("\n🗺️  Generating communication map...")
            map_content = generate_module_communication_map()
            map_file = 'docs/MODULE_COMMUNICATION_MAP.md'
            with open(map_file, 'w') as f:
                f.write(map_content)
            self.stdout.write(self.style.SUCCESS(
                f"✅ Communication map generated: {map_file}"
            ))

        self.stdout.write(self.style.SUCCESS("\n✨ Done!"))
