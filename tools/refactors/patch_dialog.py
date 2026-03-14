import re

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/purchases/receipts/ReceiveLineDialog.tsx", "r") as f:
    text = f.read()

# 1. Update State
state_target = """  const [qty, setQty] = useState<number>(Number(line.quantity) - Number(line.qty_received));
  const [loading, setLoading] = useState(false);"""

state_replacement = """  const [qty, setQty] = useState<number>(Number(line.quantity) - Number(line.qty_received));
  const [qtyMissing, setQtyMissing] = useState<number>(0);
  const [qtyDamaged, setQtyDamaged] = useState<number>(0);
  const [qtyRejected, setQtyRejected] = useState<number>(0);
  const [receiptNotes, setReceiptNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);"""

text = text.replace(state_target, state_replacement)

# 2. Update Submit Handler
submit_target = """  const res = await receivePOLine(po.id, { line_id: line.id, quantity: qty });"""
submit_replacement = """  const res = await receivePOLine(po.id, { 
        line_id: line.id, 
        quantity: qty,
        qty_missing: qtyMissing > 0 ? qtyMissing : undefined,
        qty_damaged: qtyDamaged > 0 ? qtyDamaged : undefined,
        qty_rejected: qtyRejected > 0 ? qtyRejected : undefined,
        receipt_notes: receiptNotes.trim() || undefined
    });"""

text = text.replace(submit_target, submit_replacement)


# 3. Inject Form Fields (Right after the main qty input)
ui_target = """        </div>
      </div>
    </div>

    <div className="flex gap-3 pt-4">"""

ui_replacement = """        </div>
      </div>

      <div className="pt-4 border-t border-app-border space-y-4">
        <label className="text-xs font-black text-app-text-muted uppercase tracking-widest block">Discrepancies (Optional)</label>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase px-1">Missing</label>
            <input 
              type="number" step="any" min="0" value={qtyMissing} onChange={e => setQtyMissing(Number(e.target.value))}
              className="w-full h-10 px-3 bg-app-bg border border-app-border rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase px-1">Damaged</label>
            <input 
              type="number" step="any" min="0" value={qtyDamaged} onChange={e => setQtyDamaged(Number(e.target.value))}
              className="w-full h-10 px-3 bg-app-bg border border-app-border rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase px-1">Rejected</label>
            <input 
              type="number" step="any" min="0" value={qtyRejected} onChange={e => setQtyRejected(Number(e.target.value))}
              className="w-full h-10 px-3 bg-app-bg border border-app-border rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-semibold"
            />
          </div>
        </div>
        
        <textarea 
          placeholder="Receipt notes or discrepancy explanation..."
          value={receiptNotes}
          onChange={e => setReceiptNotes(e.target.value)}
          className="w-full h-20 p-3 bg-app-bg border border-app-border rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm resize-none"
        />
      </div>

    </div>

    <div className="flex gap-3 pt-4">"""

text = text.replace(ui_target, ui_replacement)

# Make submit button disabled logic smarter
btn_target = """disabled={loading || qty <= 0}"""
btn_replacement = """disabled={loading || (qty <= 0 && qtyMissing <= 0 && qtyDamaged <= 0 && qtyRejected <= 0)}"""

text = text.replace(btn_target, btn_replacement)

with open("/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/purchases/receipts/ReceiveLineDialog.tsx", "w") as f:
    f.write(text)

print("Dialog patched")
