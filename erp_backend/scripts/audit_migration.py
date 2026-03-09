#!/usr/bin/env python3
"""
Migration Audit Tool
====================
Comprehensive audit and analysis of migration_v2 jobs.

Usage:
    python scripts/audit_migration.py                    # Audit latest job
    python scripts/audit_migration.py --job-id 5          # Audit specific job
    python scripts/audit_migration.py --export csv        # Export to CSV
    python scripts/audit_migration.py --flagged-only      # Show only flagged records
"""

import os
import sys
import django
import argparse
import json
from datetime import datetime
from decimal import Decimal

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.migration_v2.models import MigrationJob, MigrationMapping, MigrationValidationResult
from django.db.models import Count, Q
from django.utils import timezone


class MigrationAuditor:
    """Audit migration jobs and generate reports."""

    def __init__(self, job_id=None):
        if job_id:
            self.job = MigrationJob.objects.get(id=job_id)
        else:
            self.job = MigrationJob.objects.order_by('-id').first()

        if not self.job:
            print("❌ No migration jobs found in database")
            sys.exit(1)

    def print_header(self):
        """Print audit report header."""
        print("\n" + "=" * 80)
        print(f"MIGRATION AUDIT REPORT - Job #{self.job.id}".center(80))
        print("=" * 80)
        print(f"\nJob Name: {self.job.name}")
        print(f"Status: {self.job.status}")
        print(f"Organization: {self.job.target_organization.name}")
        print(f"COA Template: {self.job.coa_template_used or 'N/A'}")
        print(f"Progress: {self.job.progress_percent}%")
        print(f"Started: {self.job.started_at or 'Not started'}")
        print(f"Completed: {self.job.completed_at or 'Running...'}")

        if self.job.started_at and self.job.completed_at:
            duration = self.job.completed_at - self.job.started_at
            print(f"Duration: {duration}")

        print("\n" + "-" * 80)

    def print_entity_summary(self):
        """Print summary by entity type."""
        print("\n📊 ENTITY TYPE BREAKDOWN")
        print("-" * 80)

        mappings = MigrationMapping.objects.filter(job=self.job).values('entity_type').annotate(
            total=Count('id'),
            verified=Count('id', filter=Q(verify_status='VERIFIED')),
            pending=Count('id', filter=Q(verify_status='PENDING')),
            flagged=Count('id', filter=Q(verify_status='FLAGGED')),
            rejected=Count('id', filter=Q(verify_status='REJECTED'))
        )

        print(f"{'Entity Type':<20} {'Total':>8} {'Verified':>10} {'Pending':>10} {'Flagged':>10} {'Rejected':>10}")
        print("-" * 80)

        for m in mappings:
            verification_rate = (m['verified'] / m['total'] * 100) if m['total'] > 0 else 0
            print(f"{m['entity_type']:<20} {m['total']:>8} {m['verified']:>10} {m['pending']:>10} "
                  f"{m['flagged']:>10} {m['rejected']:>10}  ({verification_rate:.1f}%)")

    def print_flagged_records(self):
        """Print all flagged records."""
        print("\n🚩 FLAGGED RECORDS (Require Manual Review)")
        print("-" * 80)

        flagged = MigrationMapping.objects.filter(
            job=self.job,
            verify_status='FLAGGED'
        ).order_by('entity_type', 'created_at')

        if not flagged.exists():
            print("✅ No flagged records - all data verified successfully!")
            return

        for record in flagged:
            print(f"\nEntity: {record.entity_type}")
            print(f"Source ID: {record.source_id}")
            print(f"Target ID: {record.target_id}")
            print(f"Reason: {record.verify_notes or 'No reason provided'}")

            # Show relevant source data
            if record.source_data:
                if record.entity_type == 'PRODUCT':
                    print(f"Product: {record.source_data.get('name', 'N/A')} (SKU: {record.source_data.get('sku', 'N/A')})")
                elif record.entity_type == 'CONTACT':
                    print(f"Contact: {record.source_data.get('name', 'N/A')} ({record.source_data.get('type', 'N/A')})")
                elif record.entity_type == 'TRANSACTION':
                    print(f"Transaction: {record.source_data.get('invoice_no', 'N/A')} "
                          f"(Amount: {record.source_data.get('final_total', 'N/A')})")

    def print_validation_results(self):
        """Print pre-flight validation results."""
        print("\n✅ VALIDATION RESULTS")
        print("-" * 80)

        try:
            validation = MigrationValidationResult.objects.get(job=self.job)

            print(f"Overall Status: {'✅ PASSED' if validation.is_valid else '❌ FAILED'}")
            print(f"Has COA: {'✅ Yes' if validation.has_coa else '❌ No'}")
            print(f"COA Accounts: {validation.coa_account_count}")
            print(f"Has Posting Rules: {'✅ Yes' if validation.has_posting_rules else '❌ No'}")
            print(f"Validated At: {validation.validated_at}")

            if validation.errors:
                print(f"\n❌ ERRORS ({len(validation.errors)}):")
                for idx, error in enumerate(validation.errors, 1):
                    print(f"  {idx}. {error}")

            if validation.warnings:
                print(f"\n⚠️  WARNINGS ({len(validation.warnings)}):")
                for idx, warning in enumerate(validation.warnings, 1):
                    print(f"  {idx}. {warning}")

        except MigrationValidationResult.DoesNotExist:
            print("⚠️  No validation results found - job may not have been validated yet")

    def print_sample_products(self, limit=10):
        """Print sample migrated products."""
        print(f"\n📦 SAMPLE PRODUCTS (First {limit})")
        print("-" * 80)

        products = MigrationMapping.objects.filter(
            job=self.job,
            entity_type='PRODUCT'
        ).order_by('created_at')[:limit]

        if not products.exists():
            print("No products migrated yet")
            return

        for p in products:
            source_data = p.source_data or {}
            status_icon = {
                'VERIFIED': '✅',
                'PENDING': '⏳',
                'FLAGGED': '🚩',
                'REJECTED': '❌'
            }.get(p.verify_status, '❓')

            print(f"{status_icon} {source_data.get('name', 'N/A')[:40]:<40} "
                  f"SKU: {source_data.get('sku', 'N/A'):<15} "
                  f"Type: {source_data.get('type', 'N/A'):<10}")

    def print_sample_contacts(self, limit=10):
        """Print sample migrated contacts."""
        print(f"\n👥 SAMPLE CONTACTS (First {limit})")
        print("-" * 80)

        contacts = MigrationMapping.objects.filter(
            job=self.job,
            entity_type='CONTACT'
        ).order_by('created_at')[:limit]

        if not contacts.exists():
            print("No contacts migrated yet")
            return

        for c in contacts:
            source_data = c.source_data or {}
            status_icon = {
                'VERIFIED': '✅',
                'PENDING': '⏳',
                'FLAGGED': '🚩',
                'REJECTED': '❌'
            }.get(c.verify_status, '❓')

            contact_type = source_data.get('type', 'N/A')
            print(f"{status_icon} {source_data.get('name', 'N/A')[:40]:<40} "
                  f"Type: {contact_type:<15} "
                  f"Mobile: {source_data.get('mobile', 'N/A'):<15}")

    def print_account_mappings(self, limit=15):
        """Print COA account mappings."""
        print(f"\n💰 CHART OF ACCOUNTS MAPPING (First {limit})")
        print("-" * 80)

        accounts = MigrationMapping.objects.filter(
            job=self.job,
            entity_type='ACCOUNT'
        ).order_by('source_id')[:limit]

        if not accounts.exists():
            print("No account mappings found")
            return

        print(f"{'Source Account':<30} {'Source Type':<20} {'Target Account':<30}")
        print("-" * 80)

        for a in accounts:
            source_data = a.source_data or {}
            transformed_data = a.transformed_data or {}

            source_name = source_data.get('name', 'N/A')[:28]
            source_type = source_data.get('account_type', 'N/A')[:18]
            target_name = transformed_data.get('account_name', 'N/A')[:28]

            print(f"{source_name:<30} {source_type:<20} {target_name:<30}")

    def print_performance_metrics(self):
        """Print migration performance statistics."""
        print("\n⚡ PERFORMANCE METRICS")
        print("-" * 80)

        total_records = (
            self.job.total_products +
            self.job.total_contacts +
            self.job.total_sales +
            self.job.total_purchases
        )

        imported_records = (
            self.job.imported_products +
            self.job.imported_customers +
            self.job.imported_suppliers +
            self.job.imported_sales +
            self.job.imported_purchases
        )

        print(f"Total Records to Migrate: {total_records:,}")
        print(f"Records Imported: {imported_records:,}")
        print(f"Records Verified: {self.job.total_verified:,}")
        print(f"Records Flagged: {self.job.total_flagged:,}")

        if total_records > 0:
            completion_rate = (imported_records / total_records) * 100
            print(f"Completion Rate: {completion_rate:.2f}%")

        if self.job.started_at and self.job.completed_at:
            duration = (self.job.completed_at - self.job.started_at).total_seconds()
            if duration > 0:
                records_per_second = imported_records / duration
                print(f"Import Speed: {records_per_second:.2f} records/second")

    def export_to_csv(self, filename='migration_audit.csv'):
        """Export audit results to CSV."""
        import csv

        mappings = MigrationMapping.objects.filter(job=self.job).order_by('entity_type', 'created_at')

        with open(filename, 'w', newline='') as csvfile:
            fieldnames = [
                'entity_type', 'source_id', 'target_id', 'verify_status',
                'verify_notes', 'created_at', 'source_data_json'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for mapping in mappings:
                writer.writerow({
                    'entity_type': mapping.entity_type,
                    'source_id': mapping.source_id,
                    'target_id': mapping.target_id,
                    'verify_status': mapping.verify_status,
                    'verify_notes': mapping.verify_notes or '',
                    'created_at': mapping.created_at.isoformat(),
                    'source_data_json': json.dumps(mapping.source_data) if mapping.source_data else ''
                })

        print(f"\n✅ Exported {mappings.count()} records to {filename}")

    def run_full_audit(self):
        """Run complete audit report."""
        self.print_header()
        self.print_entity_summary()
        self.print_validation_results()
        self.print_flagged_records()
        self.print_sample_products()
        self.print_sample_contacts()
        self.print_account_mappings()
        self.print_performance_metrics()
        print("\n" + "=" * 80)
        print("END OF AUDIT REPORT".center(80))
        print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(description='Audit migration_v2 jobs')
    parser.add_argument('--job-id', type=int, help='Specific job ID to audit')
    parser.add_argument('--export', choices=['csv'], help='Export format')
    parser.add_argument('--flagged-only', action='store_true', help='Show only flagged records')
    parser.add_argument('--list-jobs', action='store_true', help='List all migration jobs')

    args = parser.parse_args()

    if args.list_jobs:
        print("\n📋 ALL MIGRATION JOBS")
        print("-" * 80)
        jobs = MigrationJob.objects.order_by('-id')[:20]
        for job in jobs:
            print(f"ID: {job.id:<5} | {job.name:<40} | Status: {job.status:<15} | "
                  f"Progress: {job.progress_percent}%")
        print()
        return

    auditor = MigrationAuditor(job_id=args.job_id)

    if args.flagged_only:
        auditor.print_header()
        auditor.print_flagged_records()
    elif args.export:
        auditor.export_to_csv(f'migration_{auditor.job.id}_audit.csv')
    else:
        auditor.run_full_audit()


if __name__ == '__main__':
    main()
