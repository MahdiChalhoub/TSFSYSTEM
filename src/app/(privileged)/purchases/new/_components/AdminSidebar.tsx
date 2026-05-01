'use client'

import { useMemo } from 'react'
import { User, MapPin, Warehouse, Shield, Truck, UserCheck, Settings2, Globe } from 'lucide-react'
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector'

type Props = {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    users: Record<string, any>[]
    supplierId: number | ''
    onSupplierChange: (id: number | '') => void
    siteId: number | ''
    onSiteChange: (id: number | '') => void
    warehouseId: number | ''
    onWarehouseChange: (id: number | '') => void
    scope: 'OFFICIAL' | 'INTERNAL'
    onScopeChange: (scope: 'OFFICIAL' | 'INTERNAL') => void
    assigneeId: number | ''
    onAssigneeChange: (id: number | '') => void
    driverId: number | ''
    onDriverChange: (id: number | '') => void
}

export function AdminSidebar({
    suppliers, sites, users,
    supplierId, onSupplierChange,
    siteId, onSiteChange,
    warehouseId, onWarehouseChange,
    scope, onScopeChange,
    assigneeId, onAssigneeChange,
    driverId, onDriverChange,
}: Props) {
    const warehouses = useMemo(() => {
        const site = sites.find(s => Number(s.id) === Number(siteId))
        return site?.warehouses || []
    }, [sites, siteId])

    return (
        <div className="w-[320px] h-full flex flex-col border-l border-app-border bg-app-surface/50 backdrop-blur-xl overflow-y-auto">
            <div className="p-5 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
                        <Settings2 size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-app-foreground tracking-tight">Configuration</h3>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Administrative Metadata</p>
                    </div>
                </div>

                {/* Scope Toggle */}
                <section>
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-3">
                        <Globe size={12} /> Order Scope
                    </label>
                    <div className="flex p-1 rounded-xl bg-app-background border border-app-border">
                        {(['OFFICIAL', 'INTERNAL'] as const).map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => onScopeChange(s)}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    scope === s ? 'bg-app-primary text-white shadow-lg shadow-app-primary/20' : 'text-app-muted-foreground hover:bg-app-surface'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Core Partners */}
                <section className="space-y-5">
                    <Field icon={<User size={12} />} label="Supplier" required>
                        <select
                            value={supplierId === '' ? '' : String(supplierId)}
                            onChange={e => onSupplierChange(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-bold outline-none bg-app-background border border-app-border text-app-foreground focus:ring-2 focus:ring-app-primary/20 transition-all"
                            required
                        >
                            <option value="">Select supplier...</option>
                            {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                        </select>
                    </Field>

                    <Field icon={<UserCheck size={12} />} label="Assign To">
                        <select
                            value={assigneeId === '' ? '' : String(assigneeId)}
                            onChange={e => onAssigneeChange(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-bold outline-none bg-app-background border border-app-border text-app-foreground focus:ring-2 focus:ring-app-primary/20 transition-all"
                        >
                            <option value="">Select user...</option>
                            {users.map(u => <option key={u.id} value={String(u.id)}>{u.username || u.email}</option>)}
                        </select>
                    </Field>
                </section>

                {/* Logistics */}
                <section className="space-y-5">
                    <Field icon={<MapPin size={12} />} label="Site" required>
                        <select
                            value={siteId === '' ? '' : String(siteId)}
                            onChange={e => {
                                onSiteChange(e.target.value === '' ? '' : Number(e.target.value))
                                onWarehouseChange('')
                            }}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-bold outline-none bg-app-background border border-app-border text-app-foreground focus:ring-2 focus:ring-app-primary/20 transition-all"
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
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-bold outline-none bg-app-background border border-app-border text-app-foreground focus:ring-2 focus:ring-app-primary/20 transition-all disabled:opacity-40"
                            required
                        >
                            <option value="">{siteId ? 'Select warehouse...' : 'Pick a site first'}</option>
                            {warehouses.map((w: Record<string, any>) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                        </select>
                    </Field>

                    <Field icon={<Truck size={12} />} label="Driver">
                        <select
                            value={driverId === '' ? '' : String(driverId)}
                            onChange={e => onDriverChange(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-bold outline-none bg-app-background border border-app-border text-app-foreground focus:ring-2 focus:ring-app-primary/20 transition-all"
                        >
                            <option value="">Select driver...</option>
                            {users.map(u => <option key={u.id} value={String(u.id)}>{u.username || u.email}</option>)}
                        </select>
                    </Field>
                </section>

                {/* Intelligence Profile */}
                <section className="pt-5 border-t border-app-border">
                    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-3">
                        <Shield size={12} /> Intelligence Profile
                    </label>
                    <AnalyticsProfileSelector
                        pageContext="purchase-order"
                        onProfileChange={() => {}}
                        compact
                    />
                    <p className="mt-2 text-[9px] font-bold text-app-muted-foreground italic">
                        Governs the PO Intelligence Grid columns and thresholds.
                    </p>
                </section>
            </div>
        </div>
    )
}

function Field({ icon, label, required, children }: { icon: React.ReactNode; label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                {icon} {label}{required && <span style={{ color: 'var(--app-error)' }}>*</span>}
            </label>
            {children}
        </div>
    )
}
