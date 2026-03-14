# Module: Invoicing & Document Generation

## Goal
The goal of this module is to provide professional document generation (PDF) for sales and purchase transactions. It enables businesses to issue official invoices, receipts, and maintain a verifiable transaction history.

## Architecture & Data Flow

### PDF Generation Service (`apps/pos/pdf_service.py`)
- **Engine**: `xhtml2pdf` (utilizing `ReportLab`).
- **Input**: Django Templates (HTML/CSS) + Model Instance context.
- **Output**: Binary PDF byte stream.
- **Path Resolution**: `link_callback` handles static/media URL conversion to absolute system paths for image/font rendering.

### Templates (`templates/pos/`)
- `invoice.html`: Professional A4 layout with organization branding, contact details, itemized lines, and cryptographically signed audit data (hash).

## Page: Transaction History (`/sales/history`)
- **Goal**: Centralized hub for reviewing all historical transactions.
- **Read Data**: `GET /api/pos/orders/` (Order History API).
- **Workflow**:
    1. User filters by Type (Sale/Purchase) or Status.
    2. User searches by Reference or Invoice Number.
    3. User clicks "Download Invoice" -> triggers server call to `/api/pos/{id}/invoice-pdf/`.
    4. `erpFetch` detects the binary blob and triggers a browser download.

## POS Terminal Integration
- **Receipt Modal**: Appears automatically after successful checkout.
- **Actions**: Immediate "Print Receipt" or "Download Invoice".
- **State**: Order context is passed from the `checkout` response to the modal.

## Database Tables
- `pos_order`: Stores header info (`ref_code`, `invoice_number`, `total_amount`, `receipt_hash`).
- `pos_orderline`: Stores itemized lines.

## How to Verify
1. Go to **POS Terminal**.
2. Complete a sale.
3. Observe the **Success Modal**.
4. Click **Download Invoice** and verify the PDF layout.
5. Go to **Order History** in the sidebar.
6. Verify historical orders are listed and downloadable.
