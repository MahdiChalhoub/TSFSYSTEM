'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    User, MapPin, Warehouse, UserCheck,
    Settings2, X, Check, ChevronRight, ChevronDown,
    Building2, Shield, Calendar, Hash, Clock, AlertCircle, Tag,
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
    /** Optional second reference — supplier's PO/quote number, internal
     *  cost-center code, or any external identifier the operator wants to
     *  carry on this PO. Always hand-typed; never auto-filled. */
    supplierRef?: string
    onSupplierRefChange?: (val: string) => void
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
 *
 *  All sizes resolve through the theme typography tokens
 *  (`text-tp-*`) — never raw `text-[Npx]`. Anything below the
 *  10px accessibility floor (the theme's documented minimum) is
 *  forbidden.
 */
const fieldBase =
    'w-full text-tp-sm font-medium px-2.5 py-2 rounded-xl outline-none border transition-all ' +
    'focus:ring-2 focus:ring-app-primary/15 placeholder:text-app-muted-foreground/60 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'
const fieldStyle: React.CSSProperties = {
    background: 'var(--app-bg)',
    borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
    color: 'var(--app-foreground)',
}
const labelCls =
    'text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1.5 block'
/* Soft divider (35%) for in-section separators; firm divider (60%) for
 * field outlines. Two opacities, used consistently. */
const SOFT_DIVIDER = 'color-mix(in srgb, var(--app-border) 35%, transparent)'
const FIRM_DIVIDER = 'color-mix(in srgb, var(--app-border) 60%, transparent)'

export function AdminSidebar({
    suppliers, sites, users,
    supplierId, onSupplierChange,
    siteId, onSiteChange,
    warehouseId, onWarehouseChange,
    scope, onScopeChange,
    assigneeId, onAssigneeChange,
    driverId, onDriverChange,
    reference, onReferenceChange,
    supplierRef = '', onSupplierRefChange,
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
                    <span className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                        {totalDone} of 5 sections
                    </span>
                    <span className="text-tp-xxs font-bold tabular-nums"
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
                      summary={stepDone.document
                          ? `${reference}${supplierRef ? ` · ${supplierRef}` : ''} · ${date}`
                          : undefined}>
                    {/* Primary reference — auto-filled from /settings/sequences,
                     *  but always hand-editable. The "Auto" pill signals that
                     *  the value came from the sequence so the operator knows
                     *  it'll change if they don't override. */}
                    <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls + ' mb-0'}>Reference</label>
                        <span className="text-tp-xxs font-bold uppercase tracking-widest px-1.5 py-px rounded"
                              style={{
                                  background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                  color: 'var(--app-primary)',
                              }}
                              title="Auto-filled from /settings/sequences. Edit to override.">
                            Auto · editable
                        </span>
                    </div>
                    <Field icon={<Hash size={11} />}>
                        <input value={reference} onChange={e => onReferenceChange(e.target.value)}
                               placeholder="PO Reference / Invoice #"
                               className={fieldBase + ' pl-8'} style={fieldStyle} />
                    </Field>

                    {/* Optional second reference — supplier PO/quote number,
                     *  internal cost-center code, legacy ERP id, etc. */}
                    {onSupplierRefChange && (
                        <div className="mt-2">
                            <label className={labelCls}>
                                Supplier / Internal ref
                                <span className="ml-1 font-medium normal-case tracking-normal text-app-muted-foreground/70">(optional)</span>
                            </label>
                            <Field icon={<Tag size={11} />}>
                                <input value={supplierRef}
                                       onChange={e => onSupplierRefChange(e.target.value)}
                                       placeholder="Supplier's PO #, internal code…"
                                       className={fieldBase + ' pl-8'} style={fieldStyle} />
                            </Field>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <DateField
                            label="Order date"
                            icon={<Calendar size={11} />}
                            value={date}
                            onChange={onDateChange}
                            quickAdds={[
                                { label: 'Today', from: 'today', delta: 0 },
                                { label: 'Yesterday', from: 'today', delta: -1 },
                            ]}
                        />
                        <DateField
                            label="Expected"
                            icon={<Clock size={11} />}
                            value={expectedDelivery}
                            onChange={onExpectedDeliveryChange}
                            quickAdds={[
                                { label: '+5d', from: 'order', delta: 5 },
                                { label: '+10d', from: 'order', delta: 10 },
                                { label: '+15d', from: 'order', delta: 15 },
                            ]}
                            anchorDate={date}
                        />
                    </div>
                </Step>

                <Step n={2} title="Primary Vendor" icon={<Building2 size={12} />}
                      done={stepDone.vendor} required
                      summary={supplierName ? `${scope.charAt(0) + scope.slice(1).toLowerCase()} · ${supplierName}` : undefined}>
                    <label className={labelCls}>Scope</label>
                    <div className="flex gap-1 p-1 rounded-xl mb-3"
                         style={{ background: 'var(--app-bg)', border: `1px solid ${FIRM_DIVIDER}` }}>
                        {(['OFFICIAL', 'INTERNAL'] as const).map(s => {
                            const active = scope === s
                            return (
                                <button key={s} type="button" onClick={() => onScopeChange(s)}
                                        className="flex-1 py-1.5 text-tp-xxs font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.97]"
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
                    <p className="text-tp-xxs font-medium text-app-muted-foreground/70 mt-2 flex items-start gap-1">
                        <UserCheck size={10} className="mt-0.5 flex-shrink-0" />
                        Optional. Defaults: assignee = creator; driver = none.
                    </p>
                </Step>

                <Step n={5} title="Analytics" icon={<Shield size={12} />}>
                    <label className={labelCls}>Profile</label>
                    <div className="rounded-xl overflow-hidden"
                         style={{ background: 'var(--app-bg)', border: `1px solid ${FIRM_DIVIDER}` }}>
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
                        <span className="text-tp-xs font-bold leading-snug" style={{ color: 'var(--app-foreground)' }}>
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
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-tp-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
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
                 style={{ borderBottom: `1px solid ${SOFT_DIVIDER}` }}>
            <button
                type="button"
                onClick={() => summary && setOpen(o => !o)}
                disabled={!summary}
                className="w-full flex items-center gap-2 disabled:cursor-default text-left"
            >
                {/* Step indicator. Sized at tp-xxs (10px) — the theme floor;
                 *  using `text-[9px]` (the previous value) violated the
                 *  documented accessibility minimum. */}
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-tp-xxs font-bold flex-shrink-0 transition-colors"
                     style={done
                         ? { background: 'var(--app-success, #22c55e)', color: 'white' }
                         : {
                             background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                             color: 'var(--app-primary)',
                             border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                         }}>
                    {done ? <Check size={11} strokeWidth={3} /> : n}
                </div>
                <span className="flex items-center gap-1.5 text-tp-sm font-bold tracking-tight text-app-foreground min-w-0">
                    <span style={{ color: 'var(--app-muted-foreground)' }} className="flex-shrink-0">{icon}</span>
                    <span className="truncate">{title}</span>
                </span>
                {required && !done && (
                    <span className="text-tp-xxs font-bold uppercase tracking-widest px-1.5 py-px rounded ml-auto flex-shrink-0"
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
                <p className="text-tp-xs font-medium text-app-muted-foreground mt-1.5 ml-7 truncate">
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

/* ─────────────────────────────────────────────────────────────────────
 *  DateField — single dropdown that combines preset offsets + a "Custom"
 *  option that pops the native calendar.
 *
 *  Why this shape:
 *    - The native `<input type="date">` icon is platform-default (looks
 *      foreign and doesn't match the app's theme).
 *    - Operators almost always pick either Today or a small offset
 *      (+5/+10/+15 days). Surfacing those as the FIRST options in the
 *      dropdown means most date entries are a single click — no calendar
 *      navigation at all.
 *    - The native calendar still lives behind a "Custom date…" footer so
 *      uncommon dates remain reachable without a custom calendar
 *      implementation (which would be ~300 lines and a maintenance tax).
 *
 *  `from: 'today'` → delta from today.
 *  `from: 'order'` → delta from `anchorDate` (so "+10d" on Expected means
 *                    10 days after the Order date, not 10 days from today).
 * ───────────────────────────────────────────────────────────────────── */
type QuickAdd = { label: string; from: 'today' | 'order'; delta: number }

function DateField({ label, icon, value, onChange, quickAdds, anchorDate }: {
    label: string
    icon: React.ReactNode
    value: string
    onChange: (v: string) => void
    quickAdds?: QuickAdd[]
    /** Used when a preset's `from` is 'order' — typically the order date. */
    anchorDate?: string
}) {
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const hiddenInputRef = useRef<HTMLInputElement | null>(null)

    /* Click-outside closes the dropdown. Same idiom used by SearchableDropdown. */
    useEffect(() => {
        if (!open) return
        const onDocClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [open])

    const computeDate = (q: QuickAdd): string => {
        const base = q.from === 'order' && anchorDate
            ? new Date(anchorDate)
            : new Date()
        base.setHours(0, 0, 0, 0)
        base.setDate(base.getDate() + q.delta)
        return base.toISOString().split('T')[0]
    }

    const display = value
        ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: '2-digit',
        })
        : 'Pick a date…'

    const openCustomPicker = () => {
        setOpen(false)
        // Native calendar — `showPicker()` is the modern API; falls back
        // to a synthesised click for older browsers.
        const el = hiddenInputRef.current
        if (!el) return
        try {
            (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
        } catch { /* fall through */ }
    }

    return (
        <div ref={wrapperRef} className="relative">
            <label className={labelCls}>{label}</label>
            {/* Trigger — looks identical to the other Field inputs. */}
            <button type="button"
                    onClick={() => setOpen(o => !o)}
                    className={fieldBase + ' pl-8 pr-7 text-left flex items-center'}
                    style={fieldStyle}>
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none">
                    {icon}
                </span>
                <span className={value ? '' : 'text-app-muted-foreground/60'}>{display}</span>
                <ChevronDown size={11}
                             className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted-foreground transition-transform pointer-events-none"
                             style={{ transform: open ? 'translateY(-50%) rotate(180deg)' : undefined }} />
            </button>

            {/* Hidden native input — only used by the "Custom date…" path. */}
            <input ref={hiddenInputRef} type="date" value={value}
                   onChange={e => onChange(e.target.value)}
                   className="sr-only"
                   tabIndex={-1} aria-hidden />

            {open && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl shadow-xl overflow-hidden"
                     style={{
                         background: 'var(--app-surface)',
                         border: `1px solid ${FIRM_DIVIDER}`,
                     }}>
                    {/* Quick-add presets */}
                    {quickAdds && quickAdds.length > 0 && (
                        <div className="py-1">
                            {quickAdds.map(q => {
                                const target = computeDate(q)
                                const active = value === target
                                return (
                                    <button key={q.label} type="button"
                                            onClick={() => { onChange(target); setOpen(false) }}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-tp-sm font-medium transition-colors hover:bg-app-surface-hover"
                                            style={active ? { color: 'var(--app-primary)' } : { color: 'var(--app-foreground)' }}>
                                        <span className="flex items-center gap-2">
                                            {active && <Check size={11} strokeWidth={3} />}
                                            <span className={active ? 'font-bold' : ''}>{q.label}</span>
                                        </span>
                                        <span className="text-tp-xxs font-mono text-app-muted-foreground">
                                            {target}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {/* Custom — opens the native calendar */}
                    <button type="button"
                            onClick={openCustomPicker}
                            className="w-full flex items-center gap-2 px-3 py-2 text-tp-sm font-bold transition-colors hover:bg-app-surface-hover"
                            style={{
                                color: 'var(--app-primary)',
                                borderTop: quickAdds && quickAdds.length > 0 ? `1px solid ${SOFT_DIVIDER}` : undefined,
                            }}>
                        <Calendar size={11} />
                        Custom date…
                    </button>
                </div>
            )}
        </div>
    )
}
