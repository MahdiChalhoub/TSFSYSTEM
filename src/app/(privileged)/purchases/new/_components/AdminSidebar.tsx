'use client'

import { useMemo, useState } from 'react'
import {
    User, MapPin, Warehouse, Truck, UserCheck,
    Settings2, X, Check, ChevronRight,
    Building2, Shield, Calendar, Hash, Clock, AlertTriangle,
} from 'lucide-react'
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
    reference: string
    onReferenceChange: (val: string) => void
    date: string
    onDateChange: (val: string) => void
    expectedDelivery: string
    onExpectedDeliveryChange: (val: string) => void
    onClose?: () => void
}

/* ── Shared field styles — match the rest of the app's form vocabulary ──
 * Single source of truth so every input/select looks identical at every
 * focus state. Lifted out of components so a theme tweak propagates without
 * chasing every file.
 */
const fieldBase =
    'w-full text-[12px] font-medium px-2.5 py-2 rounded-xl outline-none border transition-all ' +
    'focus:ring-2 focus:ring-app-primary/15 placeholder:text-app-muted-foreground/60 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'
const fieldStyle: React.CSSProperties = {
    background: 'var(--app-bg)',
    borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
    color: 'var(--app-foreground)',
}
const labelCls =
    'text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 block'

export function AdminSidebar({
    suppliers, sites, users,
    supplierId, onSupplierChange,
    siteId, onSiteChange,
    warehouseId, onWarehouseChange,
    scope, onScopeChange,
    assigneeId, onAssigneeChange,
    driverId, onDriverChange,
    reference, onReferenceChange,
    date, onDateChange,
    expectedDelivery, onExpectedDeliveryChange,
    onClose,
}: Props) {
    const warehouses = useMemo(() => {
        const site = sites.find(s => Number(s.id) === Number(siteId))
        return site?.warehouses || []
    }, [sites, siteId])

    const [saved, setSaved] = useState(false)

    const handleSave = () => {
        setSaved(true)
        setTimeout(() => { setSaved(false); onClose?.() }, 900)
    }

    /* ── Per-step completion flags. The footer summarises these into a
     *  progress bar so the operator sees how close they are to "ready". */
    const stepDone = {
        document: !!reference && !!date,
        vendor: supplierId !== '',
        node: siteId !== '' && warehouseId !== '',
        ownership: assigneeId !== '',
        analytics: true, // selector always has a default; never blocks
    }
    const requiredDone = stepDone.vendor && stepDone.node
    const totalDone = Object.values(stepDone).filter(Boolean).length
    const progress = Math.round((totalDone / 5) * 100)

    return (
        <div className="h-full flex flex-col overflow-hidden"
             style={{ background: 'var(--app-surface)' }}>

            {/* ═══════════════════════════════════════════════════════
             *  HEADER — title + subtitle + close, theme-consistent
             * ═══════════════════════════════════════════════════════ */}
            <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{
                         background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                         color: 'var(--app-primary)',
                     }}>
                    <Settings2 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-[14px] font-black text-app-foreground leading-tight">
                        Configuration
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-app-muted-foreground mt-0.5">
                        Setup wizard
                    </p>
                </div>
                {onClose && (
                    <button onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover transition-colors flex-shrink-0">
                        <X size={14} />
                    </button>
                )}
            </header>

            {/* ═══════════════════════════════════════════════════════
             *  PROGRESS — visible above-the-fold so operators always
             *  know where they are
             * ═══════════════════════════════════════════════════════ */}
            <div className="flex-shrink-0 px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                        {totalDone} of 5 sections
                    </span>
                    <span className="text-[10px] font-black tabular-nums"
                          style={{ color: requiredDone ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        {progress}%
                    </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden"
                     style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="h-full transition-all duration-500"
                         style={{
                             width: `${progress}%`,
                             background: requiredDone
                                 ? 'var(--app-success, #22c55e)'
                                 : 'var(--app-primary)',
                         }} />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
             *  BODY — step sections
             * ═══════════════════════════════════════════════════════ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-2">

                <Step n={1} title="Document Info" icon={<Hash size={12} />} done={stepDone.document}>
                    <label className={labelCls}>Reference</label>
                    <Field icon={<Hash size={11} />}>
                        <input value={reference} onChange={e => onReferenceChange(e.target.value)}
                               placeholder="PO Reference / Invoice #"
                               className={fieldBase + ' pl-8'} style={fieldStyle} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                            <label className={labelCls}>Order date</label>
                            <Field icon={<Calendar size={11} />}>
                                <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
                                       className={fieldBase + ' pl-8'} style={fieldStyle} />
                            </Field>
                        </div>
                        <div>
                            <label className={labelCls}>Expected delivery</label>
                            <Field icon={<Clock size={11} />}>
                                <input type="date" value={expectedDelivery} onChange={e => onExpectedDeliveryChange(e.target.value)}
                                       className={fieldBase + ' pl-8'} style={fieldStyle} />
                            </Field>
                        </div>
                    </div>
                </Step>

                <Step n={2} title="Primary Vendor" icon={<Building2 size={12} />} done={stepDone.vendor} required>
                    <label className={labelCls}>Scope</label>
                    <div className="flex gap-1 p-1 rounded-xl mb-3"
                         style={{
                             background: 'var(--app-bg)',
                             border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                         }}>
                        {(['OFFICIAL', 'INTERNAL'] as const).map(s => {
                            const active = scope === s
                            return (
                                <button key={s} type="button" onClick={() => onScopeChange(s)}
                                        className="flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                        style={active
                                            ? { background: 'var(--app-primary)', color: 'white' }
                                            : { color: 'var(--app-muted-foreground)' }}>
                                    {s}
                                </button>
                            )
                        })}
                    </div>
                    <label className={labelCls}>Supplier</label>
                    <Field icon={<Building2 size={11} />}>
                        <select value={supplierId === '' ? '' : String(supplierId)}
                                onChange={e => onSupplierChange(e.target.value === '' ? '' : Number(e.target.value))}
                                className={fieldBase + ' pl-8 appearance-none'} style={fieldStyle}>
                            <option value="">Select supplier…</option>
                            {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                        </select>
                    </Field>
                </Step>

                <Step n={3} title="Fulfillment Node" icon={<MapPin size={12} />} done={stepDone.node} required>
                    <label className={labelCls}>Site</label>
                    <Field icon={<MapPin size={11} />}>
                        <select value={siteId === '' ? '' : String(siteId)}
                                onChange={e => { onSiteChange(e.target.value === '' ? '' : Number(e.target.value)); onWarehouseChange('') }}
                                className={fieldBase + ' pl-8 appearance-none'} style={fieldStyle}>
                            <option value="">Select site…</option>
                            {sites.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                        </select>
                    </Field>
                    <label className={labelCls + ' mt-2'}>Warehouse</label>
                    <Field icon={<Warehouse size={11} />}>
                        <select value={warehouseId === '' ? '' : String(warehouseId)}
                                onChange={e => onWarehouseChange(e.target.value === '' ? '' : Number(e.target.value))}
                                disabled={!siteId}
                                className={fieldBase + ' pl-8 appearance-none'} style={fieldStyle}>
                            <option value="">{siteId ? 'Select warehouse…' : 'Pick site first…'}</option>
                            {warehouses.map((w: any) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                        </select>
                    </Field>
                </Step>

                <Step n={4} title="Ownership" icon={<User size={12} />} done={stepDone.ownership}>
                    <label className={labelCls}>Assignee</label>
                    <Field icon={<UserCheck size={11} />}>
                        <select value={assigneeId === '' ? '' : String(assigneeId)}
                                onChange={e => onAssigneeChange(e.target.value === '' ? '' : Number(e.target.value))}
                                className={fieldBase + ' pl-8 appearance-none'} style={fieldStyle}>
                            <option value="">Unassigned</option>
                            {users.map(u => <option key={u.id} value={String(u.id)}>{u.username || u.email}</option>)}
                        </select>
                    </Field>
                    <label className={labelCls + ' mt-2'}>Driver</label>
                    <Field icon={<Truck size={11} />}>
                        <select value={driverId === '' ? '' : String(driverId)}
                                onChange={e => onDriverChange(e.target.value === '' ? '' : Number(e.target.value))}
                                className={fieldBase + ' pl-8 appearance-none'} style={fieldStyle}>
                            <option value="">No driver assigned</option>
                            {users.map(u => <option key={u.id} value={String(u.id)}>{u.username || u.email}</option>)}
                        </select>
                    </Field>
                </Step>

                <Step n={5} title="Analytics Layer" icon={<Shield size={12} />}>
                    <label className={labelCls}>Profile</label>
                    <div className="rounded-xl overflow-hidden"
                         style={{
                             background: 'var(--app-bg)',
                             border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                         }}>
                        <AnalyticsProfileSelector pageContext="purchase-order" onProfileChange={() => {}} compact />
                    </div>
                </Step>
            </div>

            {/* ═══════════════════════════════════════════════════════
             *  FOOTER — required-state banner + CTA
             * ═══════════════════════════════════════════════════════ */}
            <footer className="flex-shrink-0 px-4 py-3 space-y-2"
                    style={{ borderTop: '1px solid var(--app-border)' }}>
                {!requiredDone && (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                         style={{
                             background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                             border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                         }}>
                        <AlertTriangle size={12} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                        <span className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                            Vendor and fulfillment node are required
                        </span>
                    </div>
                )}
                <button type="button" onClick={handleSave} disabled={!requiredDone}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40"
                        style={saved
                            ? { background: 'var(--app-success, #22c55e)', color: 'white' }
                            : { background: 'var(--app-primary)', color: 'white' }}>
                    {saved
                        ? <><Check size={14} /> Configuration saved</>
                        : <>Initialize setup <ChevronRight size={14} /></>}
                </button>
            </footer>
        </div>
    )
}

/* ── Step section: numbered indicator + title row + content ──
 *  Indicator is uniform across all states — only the inner color changes.
 *  Avoids the previous "completed steps turn whole title green" effect that
 *  competed with the page's primary color.
 */
function Step({ n, title, icon, done, required, children }: {
    n: number; title: string; icon: React.ReactNode
    done?: boolean; required?: boolean; children: React.ReactNode
}) {
    return (
        <section className="px-4 py-3"
                 style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)' }}>
            <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 transition-colors"
                     style={done
                         ? { background: 'var(--app-success, #22c55e)', color: 'white' }
                         : {
                             background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                             color: 'var(--app-primary)',
                             border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                         }}>
                    {done ? <Check size={11} strokeWidth={3} /> : n}
                </div>
                <span className="flex items-center gap-1.5 text-[12px] font-black tracking-tight text-app-foreground">
                    <span style={{ color: 'var(--app-muted-foreground)' }}>{icon}</span>
                    {title}
                </span>
                {required && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-px rounded ml-auto"
                          style={{
                              background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',
                              color: 'var(--app-error, #ef4444)',
                          }}>
                        Required
                    </span>
                )}
            </div>
            {children}
        </section>
    )
}

/* ── Field wrapper — only renders the leading-icon overlay; the consumer
 *  passes the actual <input>/<select> with `pl-8` so the icon clears. */
function Field({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="relative">
            {icon && (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none">
                    {icon}
                </div>
            )}
            {children}
        </div>
    )
}
