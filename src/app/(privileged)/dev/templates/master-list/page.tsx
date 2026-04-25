'use client'

import { useMemo } from 'react'
import { Package, Plus, Layers, Box, AlertTriangle, DollarSign, ShoppingCart, Edit } from 'lucide-react'
import { MasterListPage } from '@/components/templates/MasterListPage'
import type { KPIStat } from '@/components/ui/KPIStrip'

/* ═══════════════════════════════════════════════════════════
 *  Demo — new page in ~80 lines.
 *
 *  This file is a complete, working master-data page built on
 *  MasterListPage. Copy-paste it as the starting point for any
 *  new registry screen; the three files it depends on
 *  (DajingoPageShell / DajingoListView / DajingoCustomizePanel)
 *  are already shared so edits there reflect everywhere.
 * ═══════════════════════════════════════════════════════════ */

type Widget = {
    id: number
    sku: string
    name: string
    type: 'STOCKABLE' | 'COMBO' | 'SERVICE'
    price: number
    stock: number
    category: string
}

const DEMO: Widget[] = [
    { id: 1, sku: 'WID-001', name: 'Alpha Widget',    type: 'STOCKABLE', price: 19.99,  stock: 42,  category: 'Gear' },
    { id: 2, sku: 'WID-002', name: 'Beta Widget',     type: 'COMBO',     price: 49.90,  stock: 7,   category: 'Bundles' },
    { id: 3, sku: 'WID-003', name: 'Gamma Service',   type: 'SERVICE',   price: 120.00, stock: 0,   category: 'Services' },
    { id: 4, sku: 'WID-004', name: 'Delta Widget XL', type: 'STOCKABLE', price: 199.00, stock: 15,  category: 'Gear' },
    { id: 5, sku: 'WID-005', name: 'Epsilon Widget',  type: 'STOCKABLE', price: 12.50,  stock: 0,   category: 'Gear' },
    { id: 6, sku: 'WID-006', name: 'Zeta Combo',      type: 'COMBO',     price: 89.00,  stock: 24,  category: 'Bundles' },
    { id: 7, sku: 'WID-007', name: 'Eta Service',     type: 'SERVICE',   price: 60.00,  stock: 0,   category: 'Services' },
    { id: 8, sku: 'WID-008', name: 'Theta Widget',    type: 'STOCKABLE', price: 28.00,  stock: 110, category: 'Gear' },
]

const COLUMNS = [
    { key: 'type',     label: 'Type' },
    { key: 'sku',      label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'stock',    label: 'Stock' },
    { key: 'price',    label: 'Price' },
]

export default function MasterListDemo() {
    const computeKpis = useMemo(() => (rows: Widget[]): KPIStat[] => [
        { label: 'Total',       value: rows.length, icon: <Package size={11} />, color: 'var(--app-primary)' },
        { label: 'Combos',      value: rows.filter(r => r.type === 'COMBO').length, icon: <Layers size={11} />, color: '#8b5cf6' },
        { label: 'Out of stock',value: rows.filter(r => r.stock <= 0).length, icon: <AlertTriangle size={11} />, color: 'var(--app-error)' },
        { label: 'Avg price',   value: rows.length ? Math.round(rows.reduce((s, r) => s + r.price, 0) / rows.length) : 0, icon: <DollarSign size={11} />, color: 'var(--app-success)' },
    ], [])

    return (
        <MasterListPage<Widget>
            config={{
                title: 'Demo Widgets',
                entityLabel: 'Widget',
                icon: <Package size={20} className="text-white" />,
                subtitle: (rows) => `${rows.length} widgets · demo for MasterListPage`,

                initialData: DEMO,
                getRowId: r => r.id,

                columns: COLUMNS,
                defaultVisibleColumns: { type: true, sku: true, category: true, stock: true, price: true },
                rightAlignedCols: ['stock', 'price'],

                searchFields: ['name', 'sku', 'category'],

                computeKpis,

                primaryAction: {
                    label: 'New Widget',
                    icon: <Plus size={14} />,
                    onClick: () => alert('Demo — would open a form modal.'),
                },

                renderRowIcon: (w) => {
                    const c = w.type === 'COMBO' ? '#8b5cf6' : w.type === 'SERVICE' ? 'var(--app-warning)' : 'var(--app-primary)'
                    const I = w.type === 'COMBO' ? Layers : w.type === 'SERVICE' ? Package : Box
                    return (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
                            <I size={13} />
                        </div>
                    )
                },
                renderRowTitle: (w) => (
                    <div className="flex-1 min-w-0">
                        <div className="truncate text-[12px] font-bold text-app-foreground">{w.name}</div>
                        <div className="text-[10px] font-mono text-app-muted-foreground">{w.sku}</div>
                    </div>
                ),
                renderColumnCell: (key, w) => {
                    if (key === 'type') return <span className="text-tp-xxs font-bold uppercase tracking-wider">{w.type}</span>
                    if (key === 'sku') return <span className="font-mono text-tp-xs">{w.sku}</span>
                    if (key === 'category') return <span className="text-tp-xs">{w.category}</span>
                    if (key === 'stock') return (
                        <span className={`font-mono font-bold tabular-nums ${w.stock <= 0 ? 'text-app-error' : 'text-app-foreground'}`}>
                            {w.stock}
                        </span>
                    )
                    if (key === 'price') return <span className="font-mono font-bold tabular-nums">${w.price.toFixed(2)}</span>
                    return null
                },
                menuActions: (w) => [
                    { label: 'Order more',  icon: <ShoppingCart size={12} className="text-app-info" />, onClick: () => alert(`Order ${w.sku}`) },
                    { label: 'Edit widget', icon: <Edit size={12} className="text-app-muted-foreground" />, onClick: () => alert(`Edit ${w.sku}`), separator: true },
                ],
                emptyIcon: <Package size={36} />,
            }}
        />
    )
}
