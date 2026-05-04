'use client'

/**
 * ExternalDriverPicker
 * --------------------
 * Searchable dropdown over the saved external/contractor drivers, plus
 * an inline "Add new" form so the operator can add a never-before-used
 * driver without leaving the PO form. The new row is created via
 * `createExternalDriver` and selected automatically.
 *
 * Used inside AdminSidebar's Ownership step when driver_source=EXTERNAL.
 */

import { useState, useTransition } from 'react'
import { Plus, X, Loader2, Phone, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { createExternalDriver, type ExternalDriver } from '@/app/actions/commercial/external-drivers'

type Props = {
    drivers: Record<string, any>[]
    value: number | ''
    onChange: (id: number | '') => void
    fieldBase: string
    fieldStyle: React.CSSProperties
    labelCls: string
}

export function ExternalDriverPicker({
    drivers, value, onChange,
    fieldBase, fieldStyle, labelCls,
}: Props) {
    // Local copy of the roster — lets the inline-add result land in the
    // dropdown immediately without waiting for a parent refresh.
    const [roster, setRoster] = useState<ExternalDriver[]>(
        drivers as unknown as ExternalDriver[]
    )
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [plate, setPlate] = useState('')
    const [pending, startTransition] = useTransition()

    const options = roster
        .filter(d => d.is_active !== false)
        .map(d => ({
            value: String(d.id),
            // Append the phone tail so two same-named drivers can be
            // told apart at a glance in the dropdown.
            label: d.phone ? `${d.name} · ${d.phone}` : d.name,
        }))

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Driver name is required.')
            return
        }
        startTransition(async () => {
            const result = await createExternalDriver({
                name: name.trim(),
                phone: phone.trim() || undefined,
                vehicle_plate: plate.trim() || undefined,
            })
            if ('error' in result) {
                toast.error(result.error)
                return
            }
            // Add to local roster + auto-select.
            setRoster(prev => [result, ...prev])
            onChange(result.id)
            // Reset and collapse the inline form.
            setName('')
            setPhone('')
            setPlate('')
            setAdding(false)
            toast.success(`${result.name} added.`)
        })
    }

    return (
        <div className="space-y-2">
            <SearchableDropdown
                label="External driver"
                value={value === '' ? '' : String(value)}
                onChange={v => onChange(v === '' ? '' : Number(v))}
                options={options}
                placeholder={options.length === 0 ? 'No saved drivers — add one below' : 'Search saved driver…'}
            />

            {!adding ? (
                <button type="button"
                    onClick={() => setAdding(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-tp-xxs font-bold uppercase tracking-widest transition-all hover:opacity-80"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-bg))',
                        color: 'var(--app-primary)',
                        border: '1px dashed color-mix(in srgb, var(--app-primary) 35%, transparent)',
                    }}>
                    <Plus size={11} /> Add new external driver
                </button>
            ) : (
                <div className="rounded-xl p-2.5 space-y-2"
                     style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>
                            New external driver
                        </span>
                        <button type="button" onClick={() => setAdding(false)} disabled={pending}
                            className="p-1 rounded hover:opacity-60" title="Cancel">
                            <X size={11} />
                        </button>
                    </div>
                    <div>
                        <label className={labelCls}>Name *</label>
                        <input type="text" className={fieldBase} style={fieldStyle}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Ahmad" autoFocus disabled={pending} />
                    </div>
                    <div>
                        <label className={labelCls}>Phone</label>
                        <div className="relative">
                            <Phone size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/60 pointer-events-none" />
                            <input type="tel" className={fieldBase + ' pl-7'} style={fieldStyle}
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+961 …" disabled={pending} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Plate</label>
                        <div className="relative">
                            <Truck size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/60 pointer-events-none" />
                            <input type="text" className={fieldBase + ' pl-7 uppercase font-mono tracking-wider'} style={fieldStyle}
                                value={plate}
                                onChange={e => setPlate(e.target.value.toUpperCase())}
                                placeholder="ABC-1234" disabled={pending} />
                        </div>
                    </div>
                    <button type="button" onClick={handleSave} disabled={pending || !name.trim()}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-tp-xxs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        {pending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        {pending ? 'Saving…' : 'Save & select'}
                    </button>
                </div>
            )}
        </div>
    )
}
