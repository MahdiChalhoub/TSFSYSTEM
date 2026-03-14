# Packages Module

## Overview
Module marketplace and plugin management system. Allows installation, configuration, and distribution of add-on modules and extensions.

## Key Features
- Module marketplace browsing
- Install/uninstall modules
- Module versioning
- Dependency resolution
- Configuration management
- License key validation
- Auto-updates

## Core Models
- **Package**: Available modules/extensions
- **InstalledPackage**: Activated modules
- **PackageVersion**: Version control
- **PackageLicense**: License key management

## API Endpoints
- GET `/api/packages/marketplace/`
- POST `/api/packages/install/`
- POST `/api/packages/uninstall/`
- GET `/api/packages/installed/`

## Dependencies
- Depends on: core
- Used by: All add-on modules

**Last Updated**: 2026-03-14
**Module Status**: Beta
