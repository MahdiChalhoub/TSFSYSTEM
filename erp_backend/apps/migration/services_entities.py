"""
Migration Service — Orchestrates the full UltimatePOS → TSF migration.
Runs entity imports in dependency order with transaction safety and progress tracking.
"""
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.parsers import SQLDumpParser, DirectDBReader
from apps.migration.mappers import (
    UnitMapper, CategoryMapper, BrandMapper, ProductMapper,
    ContactMapper, TransactionMapper, SellLineMapper, PurchaseLineMapper,
    AccountMapper, SiteMapper, ExpenseMapper, TransactionPaymentMapper,
    safe_int, safe_bool, safe_decimal, safe_str
)

logger = logging.getLogger(__name__)



class MigrationEntitiesMixin:

    # =========================================================================
    # INDIVIDUAL ENTITY MIGRATIONS
    # =========================================================================

    def _migrate_sites(self):
        """Migrate business_locations → Warehouse (BRANCH type)."""
        from apps.inventory.models import Warehouse

        rows = self._get_rows('business_locations')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Check idempotency
            existing = self._get_or_create_mapping('SITE', source_id, 'business_locations')
            if existing:
                self.id_maps['SITE'][source_id] = existing
                self.id_maps.setdefault('WAREHOUSE', {})[source_id] = existing
                continue

            try:
                mapped = SiteMapper.map_row(row)
                branch = Warehouse.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    code=mapped.get('code', f'LOC-{source_id}'),
                    location_type='BRANCH',
                    is_active=True,
                )
                self.id_maps['SITE'][source_id] = branch.id
                self.id_maps.setdefault('WAREHOUSE', {})[source_id] = branch.id

                self._save_mapping('SITE', source_id, branch.id, 'business_locations',
                                   SiteMapper.extra_data(row))
                count += 1
            except Exception as e:
                self._log_error(f"Site {source_id}: {str(e)}")

        self.job.total_inventory = count  # Reuse field
        logger.info(f"Migrated {count} sites (as BRANCH warehouses)")


    def _migrate_taxes(self):
        """Migrate UltimatePOS tax_rates → TSF TaxGroup."""
        from apps.finance.models import TaxGroup
        from apps.migration.mappers import TaxGroupMapper

        rows = self._get_rows('tax_rates')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TAX_GROUP', source_id, 'tax_rates')
            if existing:
                self.id_maps['TAX_GROUP'][source_id] = existing
                continue

            try:
                mapped = TaxGroupMapper.map_row(row)
                tax_group, created = TaxGroup.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['TAX_GROUP'][source_id] = tax_group.id
                if created:
                    self._save_mapping('TAX_GROUP', source_id, tax_group.id, 'tax_rates',
                                       TaxGroupMapper.extra_data(row))
                    count += 1
            except Exception as e:
                self._log_error(f"Tax rate {source_id}: {str(e)}")

        logger.info(f"Migrated {count} tax rates")


    def _migrate_units(self):
        """Migrate units → Unit."""
        from apps.inventory.models import Unit

        rows = self._get_rows('units')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            # Skip soft-deleted
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('UNIT', source_id, 'units')
            if existing:
                self.id_maps['UNIT'][source_id] = existing
                continue

            try:
                mapped = UnitMapper.map_row(row)
                unit, created = Unit.objects.get_or_create(
                    organization_id=self.organization_id,
                    code=mapped['code'],
                    defaults=mapped
                )
                self.id_maps['UNIT'][source_id] = unit.id
                if created:
                    self._save_mapping('UNIT', source_id, unit.id, 'units',
                                       UnitMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('UNIT', source_id, unit.id, 'units')
            except Exception as e:
                self._log_error(f"Unit {source_id} ({row.get('actual_name')}): {str(e)}")

        self.job.total_units = count
        logger.info(f"Migrated {count} units")


    def _migrate_categories(self):
        """Migrate categories → Category (handles hierarchical parent_id)."""
        from apps.inventory.models import Category

        # We buffer categories because we need two passes for parents
        rows = list(self._get_rows('categories'))
        count = 0

        # First pass: create all categories without parents
        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('CATEGORY', source_id, 'categories')
            if existing:
                self.id_maps['CATEGORY'][source_id] = existing
                continue

            try:
                mapped = CategoryMapper.map_row(row)
                # Remove parent for first pass
                mapped.pop('parent_id', None)
                cat, created = Category.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['CATEGORY'][source_id] = cat.id
                if created:
                    self._save_mapping('CATEGORY', source_id, cat.id, 'categories',
                                       CategoryMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('CATEGORY', source_id, cat.id, 'categories')
            except Exception as e:
                self._log_error(f"Category {source_id} ({row.get('name')}): {str(e)}")

        # Second pass: set parents
        for row in rows:
            source_id = safe_int(row.get('id'))
            parent_source_id = safe_int(row.get('parent_id'))
            if not source_id or not parent_source_id or parent_source_id == 0:
                continue

            target_id = self.id_maps['CATEGORY'].get(source_id)
            parent_target_id = self.id_maps['CATEGORY'].get(parent_source_id)

            if target_id and parent_target_id:
                try:
                    Category.objects.filter(id=target_id).update(parent_id=parent_target_id)
                except Exception as e:
                    self._log_error(f"Category parent update {source_id}: {str(e)}")

        self.job.total_categories = count
        logger.info(f"Migrated {count} categories")


    def _migrate_brands(self):
        """Migrate brands → Brand."""
        from apps.inventory.models import Brand

        rows = self._get_rows('brands')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('BRAND', source_id, 'brands')
            if existing:
                self.id_maps['BRAND'][source_id] = existing
                continue

            try:
                mapped = BrandMapper.map_row(row)
                brand, created = Brand.objects.get_or_create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    defaults=mapped
                )
                self.id_maps['BRAND'][source_id] = brand.id
                if created:
                    self._save_mapping('BRAND', source_id, brand.id, 'brands',
                                       BrandMapper.extra_data(row))
                    count += 1
                else:
                    self._save_mapping('BRAND', source_id, brand.id, 'brands')
            except Exception as e:
                self._log_error(f"Brand {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_brands = count
        logger.info(f"Migrated {count} brands")


    def _migrate_users(self):
        """Migrate UPOS users → TSF User (as inactive draft accounts for attribution)."""
        from erp.models import User
        from django.contrib.auth.hashers import make_password

        rows = self._get_rows('users')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('USER', source_id, 'users')
            if existing:
                self.id_maps.setdefault('USER', {})[source_id] = existing
                continue

            try:
                first = safe_str(row.get('first_name'), max_length=150) or safe_str(row.get('surname'), max_length=150) or ''
                last = safe_str(row.get('last_name'), max_length=150) or ''
                email = safe_str(row.get('email'), max_length=254) or f"user-{source_id}@migrated.local"
                username = safe_str(row.get('username'), max_length=150) or email

                # Check if user already exists by email in this org
                existing_user = User.objects.filter(
                    organization_id=self.organization_id,
                    email=email
                ).first()

                if existing_user:
                    self.id_maps.setdefault('USER', {})[source_id] = existing_user.id
                    self._save_mapping('USER', source_id, existing_user.id, 'users',
                                       {'matched_existing': True})
                    count += 1
                    continue

                user = User.objects.create(
                    organization_id=self.organization_id,
                    username=username,
                    first_name=first,
                    last_name=last,
                    email=email,
                    password=make_password(None),  # Unusable password
                    is_active=False,  # Inactive until admin activates
                    is_active_account=False,
                    registration_status='MIGRATED',
                )
                self.id_maps.setdefault('USER', {})[source_id] = user.id
                self._save_mapping('USER', source_id, user.id, 'users', {
                    'original_username': safe_str(row.get('username')),
                    'user_type': safe_str(row.get('user_type')),
                    'contact_no': safe_str(row.get('contact_no')),
                    'status': safe_str(row.get('status')),
                })
                count += 1
            except Exception as e:
                self._log_error(f"User {source_id} ({row.get('username')}): {str(e)}")

        logger.info(f"Migrated {count} users (all inactive — admin must activate)")


    def _migrate_contacts(self):
        """Migrate contacts → Contact."""
        from apps.crm.models import Contact

        rows = self._get_rows('contacts')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id or row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('CONTACT', source_id, 'contacts')
            if existing:
                self.id_maps['CONTACT'][source_id] = existing
                continue

            try:
                mapped = ContactMapper.map_row(row)
                contact = Contact.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self.id_maps['CONTACT'][source_id] = contact.id
                self._save_mapping('CONTACT', source_id, contact.id, 'contacts',
                                   ContactMapper.extra_data(row))
                count += 1

                # If type is 'both', UPOS creates one entry. TSF needs two roles possibly?
                # For now we create one master contact.
                
                if count % 100 == 0: self._heartbeat(sub_progress=f"{count:,} contacts")
            except Exception as e:
                self._log_error(f"Contact {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_contacts = count
        logger.info(f"Migrated {count} contacts")

