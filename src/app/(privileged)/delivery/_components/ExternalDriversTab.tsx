'use client'

/**
 * ExternalDriversTab — settings UI for the saved external-driver roster
 *
 * Backed by `pos.ExternalDriver`. These are one-off contractor drivers
 * (no User row, no commission ledger) that the PO form shows when
 * driver_source = EXTERNAL. Operators can also add them inline from
 * the PO form; this tab is for editing/retiring them after the fact.
 */

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Plus, Pencil, Trash2, Phone, Truck, X, Loader2, Search, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import {
    getExternalDrivers, createExternalDriver, updateExternalDriver, deleteExternalDriver,
    type ExternalDriver,
} from '@/app/actions/commercial/external-drivers'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type Mode = 'create' | { kind: 'edit'; driver: ExternalDriver }

export function ExternalDriversTab() {
    const [rows, setRows] = useState<ExternalDriver[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editor, setEditor] = useState<Mode | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ExternalDriver | null>(null)

    const reload = useCallback(async () => {
        setLoading(true)
        // The list endpoint defaults to active rows; we want the full
        // roster here so admins can re-activate retired drivers. The
        // backend filterset_fields includes is_active, so omitting the
        // filter returns everything.
        const list = await getExternalDrivers()
        setRows(list)
        setLoading(false)
    }, [])

    useEffect(() => { reload() }, [reload])

    const filtered = search.trim()
        ? rows.filter(r => {
            const q = search.toLowerCase()
            return r.name?.toLowerCase().includes(q)
                || r.phone?.toLowerCase().includes(q)
                || r.vehicle_plate?.toLowerCase().includes(q)
        })
        : rows

    return (
        <div className="px-3 md:px-5 py-4 space-y-4">
            {/* ── Toolbar ── */}
            <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/60 pointer-events-none" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, phone, or plate…"
                        className="w-full text-tp-sm font-medium pl-7 pr-3 py-2 rounded-xl outline-none border border-app-border bg-app-bg focus:ring-2 focus:ring-app-primary/20" />
                </div>
                <button onClick={() => setEditor('create')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold text-white transition-all hover:brightness-110"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <Plus size={13} /> New external driver
                </button>
            </div>

            {/* ── List ── */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={18} className="animate-spin text-app-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                    <Truck size={28} className="text-app-muted-foreground mb-2 opacity-40" />
                    <p className="text-tp-md font-bold text-app-muted-foreground">
                        {search ? 'No drivers match your search' : 'No external drivers saved yet'}
                    </p>
                    <p className="text-tp-xs text-app-muted-foreground mt-1 max-w-sm">
                        Add contractors here so the PO form can pick them by name instead of re-typing every time.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden divide-y divide-app-border/30" style={{ border: '1px solid var(--app-border)' }}>
                    {filtered.map(row => (
                        <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-app-bg/50 transition-colors">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${row.is_active === false ? 'opacity-50' : ''}`}
                                style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                <Truck size={13} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-tp-md font-bold text-app-foreground truncate">{row.name}</span>
                                    {row.is_active === false && (
                                        <span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                            style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                            Retired
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-tp-xxs text-app-muted-foreground mt-0.5">
                                    {row.phone && <span className="flex items-center gap-1"><Phone size={9} />{row.phone}</span>}
                                    {row.vehicle_plate && <span className="font-mono">{row.vehicle_plate}</span>}
                                    {row.vehicle_info && <span className="truncate">{row.vehicle_info}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button onClick={async () => {
                                    const result = await updateExternalDriver(row.id, { is_active: row.is_active === false })
                                    if ('error' in result) toast.error(result.error)
                                    else { toast.success(row.is_active === false ? 'Reactivated' : 'Retired'); reload() }
                                }}
                                    className="p-1.5 rounded-lg hover:bg-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors"
                                    title={row.is_active === false ? 'Reactivate' : 'Retire (hide from picker)'}>
                                    {row.is_active === false ? <Power size={12} /> : <PowerOff size={12} />}
                                </button>
                                <button onClick={() => setEditor({ kind: 'edit', driver: row })}
                                    className="p-1.5 rounded-lg hover:bg-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                                    <Pencil size={12} />
                                </button>
                                <button onClick={() => setDeleteTarget(row)}
                                    className="p-1.5 rounded-lg hover:bg-app-border/40 transition-colors"
                                    style={{ color: 'var(--app-muted-foreground)' }} title="Delete">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create / Edit dialog ── */}
            {editor !== null && (
                <ExternalDriverEditor
                    initial={editor === 'create' ? null : editor.driver}
                    onClose={() => setEditor(null)}
                    onSaved={() => { setEditor(null); reload() }}
                />
            )}

            {/* ── Delete confirm ── */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    const result = await deleteExternalDriver(deleteTarget.id)
                    if ('error' in result) {
                        toast.error(result.error)
                    } else {
                        toast.success(`Deleted ${deleteTarget.name}`)
                        setDeleteTarget(null)
                        reload()
                    }
                }}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This removes the driver from the PO picker. Past purchase orders that referenced them keep their history (the link goes to null)."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}


/* ─── Editor modal ─── */

function ExternalDriverEditor({
    initial, onClose, onSaved,
}: {
    initial: ExternalDriver | null
    onClose: () => void
    onSaved: () => void
}) {
    const [name, setName] = useState(initial?.name ?? '')
    const [phone, setPhone] = useState(initial?.phone ?? '')
    const [plate, setPlate] = useState(initial?.vehicle_plate ?? '')
    const [info, setInfo] = useState(initial?.vehicle_info ?? '')
    const [notes, setNotes] = useState(initial?.notes ?? '')
    const [pending, startTransition] = useTransition()

    const handleSave = () => {
        if (!name.trim()) { toast.error('Name is required.'); return }
        startTransition(async () => {
            const payload = {
                name: name.trim(),
                phone: phone.trim() || null,
                vehicle_plate: plate.trim() || null,
                vehicle_info: info.trim() || null,
                notes: notes.trim() || null,
            }
            const result = initial
                ? await updateExternalDriver(initial.id, payload)
                : await createExternalDriver({
                    name: payload.name,
                    phone: payload.phone ?? undefined,
                    vehicle_plate: payload.vehicle_plate ?? undefined,
                    vehicle_info: payload.vehicle_info ?? undefined,
                    notes: payload.notes ?? undefined,
                })
            if ('error' in result) {
                toast.error(result.error)
                return
            }
            toast.success(initial ? `Updated ${result.name}` : `Added ${result.name}`)
            onSaved()
        })
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-150"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose() }}>
            <div className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div className="px-5 py-3 flex items-center justify-between"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <h3 className="text-tp-md font-bold text-app-foreground">{initial ? 'Edit external driver' : 'New external driver'}</h3>
                    <button onClick={onClose} disabled={pending}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/40 transition-all disabled:opacity-50">
                        <X size={14} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <Field label="Name *" required>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Ahmad Khalil" autoFocus disabled={pending}
                            className={inputClass} />
                    </Field>
                    <Field label="Phone">
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                            placeholder="+961 …" disabled={pending}
                            className={inputClass} />
                    </Field>
                    <Field label="Plate">
                        <input type="text" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
                            placeholder="ABC-1234" disabled={pending}
                            className={inputClass + ' uppercase font-mono tracking-wider'} />
                    </Field>
                    <Field label="Vehicle">
                        <input type="text" value={info} onChange={e => setInfo(e.target.value)}
                            placeholder="e.g. White Hilux" disabled={pending}
                            className={inputClass} />
                    </Field>
                    <Field label="Notes">
                        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Preferred routes, working hours, etc." disabled={pending}
                            rows={2}
                            className={inputClass + ' resize-none'} />
                    </Field>
                </div>
                <div className="px-5 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-bg) 40%, var(--app-surface))' }}>
                    <button onClick={onClose} disabled={pending}
                        className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={pending || !name.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        {pending && <Loader2 size={11} className="animate-spin" />}
                        {pending ? 'Saving…' : initial ? 'Save changes' : 'Create driver'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const inputClass =
    'w-full text-tp-sm font-medium px-2.5 py-2 rounded-xl outline-none border border-app-border bg-app-bg ' +
    'focus:ring-2 focus:ring-app-primary/20 placeholder:text-app-muted-foreground/60 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1.5 block">
                {label}
                {required && <span className="text-app-error ml-0.5">*</span>}
            </span>
            {children}
        </label>
    )
}
