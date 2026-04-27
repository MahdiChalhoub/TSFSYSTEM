'use client'

import { useMemo } from 'react'
import { User, MapPin, Warehouse } from 'lucide-react'

type Props = {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    supplierId: number | ''
    onSupplierChange: (id: number | '') => void
    siteId: number | ''
    onSiteChange: (id: number | '') => void
    warehouseId: number | ''
    onWarehouseChange: (id: number | '') => void
}

export function MetadataStrip({
    suppliers, sites,
    supplierId, onSupplierChange,
    siteId, onSiteChange,
    warehouseId, onWarehouseChange,
}: Props) {
    const warehouses = useMemo(() => {
        const site = sites.find(s => Number(s.id) === Number(siteId))
        return site?.warehouses || []
    }, [sites, siteId])

    return (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 flex-wrap"
            style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
            <Field icon={<User size={12} />} label="Supplier" required>
                <select
                    value={supplierId === '' ? '' : String(supplierId)}
                    onChange={e => onSupplierChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className="rounded-lg px-2 py-1 text-[12px] font-bold outline-none"
                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)', minWidth: 160 }}
                    required
                >
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
            </Field>
            <Field icon={<MapPin size={12} />} label="Site" required>
                <select
                    value={siteId === '' ? '' : String(siteId)}
                    onChange={e => {
                        onSiteChange(e.target.value === '' ? '' : Number(e.target.value))
                        onWarehouseChange('')
                    }}
                    className="rounded-lg px-2 py-1 text-[12px] font-bold outline-none"
                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)', minWidth: 140 }}
                    required
                >
                    <option value="">Select site...</option>
                    {sites.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
            </Field>
            <Field icon={<Warehouse size={12} />} label="Warehouse" required>
                <select
                    value={warehouseId === '' ? '' : String(warehouseId)}
                    onChange={e => onWarehouseChange(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!siteId}
                    className="rounded-lg px-2 py-1 text-[12px] font-bold outline-none disabled:opacity-50"
                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)', minWidth: 140 }}
                    required
                >
                    <option value="">{siteId ? 'Select warehouse...' : 'Pick a site first'}</option>
                    {warehouses.map((w: Record<string, any>) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                </select>
            </Field>
        </div>
    )
}

function Field({ icon, label, required, children }: { icon: React.ReactNode; label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                style={{ color: 'var(--app-muted-foreground)' }}>
                {icon} {label}{required && <span style={{ color: 'var(--app-error)' }}>*</span>}
            </span>
            {children}
        </div>
    )
}
