'use client'

import { Calculator, ShoppingBag, Percent, Receipt } from 'lucide-react'

type Props = {
    totalHT: number
    totalVAT: number
    totalTTC: number
    itemsCount: number
}

export function OrderKpis({ totalHT, totalVAT, totalTTC, itemsCount }: Props) {
    const formatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard
                icon={<ShoppingBag size={14} />}
                label="Total HT"
                value={formatter.format(totalHT)}
                suffix="FCFA"
                color="var(--app-info)"
            />
            <KpiCard
                icon={<Percent size={14} />}
                label="Taxes (VAT)"
                value={formatter.format(totalVAT)}
                suffix="FCFA"
                color="var(--app-warning)"
            />
            <KpiCard
                icon={<Receipt size={14} />}
                label="Total TTC"
                value={formatter.format(totalTTC)}
                suffix="FCFA"
                color="var(--app-success)"
                highlight
            />
            <KpiCard
                icon={<Calculator size={14} />}
                label="Items Count"
                value={itemsCount.toString()}
                suffix="Lines"
                color="var(--app-accent)"
            />
        </div>
    )
}

function KpiCard({ icon, label, value, suffix, color, highlight }: { icon: React.ReactNode; label: string; value: string; suffix: string; color: string; highlight?: boolean }) {
    return (
        <div className="rounded-2xl p-3 border transition-all"
            style={{
                background: highlight ? `color-mix(in srgb, ${color} 8%, var(--app-surface))` : 'var(--app-surface)',
                borderColor: highlight ? `color-mix(in srgb, ${color} 20%, var(--app-border))` : 'var(--app-border)',
                boxShadow: highlight ? `0 4px 12px color-mix(in srgb, ${color} 10%, transparent)` : 'none'
            }}>
            <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-app-foreground tabular-nums tracking-tighter">{value}</span>
                <span className="text-[10px] font-bold text-app-muted-foreground uppercase">{suffix}</span>
            </div>
        </div>
    )
}
