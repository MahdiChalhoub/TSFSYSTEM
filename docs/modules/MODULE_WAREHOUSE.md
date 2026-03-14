# Warehouse Module

## Overview
Advanced warehouse management including multi-location warehousing, bin/shelf management, barcode scanning, pick/pack/ship operations, and warehouse optimization.

## Key Features
- Multi-warehouse management
- Bin location tracking
- Barcode scanning integration
- Pick lists generation
- Packing operations
- Shipping manifest
- Warehouse transfers
- Cycle counting
- Warehouse layouts

## Core Models
- **Warehouse**: Physical locations
- **WarehouseLocation**: Bins, shelves, zones
- **PickList**: Picking instructions
- **PackingSlip**: Packing documentation
- **WarehouseTransfer**: Inter-warehouse movements

## API Endpoints
- GET `/api/warehouse/locations/`
- POST `/api/warehouse/pick-lists/`
- POST `/api/warehouse/transfers/`
- POST `/api/warehouse/scan/` - Barcode scanning

## Business Logic
- Optimize pick paths
- Suggest bin locations (ABC analysis)
- Track inventory by location
- Generate transfer orders

## Dependencies
- Depends on: core, inventory
- Used by: sales, pos, ecommerce

**Last Updated**: 2026-03-14
**Module Status**: Production
