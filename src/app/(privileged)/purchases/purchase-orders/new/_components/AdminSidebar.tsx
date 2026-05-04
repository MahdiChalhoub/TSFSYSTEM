'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    User, MapPin, Warehouse, UserCheck,
    Settings2, X, Check, ChevronRight, ChevronDown,
    Building2, Shield, Calendar, Hash, Clock, AlertCircle, Tag, Lock,
} from 'lucide-react'
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { POLifecycle, type POStatus } from './POLifecycle'
import { ExternalDriverPicker } from './ExternalDriverPicker'

type Props = {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    /** People who can be set as the PO owner (purchase-perm roles, staff,
     *  superuser) — already filtered server-side in the page action. */
    assignees: Record<string, any>[]
    /** Users with a Driver row, scoped to module=purchase server-side. */
    drivers: Record<string, any>[]
    /** When set, the Site dropdown is filtered to these site ids only —
     *  used to scope non-admin users to their assigned branch (currently
     *  `currentUser.home_site`). `null` = no filter (org-wide access). */
    allowedSiteIds?: number[] | null
    /** True when the workspace dropdown has a branch selected — the
     *  sidebar then shows Site as a read-only display instead of a
     *  picker, since the workspace already owns that decision. */
    siteLockedByTopbar?: boolean
    /** True when the workspace also has a location pinned — locks
     *  the Warehouse field too. */
    warehouseLockedByTopbar?: boolean
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
    /** Three-way driver source toggle. INTERNAL = our drivers list,
     *  SUPPLIER = supplier picks one (no details collected here),
     *  EXTERNAL = pick from saved external roster (or add inline). */
    driverSource: 'INTERNAL' | 'SUPPLIER' | 'EXTERNAL'
    onDriverSourceChange: (next: 'INTERNAL' | 'SUPPLIER' | 'EXTERNAL') => void
    /** Saved external/contractor drivers — picker source when source=EXTERNAL. */
    externalDrivers: Record<string, any>[]
    externalDriverId: number | ''
    onExternalDriverChange: (id: number | '') => void
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
    /** Current PO lifecycle status — defaults to 'DRAFT' for new POs. */
    poStatus?: POStatus
    /** Callback to transition status — enables interactive lifecycle in edit mode. */
    onStatusChange?: (next: POStatus) => void
    /** True while a status transition is in flight. */
    statusTransitioning?: boolean
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
    suppliers, sites,
    assignees, drivers,
    allowedSiteIds = null,
    siteLockedByTopbar = false,
    warehouseLockedByTopbar = false,
    supplierId, onSupplierChange,
    siteId, onSiteChange,
    warehouseId, onWarehouseChange,
    scope, onScopeChange,
    assigneeId, onAssigneeChange,
    driverId, onDriverChange,
    driverSource, onDriverSourceChange,
    externalDrivers, externalDriverId, onExternalDriverChange,
    /* Reference is read-only in the panel; the prop stays in the API for
     * the parent's auto-fill effect (scope toggle rewrites the value
     * through the parent's setReference, not via this prop). Underscored
     * to silence the unused-symbol lint. */
    reference, onReferenceChange: _onReferenceChange,
    supplierRef = '', onSupplierRefChange,
    date, onDateChange,
    expectedDelivery, onExpectedDeliveryChange,
    onClose,
    poStatus = 'DRAFT',
    onStatusChange,
    statusTransitioning = false,
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
    // Apply the permission filter once, before mapping to dropdown shape.
    // `null` allowedSiteIds means org-wide access (staff/superuser); a set
    // means non-admin users limited to their assigned branch(es).
    const visibleSites = useMemo(() => {
        if (!allowedSiteIds || allowedSiteIds.length === 0) return sites
        const allowed = new Set(allowedSiteIds.map(Number))
        return sites.filter(s => allowed.has(Number(s.id)))
    }, [sites, allowedSiteIds])
    const siteOptions = useMemo(
        () => visibleSites.map(s => ({ value: String(s.id), label: s.name })),
        [visibleSites],
    )
    const warehouseOptions = useMemo(
        () => warehouses.map((w: any) => ({ value: String(w.id), label: w.name })),
        [warehouses],
    )
    // Two distinct dropdowns drive the Ownership step: the assignee list
    // is for "who owns this PO" (purchase-perm users), the driver list is
    // for "who's physically picking it up" (Driver-row users). Each is
    // pre-filtered server-side, so we just map them to the dropdown shape.
    const assigneeOptions = useMemo(
        () => assignees.map(u => ({ value: String(u.id), label: u.username || u.email })),
        [assignees],
    )
    const driverOptions = useMemo(
        () => drivers.map(u => ({ value: String(u.id), label: u.username || u.email })),
        [drivers],
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
        const u = assignees.find(u => Number(u.id) === Number(assigneeId))
        return u?.username || u?.email
    }, [assignees, assigneeId])

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

            {/* LIFECYCLE ──────────────────────────────────────────
             *  Visualises the PO's progression: DRAFT → APPROVED →
             *  SENT → IN_TRANSIT → PARTIAL → DELIVERED, with FAILED
             *  shown as an alternate exit. On the New form the
             *  current stage is always DRAFT (the PO doesn't exist
             *  yet); when this panel is reused for editing an
             *  existing PO, swap `current` for `po.status`. */}
            <div className="flex-shrink-0 px-4 pb-2">
                <POLifecycle current={poStatus} variant="full"
                             onStageChange={onStatusChange}
                             transitioning={statusTransitioning}
                             collapsible
                             defaultCollapsed={poStatus === 'DRAFT'} />
            </div>

            {/* BODY ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-2">

                <Step n={1} title="Document Info" icon={<Hash size={12} />}
                      done={stepDone.document}
                      summary={stepDone.document
                          ? `${reference}${supplierRef ? ` · ${supplierRef}` : ''} · ${date}`
                          : undefined}>
                    {/* Primary reference — system-assigned, READ-ONLY.
                     *  Comes from the tenant's PURCHASE_ORDER sequence in
                     *  /settings/sequences. Operators can't edit it directly;
                     *  to capture an alternate id (supplier's PO, internal
                     *  code) they use the Supplier / Internal ref field
                     *  below. The `onReferenceChange` prop is still fired
                     *  by the parent's auto-fill effect when the scope
                     *  toggle flips OFFICIAL ⇄ INTERNAL. */}
                    <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls + ' mb-0'}>Reference</label>
                        <span className="inline-flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-widest px-1.5 py-px rounded"
                              style={{
                                  background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                  color: 'var(--app-primary)',
                              }}
                              title="System-assigned from /settings/sequences. Read-only.">
                            <Lock size={9} /> Auto
                        </span>
                    </div>
                    <Field icon={<Hash size={11} />}>
                        <input value={reference}
                               readOnly
                               aria-readonly
                               tabIndex={-1}
                               onChange={() => { /* read-only — handler intentionally a no-op */ }}
                               className={fieldBase + ' pl-8 cursor-not-allowed select-all'}
                               style={{
                                   ...fieldStyle,
                                   background: 'color-mix(in srgb, var(--app-bg) 60%, var(--app-surface))',
                               }} />
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
                            align="end"
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
                    {/* Site — locked to the workspace selection when set, so
                        the operator doesn't have a second control showing
                        a different value than the top-bar dropdown. */}
                    {siteLockedByTopbar ? (
                        <>
                            <label className={labelCls}>Site</label>
                            <div className={fieldBase + ' flex items-center gap-2 cursor-default'}
                                 style={{ ...fieldStyle, background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-bg))' }}
                                 title="Controlled by the workspace dropdown — change it from the top bar to switch branch.">
                                <MapPin size={11} style={{ color: 'var(--app-primary)' }} />
                                <span className="flex-1 truncate">{siteName || '—'}</span>
                                <Lock size={10} className="text-app-muted-foreground/70" />
                            </div>
                            <p className="text-tp-xxs font-medium text-app-muted-foreground/70 mt-1">
                                Set in workspace
                            </p>
                        </>
                    ) : (
                        <SearchableDropdown
                            label="Site"
                            value={siteId === '' ? '' : String(siteId)}
                            onChange={v => { onSiteChange(v === '' ? '' : Number(v)); onWarehouseChange('') }}
                            options={siteOptions}
                            placeholder="Search site…"
                        />
                    )}
                    <div className="mt-2">
                        {warehouseLockedByTopbar ? (
                            <>
                                <label className={labelCls}>Warehouse</label>
                                <div className={fieldBase + ' flex items-center gap-2 cursor-default'}
                                     style={{ ...fieldStyle, background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-bg))' }}
                                     title="Controlled by the workspace dropdown.">
                                    <Warehouse size={11} style={{ color: 'var(--app-primary)' }} />
                                    <span className="flex-1 truncate">{warehouseName || '—'}</span>
                                    <Lock size={10} className="text-app-muted-foreground/70" />
                                </div>
                            </>
                        ) : !siteId ? (
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
                        options={assigneeOptions}
                        placeholder={assigneeOptions.length === 0 ? 'No purchase users — assign roles first' : 'Search assignee…'}
                    />

                    {/* ── Driver source toggle ─────────────────────────
                     *  Three mutually-exclusive ways to identify who
                     *  picks up the goods. INTERNAL keeps the picker
                     *  shape we had; SUPPLIER hides all driver inputs
                     *  (the supplier nominates a driver later via the
                     *  portal); EXTERNAL surfaces name + phone for a
                     *  one-off contractor we don't store as a User. */}
                    <div className="mt-3">
                        <label className={labelCls}>Driver source</label>
                        <div className="flex gap-1 p-1 rounded-xl"
                             style={{ background: 'var(--app-bg)', border: `1px solid ${FIRM_DIVIDER}` }}>
                            {(['INTERNAL', 'SUPPLIER', 'EXTERNAL'] as const).map(src => {
                                const active = driverSource === src
                                return (
                                    <button key={src} type="button"
                                            onClick={() => {
                                                onDriverSourceChange(src)
                                                // Reset the linked field so the
                                                // payload doesn't carry stale data
                                                // from the source we just left.
                                                if (src !== 'INTERNAL') onDriverChange('')
                                                if (src !== 'EXTERNAL') onExternalDriverChange('')
                                            }}
                                            className="flex-1 py-1.5 text-tp-xxs font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.97]"
                                            style={active
                                                ? { background: 'var(--app-primary)', color: 'white' }
                                                : { color: 'var(--app-muted-foreground)' }}>
                                        {src === 'INTERNAL' ? 'Ours' : src === 'SUPPLIER' ? 'Supplier' : 'External'}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {driverSource === 'INTERNAL' && (
                        <div className="mt-2">
                            <SearchableDropdown
                                label="Driver"
                                value={driverId === '' ? '' : String(driverId)}
                                onChange={v => onDriverChange(v === '' ? '' : Number(v))}
                                options={driverOptions}
                                placeholder={driverOptions.length === 0 ? 'No drivers — add one in /delivery' : 'Search driver…'}
                            />
                        </div>
                    )}
                    {driverSource === 'SUPPLIER' && (
                        <p className="text-tp-xxs font-medium text-app-muted-foreground/80 mt-2 flex items-start gap-1.5">
                            <UserCheck size={10} className="mt-0.5 flex-shrink-0" />
                            Supplier will nominate the driver from their portal — no details needed here.
                        </p>
                    )}
                    {driverSource === 'EXTERNAL' && (
                        <div className="mt-2">
                            <ExternalDriverPicker
                                drivers={externalDrivers}
                                value={externalDriverId}
                                onChange={onExternalDriverChange}
                                fieldBase={fieldBase}
                                fieldStyle={fieldStyle}
                                labelCls={labelCls}
                            />
                        </div>
                    )}

                    {/* Tiny hints — make optional fields explicit. */}
                    <p className="text-tp-xxs font-medium text-app-muted-foreground/70 mt-2 flex items-start gap-1">
                        <UserCheck size={10} className="mt-0.5 flex-shrink-0" />
                        Assignee defaults to creator; driver source defaults to Ours.
                    </p>
                </Step>

                <Step n={5} title="Analytics" icon={<Shield size={12} />}>
                    <label className={labelCls}>Active profile</label>
                    {/* Non-compact selector — surfaces the active profile's
                     *  name inline ("Default Profile" / "Conservative" / ...)
                     *  so the operator sees which profile drives this PO's
                     *  analytics overrides. The compact variant hides the
                     *  name and was the source of the "what profile am I
                     *  using?" confusion. */}
                    <AnalyticsProfileSelector pageContext="purchase-order" onProfileChange={() => {}} />
                    <p className="text-tp-xxs font-medium text-app-muted-foreground/70 mt-1.5 leading-snug">
                        Drives sales/cost windows, lead-time, and reorder formulas
                        for this PO. Click the chip to switch.
                    </p>
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

function DateField({ label, icon, value, onChange, quickAdds, anchorDate, align = 'start' }: {
    label: string
    icon: React.ReactNode
    value: string
    onChange: (v: string) => void
    quickAdds?: QuickAdd[]
    /** Used when a preset's `from` is 'order' — typically the order date. */
    anchorDate?: string
    /** Which side of the trigger the dropdown anchors to. Use `end` when
     *  the field sits on the right of a 2-col grid so the menu stays
     *  inside the parent's overflow box. */
    align?: 'start' | 'end'
}) {
    const [open, setOpen] = useState(false)
    /* `presets` shows the quick-add list. `calendar` shows the themed
     * mini-calendar (replaces the unstylable native browser picker). */
    const [mode, setMode] = useState<'presets' | 'calendar'>('presets')
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const hiddenInputRef = useRef<HTMLInputElement | null>(null)

    /* Click-outside closes the dropdown. Same idiom used by SearchableDropdown. */
    useEffect(() => {
        if (!open) return
        const onDocClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
                setMode('presets')
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
        // Switch to the themed calendar view. Stays inside the same dropdown
        // surface so the user never leaves the panel's design language.
        setMode('calendar')
    }

    /* Legacy native-picker fallback path — kept available behind the helper
     * but no longer surfaced through the UI. We could remove it once we're
     * confident the themed calendar covers every workflow. */
    const _openNativePicker = () => {
        setOpen(false)
        const el = hiddenInputRef.current
        if (!el) return
        try {
            (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
        } catch { /* fall through */ }
    }

    return (
        <div ref={wrapperRef} className="relative">
            <label className={labelCls}>{label}</label>
            {/* Trigger inner-wrapper is `relative` so the icon + chevron
             *  position against the BUTTON's vertical center. Without this
             *  wrapper, `absolute top-1/2` falls through to the outer
             *  wrapper which spans label → button → dropdown — the icon
             *  ends up pinned to the wrapper top, not the button center. */}
            <div className="relative">
                <button type="button"
                        onClick={() => setOpen(o => !o)}
                        className={fieldBase + ' pl-8 pr-7 text-left'}
                        style={fieldStyle}>
                    <span className={value ? '' : 'text-app-muted-foreground/60'}>{display}</span>
                </button>
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none flex items-center">
                    {icon}
                </span>
                <ChevronDown size={11}
                             className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted-foreground transition-transform pointer-events-none"
                             style={{ transform: open ? 'translateY(-50%) rotate(180deg)' : undefined }} />
            </div>

            {/* Hidden native input — only used by the "Custom date…" path. */}
            <input ref={hiddenInputRef} type="date" value={value}
                   onChange={e => onChange(e.target.value)}
                   className="sr-only"
                   tabIndex={-1} aria-hidden />

            {open && (
                <div className={`absolute z-30 mt-1.5 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${align === 'end' ? 'right-0' : 'left-0'}`}
                     style={{
                         /* Min-width frees the menu from the trigger's narrow
                          * grid cell (each date column is ~140px). When the
                          * trigger is in the right column the parent passes
                          * `align="end"` so the menu spills LEFT instead of
                          * right — that keeps it inside the panel's
                          * `overflow-hidden` box. */
                         minWidth: '15rem',
                         maxWidth: '17rem',
                         background: 'var(--app-surface)',
                         border: `1px solid ${FIRM_DIVIDER}`,
                         boxShadow: '0 12px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
                     }}>
                    {/* Header — surfaces the current selection prominently.
                     *  Two-line layout (date on top, relative below) so the
                     *  long-form date never has to compete for horizontal
                     *  space with the relative chip. */}
                    {value && (
                        <div className="px-3 py-2"
                             style={{
                                 background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                 borderBottom: `1px solid ${SOFT_DIVIDER}`,
                             }}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                                    Current
                                </div>
                                <span className="text-tp-xxs font-bold tabular-nums"
                                      style={{ color: 'var(--app-primary)' }}>
                                    {relativeFromToday(value)}
                                </span>
                            </div>
                            <div className="text-tp-sm font-bold text-app-foreground mt-0.5">
                                {formatDateLong(value)}
                            </div>
                        </div>
                    )}

                    {mode === 'presets' ? (
                        <>
                            {/* Quick-add presets */}
                            {quickAdds && quickAdds.length > 0 && (
                                <div className="py-1">
                                    {quickAdds.map(q => {
                                        const target = computeDate(q)
                                        const active = value === target
                                        return (
                                            <button key={q.label} type="button"
                                                    onClick={() => { onChange(target); setOpen(false) }}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-tp-sm transition-colors hover:bg-app-surface-hover active:scale-[0.98]"
                                                    style={active
                                                        ? { color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }
                                                        : { color: 'var(--app-foreground)' }}>
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <span className="w-3 flex-shrink-0 flex items-center justify-center">
                                                        {active && <Check size={11} strokeWidth={3} />}
                                                    </span>
                                                    <span className={active ? 'font-bold' : 'font-medium'}>{q.label}</span>
                                                    <span className="text-tp-xxs text-app-muted-foreground/70 truncate">
                                                        {dayOfWeekShort(target)}
                                                    </span>
                                                </span>
                                                <span className="text-tp-xxs font-mono text-app-muted-foreground tabular-nums flex-shrink-0">
                                                    {target}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* "Custom date…" — switches to the themed mini-calendar
                             *  view. We avoid the native browser picker entirely
                             *  so the surface stays inside the app's design language. */}
                            <button type="button"
                                    onClick={openCustomPicker}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-tp-sm font-bold transition-colors hover:bg-app-surface-hover active:scale-[0.98] whitespace-nowrap"
                                    style={{
                                        color: 'var(--app-primary)',
                                        background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)',
                                        borderTop: quickAdds && quickAdds.length > 0 ? `1px solid ${SOFT_DIVIDER}` : undefined,
                                    }}>
                                <Calendar size={12} className="flex-shrink-0" />
                                <span>Pick exact date…</span>
                                <ChevronRight size={11} className="ml-auto opacity-60 flex-shrink-0" />
                            </button>
                        </>
                    ) : (
                        <MiniCalendar
                            value={value}
                            onPick={(d) => { onChange(d); setOpen(false); setMode('presets') }}
                            onBack={() => setMode('presets')}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

/* ── Date formatting helpers — used only by the date dropdown header
 * and preset row hints. Locale-aware, timezone-safe. */
function formatDateLong(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
    })
}
function dayOfWeekShort(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
}
/** "Today", "Tomorrow", "in 5 days", "3 days ago" — short relative phrasing. */
function relativeFromToday(iso: string): string {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(iso + 'T00:00:00')
    const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days === -1) return 'Yesterday'
    if (days > 1) return `in ${days} days`
    return `${Math.abs(days)} days ago`
}

/* ─────────────────────────────────────────────────────────────────────
 *  MiniCalendar — themed month grid that replaces the native browser
 *  calendar picker. ~80 lines, single dependency on date helpers above.
 *  Locale-aware day-of-week labels via `Intl.DateTimeFormat`.
 *
 *  Design philosophy:
 *    - Same surface as the preset list (no second popover).
 *    - "Back" pivots to the preset view; "Today" jumps the calendar to
 *      this month and selects today; the date numbers themselves are the
 *      primary action.
 *    - Today is outlined; selected is filled primary. No additional
 *      decoration so the grid stays calm.
 * ───────────────────────────────────────────────────────────────────── */
function MiniCalendar({ value, onPick, onBack }: {
    value: string
    onPick: (iso: string) => void
    onBack: () => void
}) {
    const today = useMemo(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d
    }, [])
    /* Anchor the visible month on the selected date when there is one,
     * otherwise on the current month. */
    const seedMonth = useMemo(() => {
        const src = value ? new Date(value + 'T00:00:00') : today
        return new Date(src.getFullYear(), src.getMonth(), 1)
    }, [value, today])
    const [view, setView] = useState<Date>(seedMonth)

    const monthLabel = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    const firstDay = new Date(view.getFullYear(), view.getMonth(), 1)
    const lastDay = new Date(view.getFullYear(), view.getMonth() + 1, 0)
    /* Locale-aware short weekday headers (Su/Mo/… or Lu/Ma/… in fr, etc.). */
    const weekdays = useMemo(() => {
        const names: string[] = []
        const sun = new Date(2024, 0, 7) // a known Sunday
        for (let i = 0; i < 7; i++) {
            const d = new Date(sun); d.setDate(sun.getDate() + i)
            names.push(d.toLocaleDateString(undefined, { weekday: 'narrow' }))
        }
        return names
    }, [])

    /* Build a 6-week grid (42 cells). Leading days of the week before the
     * 1st come from the previous month; trailing days fill the last row. */
    const cells = useMemo(() => {
        const out: { date: Date; inMonth: boolean }[] = []
        const start = new Date(firstDay)
        start.setDate(start.getDate() - start.getDay()) // back up to Sunday
        for (let i = 0; i < 42; i++) {
            const d = new Date(start); d.setDate(start.getDate() + i)
            out.push({ date: d, inMonth: d.getMonth() === view.getMonth() })
        }
        return out
    }, [firstDay, view])

    const toIso = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }
    const valueIso = value
    const todayIso = toIso(today)

    const shiftMonth = (delta: number) => {
        setView(v => new Date(v.getFullYear(), v.getMonth() + delta, 1))
    }

    return (
        <div className="p-2">
            {/* Top bar — Back · Month nav. Header text uses short month
             *  ("May 2026") to fit the compact width. */}
            <div className="flex items-center gap-0.5 mb-1.5">
                <button type="button" onClick={onBack}
                        title="Back to presets"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover transition-colors active:scale-[0.95]">
                    <ChevronRight size={11} className="rotate-180" />
                </button>
                <button type="button" onClick={() => shiftMonth(-1)}
                        title="Previous month"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover transition-colors active:scale-[0.95]">
                    <ChevronRight size={11} className="rotate-180" />
                </button>
                <div className="flex-1 text-center text-tp-xs font-bold text-app-foreground select-none truncate">
                    {monthLabel}
                </div>
                <button type="button" onClick={() => shiftMonth(1)}
                        title="Next month"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover transition-colors active:scale-[0.95]">
                    <ChevronRight size={11} />
                </button>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-px mb-0.5">
                {weekdays.map((w, i) => (
                    <div key={i}
                         className="text-tp-xxs font-bold text-center text-app-muted-foreground/70 py-0.5">
                        {w}
                    </div>
                ))}
            </div>

            {/* Day grid — square-ish cells (28×26) hit the sweet spot
             *  between density and tap-target on a 240–272px container. */}
            <div className="grid grid-cols-7 gap-px">
                {cells.map(({ date: d, inMonth }, i) => {
                    const iso = toIso(d)
                    const isSelected = iso === valueIso
                    const isToday = iso === todayIso
                    return (
                        <button key={i} type="button"
                                onClick={() => onPick(iso)}
                                aria-label={d.toLocaleDateString(undefined, { dateStyle: 'full' })}
                                className="text-tp-xs h-7 rounded-md transition-all active:scale-[0.95] hover:bg-app-surface-hover tabular-nums"
                                style={isSelected
                                    ? {
                                        background: 'var(--app-primary)',
                                        color: 'white',
                                        fontWeight: 700,
                                    }
                                    : {
                                        color: inMonth ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                        opacity: inMonth ? 1 : 0.4,
                                        // Outline today (when not the selected day) so it's
                                        // discoverable without competing with selection.
                                        border: isToday && !isSelected
                                            ? `1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)`
                                            : '1px solid transparent',
                                    }}>
                            {d.getDate()}
                        </button>
                    )
                })}
            </div>

            {/* Footer — Today / Clear shortcuts */}
            <div className="flex items-center justify-between mt-2 pt-2"
                 style={{ borderTop: `1px solid ${SOFT_DIVIDER}` }}>
                <button type="button" onClick={() => onPick('')}
                        className="text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-colors px-1.5 py-0.5 rounded">
                    Clear
                </button>
                <button type="button" onClick={() => onPick(todayIso)}
                        className="text-tp-xs font-bold transition-colors px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--app-primary)' }}>
                    Today
                </button>
            </div>
        </div>
    )
}
