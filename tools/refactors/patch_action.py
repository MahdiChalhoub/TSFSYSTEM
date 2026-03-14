import re

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/purchases/purchase-orders.ts", "r") as f:
    text = f.read()

text = text.replace(
    "export async function receivePOLine(id: number | string, lineId: number | string, quantity: number) {\n const result = await erpFetch(`purchase-orders/${id}/receive-line/`, {\n method: 'POST',\n body: JSON.stringify({ line_id: lineId, quantity })\n })",
    "export async function receivePOLine(\n id: number | string, \n lineId: number | string, \n quantity: number,\n discrepancies?: { qty_damaged?: number; qty_rejected?: number; qty_missing?: number; receipt_notes?: string }\n) {\n const result = await erpFetch(`purchase-orders/${id}/receive-line/`, {\n method: 'POST',\n body: JSON.stringify({ \n line_id: lineId, \n quantity,\n ...(discrepancies || {})\n })\n })"
)

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/purchases/purchase-orders.ts", "w") as f:
    f.write(text)

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/inventory/locations.ts", "r") as f:
    text = f.read()

text = text.replace(
    "export async function receivePOLine(poId: number, data: { line_id: number, quantity: number }) {\n const r = await erpFetch(`pos/purchase-orders/${poId}/receive-line/`, {\n method: 'POST',\n body: JSON.stringify(data)\n })",
    "export async function receivePOLine(poId: number, data: { line_id: number, quantity: number, qty_damaged?: number, qty_rejected?: number, qty_missing?: number, receipt_notes?: string }) {\n const r = await erpFetch(`pos/purchase-orders/${poId}/receive-line/`, {\n method: 'POST',\n body: JSON.stringify(data)\n })"
)

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/inventory/locations.ts", "w") as f:
    f.write(text)

print("Patch applied.")
