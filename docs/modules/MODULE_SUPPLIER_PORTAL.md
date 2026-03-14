# Supplier Portal Module

## Overview
Vendor-facing portal for suppliers to view purchase orders, submit invoices, update delivery status, and manage their products. Streamlines procurement collaboration.

## Key Features
- Supplier authentication
- View purchase orders
- Submit invoices electronically
- Update delivery schedules
- Manage product catalog
- RFQ participation
- Performance dashboard

## Core Models
- **SupplierPortalUser**: Vendor portal accounts
- **SupplierQuotation**: RFQ responses
- **SupplierInvoiceSubmission**: Electronic invoicing
- **DeliveryUpdate**: Shipment status updates

## API Endpoints
- POST `/supplier-portal/auth/login/`
- GET `/supplier-portal/purchase-orders/`
- POST `/supplier-portal/invoices/submit/`
- POST `/supplier-portal/quotations/respond/`

## Dependencies
- Depends on: core, purchase
- Integrates with: inventory (catalog sync)

**Last Updated**: 2026-03-14
**Module Status**: Production
