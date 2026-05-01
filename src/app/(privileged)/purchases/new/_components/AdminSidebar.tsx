'use client'

import { useMemo, useState } from 'react'
import {
    User, MapPin, Warehouse, UserCheck,
    Settings2, X, Check, ChevronRight, ChevronDown,
    Building2, Shield, Calendar, Hash, Clock, AlertCircle,
} from 'lucide-react'
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'

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

/* ── Field vocabulary ─────────────────────────────────────────
 *  One source-of-truth for the form's input/select/label styles
 *  so the whole panel reads as a single coherent surface. Lifted
 *  out of components so a theme tweak hits every field.
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

    /* Memoize the SearchableDropdown option arrays. Without this each render
     * builds a fresh array, so React re-mounts the dropdown's internal
     * filter — costly on tenants with hundreds of suppliers/users. */
    const supplierOptions = useMemo(
        () => suppliers.map(s => ({ value: String(s.id), label: s.name })),
        [suppliers],
    )
    const siteOptions = useMemo(
        () => sites.map(s => ({ value: String(s.id), label: s.name })),
        [sites],
    )
    const warehouseOptions = useMemo(
        () => warehouses.map((w: any) => ({ value: String(w.id), label: w.name })),
        [warehouses],
    )
    const userOptions = useMemo(
        () => users.map(u => ({ value: String(u.id), label: u.username || u.email })),
        [users],
    )

    /* Per-step completion. Powers the progress bar AND the per-section
     * collapse-on-complete behavior — done sections render as a single
     * compact summary line, freeing vertical space for what still needs
     * attention. */
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

    /* Selected-name lookups for the collapsed-summary lines. */
    const supplierName = useMemo(
        () => suppliers.find(s => Number(s.id) === Number(supplierId))?.name,
        [suppliers, supplierId],
    )
    const siteName = useMemo(
        () => sites.find(s => Number(s.id) === Number(siteId))?.name,
        [sites, siteId],
    )
    const warehouseName = useMemo(
        () => warehouses.find((w: any) => Number(w.id) === Number(warehouseId))?.name,
        [warehouses, warehouseId],
    )
    const assigneeName = useMemo(() => {
        const u = users.find(u => Number(u.id) === Number(assigneeId))
        return u?.username || u?.email
    }, [users, assigneeId])

    return (
        <div className="h-full flex flex-col overflow-hidden"
             style={{ background: 'var(--app-surface)' }}>

            {/* HEADER ─────────────────────────────────────────────
             *  Title scale follows the app's typography tokens —
             *  `text-tp-md font-bold` (13px / 700) is the convention
             *  used by every modal header (BrandFormModal, UnitFormModal,
             *  BalanceBarcodeConfigModal, etc.). Heavier weights like
             *  font-black (900) on the Outfit display font render far
             *  wider per character and were causing the title to clip
             *  at the 260px sidebar width. */}
            <header className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 min-w-0"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{
                         background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                         color: 'var(--app-primary)',
                     }}>
                    <Settings2 size={13} />
                </div>
                <div className="flex-1 min-w-0">
                    {/* IMPORTANT: rendered as <div role="heading"> rather than <h2>
                     *  because the app's theme engine sets a global rule
                     *  `h2 { font-size: var(--font-size-h2) }` which is 20–36px
                     *  depending on theme — that wins over Tailwind utility
                     *  classes and was clipping "Configuration" at the 260px
                     *  sidebar width. Explicit `fontSize` style locks it to the
                     *  theme typography token regardless of what tag we use. */}
                    <div role="heading" aria-level={2}
                         className="font-bold text-app-foreground leading-tight truncate"
                         style={{ fontSize: 'var(--tp-sm)' }}
                         title="Configuration">
                        Configuration
                    </div>
                    <p className="font-bold uppercase tracking-widest text-app-muted-foreground mt-0.5 truncate"
                       style={{ fontSize: 'var(--tp-xxs)' }}>
                        Setup wizard
                    </p>
                </div>
                {onClose && (
                    <button onClick={onClose}
                            aria-label="Close configuration"
                            className="w-6 h-6 flex items-center justify-center rounded-md text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover transition-colors flex-shrink-0">
                        <X size={12} />
                    </button>
                )}
            </header>

            {/* PROGRESS ─────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 pt-3 pb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                        {totalDone} of 5 sections
                    </span>
                    <span className="text-[10px] font-black tabular-nums"
                          style={{ color: requiredDone ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
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

            {/* BODY ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-2">

                <Step n={1} title="Document Info" icon={<Hash size={12} />}
                      done={stepDone.document}
                      summary={stepDone.document ? `${reference} · ${date}` : undefined}>
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
                            <label className={labelCls}>Expected</label>
                            <Field icon={<Clock size={11} />}>
                                <input type="date" value={expectedDelivery} onChange={e => onExpectedDeliveryChange(e.target.value)}
                                       className={fieldBase + ' pl-8'} style={fieldStyle} />
                            </Field>
                        </div>
                    </div>
                </Step>

                <Step n={2} title="Primary Vendor" icon={<Building2 size={12} />}
                      done={stepDone.vendor} required
                      summary={supplierName ? `${scope.charAt(0) + scope.slice(1).toLowerCase()} · ${supplierName}` : undefined}>
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
                    <SearchableDropdown
                        label="Supplier"
                        value={supplierId === '' ? '' : String(supplierId)}
                        onChange={v => onSupplierChange(v === '' ? '' : Number(v))}
                        options={supplierOptions}
                        placeholder="Search supplier…"
                    />
                </Step>

                <Step n={3} title="Fulfillment" icon={<MapPin size={12} />}
                      done={stepDone.node} required
                      summary={siteName && warehouseName ? `${siteName} → ${warehouseName}` : undefined}>
                    <SearchableDropdown
                        label="Site"
                        value={siteId === '' ? '' : String(siteId)}
                        onChange={v => { onSiteChange(v === '' ? '' : Number(v)); onWarehouseChange('') }}
                        options={siteOptions}
                        placeholder="Search site…"
                    />
                    <div className="mt-2">
                        {!siteId ? (
                            <>
                                <label className={labelCls}>Warehouse</label>
                                <div className={fieldBase + ' opacity-60 flex items-center gap-2'} style={fieldStyle}>
                                    <Warehouse size={11} className="text-app-muted-foreground" />
                                    <span className="text-app-muted-foreground/60">Pick site first…</span>
                                </div>
                            </>
                        ) : (
                            <SearchableDropdown
                                label="Warehouse"
                                value={warehouseId === '' ? '' : String(warehouseId)}
                                onChange={v => onWarehouseChange(v === '' ? '' : Number(v))}
                                options={warehouseOptions}
                                placeholder={warehouseOptions.length === 0 ? 'No warehouses for this site' : 'Search warehouse…'}
                            />
                        )}
                    </div>
                </Step>

                <Step n={4} title="Ownership" icon={<User size={12} />}
                      done={stepDone.ownership}
                      summary={assigneeName ? `Assignee: ${assigneeName}` : undefined}>
                    <SearchableDropdown
                        label="Assignee"
                        value={assigneeId === '' ? '' : String(assigneeId)}
                        onChange={v => onAssigneeChange(v === '' ? '' : Number(v))}
                        options={userOptions}
                        placeholder="Search assignee…"
                    />
                    <div className="mt-2">
                        <SearchableDropdown
                            label="Driver"
                            value={driverId === '' ? '' : String(driverId)}
                            onChange={v => onDriverChange(v === '' ? '' : Number(v))}
                            options={userOptions}
                            placeholder="Search driver…"
                        />
                    </div>
                    {/* Tiny hints — make optional fields explicit. */}
                    <p className="text-[10px] font-medium text-app-muted-foreground/70 mt-2 flex items-start gap-1">
                        <UserCheck size={10} className="mt-0.5 flex-shrink-0" />
                        Optional. Defaults: assignee = creator; driver = none.
                    </p>
                </Step>

                <Step n={5} title="Analytics" icon={<Shield size={12} />}>
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

            {/* FOOTER ───────────────────────────────────────────── */}
            <footer className="flex-shrink-0 px-4 py-3 space-y-2"
                    style={{ borderTop: '1px solid var(--app-border)' }}>
                {!requiredDone && (
                    <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                         style={{
                             background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                             border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                         }}>
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                        <span className="text-[11px] font-bold leading-snug" style={{ color: 'var(--app-foreground)' }}>
                            {!stepDone.vendor && !stepDone.node
                                ? 'Choose a vendor and a fulfillment node to continue.'
                                : !stepDone.vendor
                                    ? 'Choose a primary vendor to continue.'
                                    : 'Choose a fulfillment site and warehouse to continue.'}
                        </span>
                    </div>
                )}
                {/* This panel does not own persistence — the parent form's
                 *  Submit button creates the PO. The CTA here just
                 *  acknowledges the configuration and dismisses the panel
                 *  on small screens. Keeping it labeled "Apply" rather than
                 *  "Initialize setup" matches what it actually does. */}
                <button type="button"
                        onClick={() => onClose?.()}
                        disabled={!requiredDone}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all disabled:opacity-40"
                        style={{
                            background: requiredDone ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-primary) 50%, var(--app-border))',
                            color: 'white',
                        }}>
                    {requiredDone ? <Check size={14} /> : <ChevronRight size={14} />}
                    {requiredDone ? 'Apply configuration' : 'Complete required steps'}
                </button>
            </footer>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────
 *  Step — number badge, title, optional Required pill, optional summary
 *  line, expand/collapse on demand. Completed steps default to collapsed
 *  so the panel stays compact; click the row to re-edit.
 * ───────────────────────────────────────────────────────────────────── */
