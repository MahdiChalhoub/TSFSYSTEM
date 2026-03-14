# Label Printing Studio — Documentation

## Goal
Allow users to select products, configure label appearance, preview barcode labels, and print them using the browser's native print function. Supports shelf labels, price tags, and product stickers in 3 standard sizes.

## Data Sources

### READ
- `GET /api/products/` — lists all products with barcode, SKU, name, price, brand

### WRITE
- No write operations — label printing is read-only

## User Workflow
1. Navigate to **Inventory → Products → Label Printing**
2. Search and click products from the left panel to add to the print queue
3. Adjust quantities for each product (how many labels to print)
4. Configure label settings:
   - **Size**: 35×22mm (small), 50×30mm (medium), 70×40mm (large)
   - **Show/Hide**: Price, Barcode, SKU, Brand
5. Preview labels in the grid (max 4 labels per product shown)
6. Click **Print** — opens a new browser window with print-formatted labels
7. Use browser print dialog to send to physical printer or save as PDF

## Label Layout
Each label includes:
| Element | Position | Toggleable |
|---------|----------|-----------|
| Product name | Top, bold | Always shown |
| Brand name | Below name | Optional |
| Barcode | Center, monospace | Optional |
| SKU | Bottom-left | Optional |
| Price (TTC) | Bottom-right, bold | Optional |

## Files
- **Server Actions**: `src/app/actions/labels.ts`
- **Frontend Page**: `src/app/(privileged)/inventory/labels/page.tsx`
- **Printer Component**: `src/app/(privileged)/inventory/labels/printer.tsx`
- **Sidebar**: Added under Inventory → Products → "Label Printing"

## Related
- **Barcode Config**: `/inventory/barcode` — configure EAN-13 prefix, sequence number
- **Barcode Generation**: `ProductViewSet.generate_barcodes` — auto-generates barcodes for products
