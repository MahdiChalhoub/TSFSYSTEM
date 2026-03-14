# Data Migration Module

## Overview
ETL (Extract, Transform, Load) tools for importing data from legacy systems, Excel files, CSV, and external databases. Supports migration from other ERP systems.

## Key Features
- CSV/Excel import wizards
- Legacy ERP connectors (SAP, Oracle, Sage, QuickBooks)
- Data mapping and transformation
- Validation rules
- Rollback capabilities
- Migration logging
- Bulk data import/export

## Core Models
- **MigrationJob**: Import/export job tracking
- **DataMapping**: Field mapping configurations
- **MigrationLog**: Detailed operation logs
- **ValidationRule**: Data quality checks

## API Endpoints
- POST `/api/migration/upload/` - Upload data file
- POST `/api/migration/jobs/` - Start migration job
- GET `/api/migration/jobs/{id}/status/`
- POST `/api/migration/validate/` - Pre-validate data

## Common Workflows
1. Upload CSV/Excel file
2. System auto-detects columns
3. User maps columns to fields
4. Validation runs
5. User reviews errors
6. Import executes
7. Rollback available

## Dependencies
- Depends on: core
- Can import to: ALL modules

**Last Updated**: 2026-03-14
**Module Status**: Production
