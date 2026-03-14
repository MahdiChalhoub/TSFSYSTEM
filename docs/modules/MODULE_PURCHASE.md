# Purchase Module

## Overview
Manages procurement operations including purchase orders, vendor management, receiving, and supplier payments. Integrates with Inventory for stock updates and Finance for accounts payable.

## Key Features
- Purchase order management
- Vendor/supplier database
- RFQ (Request for Quotation) process
- Goods receiving
- Purchase invoice matching (3-way match)
- Vendor performance tracking
- Auto-reorder based on stock levels

## Core Models
- **PurchaseOrder**: Vendor orders with line items
- **Supplier**: Vendor master data
- **PurchaseOrderLine**: Individual line items
- **GoodsReceipt**: Receiving documentation
- **VendorInvoice**: Supplier invoices for AP

## API Endpoints
- GET/POST `/api/purchase/orders/`
- POST `/api/purchase/orders/{id}/receive/`
- GET `/api/purchase/suppliers/`
- POST `/api/purchase/orders/{id}/create-invoice/`

## Dependencies
- Depends on: core, inventory, finance
- Depended on by: procurement reports, supplier portal

**Last Updated**: 2026-03-14
**Module Status**: Production
