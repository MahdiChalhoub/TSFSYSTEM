"""
Migration Module v2.0
===================
Complete rewrite of the migration system following TSFSYSTEM architecture.

Key Features:
- Multi-organization with organization selection
- COA and posting rules validation
- Automatic customer/supplier COA sub-account creation
- Transaction posting with preview
- Smart stock reconciliation
- Verification with locking mechanism
"""
default_app_config = 'apps.migration_v2.apps.MigrationV2Config'
