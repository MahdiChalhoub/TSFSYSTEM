# Manufacturing Module

## Overview
Production planning, bill of materials (BOM), work orders, and manufacturing operations management. Tracks raw materials through production to finished goods.

## Key Features
- Bill of Materials (BOM) management
- Multi-level BOMs with routings
- Work order creation and tracking
- Production scheduling
- Material requirements planning (MRP)
- Quality control checkpoints
- Shop floor control
- Production costing

## Core Models
- **BillOfMaterial**: Product recipes/formulas
- **BOMLine**: BOM components
- **WorkOrder**: Production orders
- **ProductionRouting**: Manufacturing steps
- **QualityCheck**: QC checkpoints

## API Endpoints
- GET/POST `/api/manufacturing/boms/`
- POST `/api/manufacturing/work-orders/`
- POST `/api/manufacturing/work-orders/{id}/start/`
- POST `/api/manufacturing/work-orders/{id}/complete/`
- GET `/api/manufacturing/mrp-run/` - Calculate material needs

## Business Logic
- Explode BOMs to calculate material requirements
- Reserve raw materials for work orders
- Track production progress
- Calculate production costs
- Update inventory upon completion

## Dependencies
- Depends on: core, inventory, purchase
- Integrates with: finance (costing)

**Last Updated**: 2026-03-14
**Module Status**: In Development