function Step({ n, title, icon, done, required, summary, children }: {
    n: number
    title: string
    icon: React.ReactNode
    done?: boolean
    required?: boolean
    /** Single-line summary shown when the step is collapsed. Falsy → never collapses. */
    summary?: string
    children: React.ReactNode
}) {
    // Default-collapsed only when there's a summary to show — i.e. the
    // section has been satisfied and condensing it actually saves space.
    const [open, setOpen] = useState(!summary)
    const collapsed = !!summary && !open

    return (
        <section className="px-4 py-3"
                 style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)' }}>
            <button
                type="button"
                onClick={() => summary && setOpen(o => !o)}
                disabled={!summary}
                className="w-full flex items-center gap-2 disabled:cursor-default text-left"
            >
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
                <span className="flex items-center gap-1.5 text-[12px] font-black tracking-tight text-app-foreground min-w-0">
                    <span style={{ color: 'var(--app-muted-foreground)' }} className="flex-shrink-0">{icon}</span>
                    <span className="truncate">{title}</span>
                </span>
                {required && !done && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-px rounded ml-auto flex-shrink-0"
                          style={{
                              background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',
                              color: 'var(--app-error, #ef4444)',
                          }}>
                        Required
                    </span>
                )}
                {summary && (
                    <ChevronDown size={12}
                                 className={`flex-shrink-0 transition-transform text-app-muted-foreground ${required && !done ? '' : 'ml-auto'}`}
                                 style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                )}
            </button>

            {collapsed ? (
                <p className="text-[11px] font-medium text-app-muted-foreground mt-1.5 ml-7 truncate">
                    {summary}
                </p>
            ) : (
                <div className="mt-2.5">{children}</div>
            )}
        </section>
    )
}

/* Field wrapper — only renders the leading-icon overlay; the consumer
 * passes the actual <input>/<select> with `pl-8` so the icon clears. */
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
