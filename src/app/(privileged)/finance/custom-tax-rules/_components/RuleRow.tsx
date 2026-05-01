'use client'

import { Zap, Edit2, Trash2 } from 'lucide-react'

type CTR = Record<string, any>

const friendlyLabel: Record<string, string> = {
    PURCHASE: 'Purchase Only', SALE: 'Sale Only', BOTH: 'Purchases & Sales',
    ADDED_TO_TTC: 'Add to Invoice (like Sales Tax)', WITHHELD_FROM_AP: 'Withhold (like AIRSI)',
}

/* ═══════════════════════════════════════════════════════════
 *  RULE ROW — Table row for a single custom tax rule
 * ═══════════════════════════════════════════════════════════ */
export function RuleRow({ item, onEdit, onDelete }: { item: CTR; onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3"
            onClick={onEdit}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: item.is_active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                    color: item.is_active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                }}>
                <Zap size={13} />
            </div>
            <div className="flex-1 min-w-0">
                <span className="truncate text-[13px] font-bold text-app-foreground block">{item.name}</span>
                <span className="text-[10px] font-bold text-app-muted-foreground">
                    {friendlyLabel[item.transaction_type] || item.transaction_type} · {friendlyLabel[item.math_behavior] || item.math_behavior}
                </span>
            </div>
            <div className="hidden sm:block w-20 flex-shrink-0">
                <span className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
                    {((parseFloat(item.rate) || 0) * 100).toFixed(2)}%
                </span>
            </div>
            <div className="hidden md:block w-16 flex-shrink-0 text-center">
                <span className="font-mono text-[11px] font-bold text-app-muted-foreground tabular-nums">
                    #{item.calculation_order || 100}
                </span>
            </div>
            <div className="hidden md:block w-20 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                    style={{
                        background: item.is_active ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)' : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                        color: item.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                    }}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"><Edit2 size={12} /></button>
                <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors"><Trash2 size={12} /></button>
            </div>
        </div>
    )
}
