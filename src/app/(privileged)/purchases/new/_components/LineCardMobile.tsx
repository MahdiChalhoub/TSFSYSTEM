import type { PurchaseLine } from '@/types/erp'
import { Package, Trash2 } from 'lucide-react'
import { getStatusStyle } from '../_lib/status-styles'

type Props = {
    line: PurchaseLine
    idx: number
    onUpdate: (idx: number, updates: Record<string, any>) => void
    onRemove: (idx: number) => void
}

export function LineCardMobile({ line, idx, onUpdate, onRemove }: Props) {
    const statusStyle = getStatusStyle(line.statusText as string)
    return (
        <div className="p-3 rounded-xl shadow-sm relative"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                    <Package size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="truncate text-[13px] font-bold block" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider inline-block mt-0.5"
                        style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                        {line.statusText as string}
                    </span>
                </div>
                <button type="button" onClick={() => onRemove(idx)}
                    className="p-2 rounded-lg transition-all flex-shrink-0"
                    style={{ color: 'var(--app-error, #ef4444)' }}>
                    <Trash2 size={15} />
                </button>
            </div>
            <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
            <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Qty</label>
                    <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                        value={line.quantity}
                        onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })}
                        name={`lines[${idx}][quantity]`} />
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Cost</label>
                    <div className="text-[12px] font-bold font-mono tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{Number(line.unitCostHT).toFixed(2)}</div>
                    <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Stock</label>
                    <div className="text-[12px] font-bold tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</div>
                </div>
            </div>
        </div>
    )
}
