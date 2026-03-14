# Client Portal Module

## Overview
Customer-facing self-service portal for viewing orders, invoices, making payments, and submitting support tickets. Enhances customer experience with 24/7 access to their data.

## Key Features
- Customer login and authentication
- View order history and status
- Download invoices and receipts
- Make online payments
- Submit support tickets
- Track shipments
- Update account information

## Core Models
- **PortalUser**: Customer portal accounts
- **CustomerTicket**: Support request submissions
- **PortalSession**: User session tracking
- **CustomerDocument**: Shared documents

## API Endpoints
- POST `/portal/auth/login/` - Customer authentication
- GET `/portal/orders/` - Customer's orders
- GET `/portal/invoices/` - Customer's invoices
- POST `/portal/payments/` - Make payment
- POST `/portal/tickets/` - Submit support ticket

## Dependencies
- Depends on: core, crm, sales, finance
- Integrates with: payment gateways (integrations module)

**Last Updated**: 2026-03-14
**Module Status**: Production
