'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Shield, Eye, EyeOff, Lock, Filter, Save, ArrowLeft,
    Search, Loader2, Globe, Columns3, CheckCircle,
    ToggleLeft, ToggleRight, Info
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    saveListViewPolicy, getAvailableModels, getModelFields, listAllPolicies
} from '@/app/actions/listview-policies'

/* ═══════════════════════════════════════════════════════════════
   Policy Editor — FULL PAGE
   Select a list → see ALL fields → toggle each one visually.
   Two sections: Columns and Filters side by side.
   ═══════════════════════════════════════════════════════════════ */

type ModelOption = { key: string; label: string }
type FieldInfo = { key: string; label: string; type: string; is_relation: boolean }

export default function PolicyEditorPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editId = searchParams.get('id')

    // Form state
    const [viewKey, setViewKey] = useState('')
    const [orgId, setOrgId] = useState('')
    const [notes, setNotes] = useState('')
    const [maxPageSize, setMaxPageSize] = useState('')
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
    const [forcedColumns, setForcedColumns] = useState<Set<string>>(new Set())
    const [hiddenFilters, setHiddenFilters] = useState<Set<string>>(new Set())

    // Data state
    const [models, setModels] = useState<ModelOption[]>([])
    const [fields, setFields] = useState<FieldInfo[]>([])
    const [fieldsLoading, setFieldsLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [colSearch, setColSearch] = useState('')
    const [filterSearch, setFilterSearch] = useState('')
    const [loadingPolicy, setLoadingPolicy] = useState(!!editId)

    // Load available models
    useEffect(() => {
        getAvailableModels().then(m => setModels(Array.isArray(m) ? m : []))
    }, [])

    // Load existing policy if editing
    useEffect(() => {
        if (!editId) return
        setLoadingPolicy(true)
        listAllPolicies().then(data => {
            const all = Array.isArray(data) ? data : data?.results || []
            const policy = all.find((p: any) => String(p.id) === editId)
            if (policy) {
                setViewKey(policy.view_key || '')
                setOrgId(policy.organization || '')
                setNotes(policy.notes || '')
                setMaxPageSize(policy.config?.max_page_size?.toString() || '')
                setHiddenColumns(new Set(policy.config?.hidden_columns || []))
                setForcedColumns(new Set(policy.config?.forced_columns || []))
                setHiddenFilters(new Set(policy.config?.hidden_filters || []))
            }
            setLoadingPolicy(false)
        })
    }, [editId])

    // Load fields when view key changes
    useEffect(() => {
        if (!viewKey || viewKey === '*') { setFields([]); return }
        setFieldsLoading(true)
        getModelFields(viewKey).then(data => {
            setFields(data?.fields || [])
            setFieldsLoading(false)
        })
    }, [viewKey])

    // Toggle helpers
    const toggleHidden = (key: string) => {
        setHiddenColumns(prev => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else {
                next.add(key)
                setForcedColumns(fc => { const n = new Set(fc); n.delete(key); return n })
            }
            return next
        })
    }

    const toggleForced = (key: string) => {
        setForcedColumns(prev => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else {
                next.add(key)
                setHiddenColumns(hc => { const n = new Set(hc); n.delete(key); return n })
            }
            return next
        })
    }

    const toggleFilterHidden = (key: string) => {
        setHiddenFilters(prev => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }

    // Filtered fields
    const filteredColFields = useMemo(() =>
        fields.filter(f => !colSearch ||
            f.key.toLowerCase().includes(colSearch.toLowerCase()) ||
            f.label.toLowerCase().includes(colSearch.toLowerCase())
        ), [fields, colSearch])

    const filteredFilterFields = useMemo(() =>
        fields.filter(f => !filterSearch ||
            f.key.toLowerCase().includes(filterSearch.toLowerCase()) ||
            f.label.toLowerCase().includes(filterSearch.toLowerCase())
        ), [fields, filterSearch])

    // Bulk actions
    const hideAll = () => {
        const all = new Set(fields.map(f => f.key))
        setHiddenColumns(all)
        setForcedColumns(new Set())
    }
    const showAll = () => { setHiddenColumns(new Set()); setForcedColumns(new Set()) }
    const blockAllFilters = () => setHiddenFilters(new Set(fields.map(f => f.key)))
    const allowAllFilters = () => setHiddenFilters(new Set())

    // Save
    const handleSave = async () => {
        if (!viewKey) { toast.error('Select a list view first'); return }
        setSaving(true)
        try {
            await saveListViewPolicy({
                id: editId ? parseInt(editId) : undefined,
                organization: orgId || null,
                view_key: viewKey,
                config: {
                    hidden_columns: Array.from(hiddenColumns),
                    hidden_filters: Array.from(hiddenFilters),
                    forced_columns: Array.from(forcedColumns),
                    max_page_size: maxPageSize ? parseInt(maxPageSize) : null,
                },
                notes,
            })
            toast.success(editId ? 'Policy updated' : 'Policy created')
            router.push('/listview-policies')
        } catch {
            toast.error('Failed to save policy')
        }
        setSaving(false)
    }

    const viewLabel = models.find(m => m.key === viewKey)?.label || viewKey

    if (loadingPolicy) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--app-muted-foreground)' }}>
                <Loader2 size={24} className="animate-spin" />
            </div>
        )
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* ── Top Bar ─── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => router.push('/listview-policies')} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                        border: '1px solid var(--app-border)', background: 'var(--app-surface)',
                        color: 'var(--app-muted-foreground)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    }}>
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div style={{
                        width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
                        background: 'var(--app-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Shield size={16} style={{ color: '#fff' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--app-foreground)', margin: 0 }}>
                            {editId ? 'Edit Policy' : 'New Policy'}
                        </h1>
                        {viewKey && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)', margin: 0 }}>
                                {viewKey === '*' ? '🌐 Global (all views)' : viewLabel}
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.625rem 1.5rem', borderRadius: '0.75rem', border: 'none',
                    background: 'var(--app-primary)', color: '#fff', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.85rem',
                    boxShadow: '0 4px 14px var(--app-primary-glow, rgba(99,102,241,0.3))',
                    opacity: saving ? 0.7 : 1,
                }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Policy
                </button>
            </div>

            {/* ── Config Row: View + Org + Settings ─── */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 140px 1fr',
                gap: '0.75rem', marginBottom: '1.25rem',
                padding: '1rem', borderRadius: '0.75rem',
                border: '1px solid var(--app-border)', background: 'var(--app-surface)',
            }}>
                <div>
                    <label style={labelStyle}>List View</label>
                    <select value={viewKey} onChange={e => setViewKey(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">Select a list...</option>
                        <option value="*">🌐 Global (all views)</option>
                        {models.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Organization (empty = all orgs)</label>
                    <input placeholder="Org UUID or leave empty"
                        value={orgId} onChange={e => setOrgId(e.target.value)}
                        style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Max Page Size</label>
                    <input type="number" placeholder="—"
                        value={maxPageSize} onChange={e => setMaxPageSize(e.target.value)}
                        style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Admin Notes</label>
                    <input placeholder="Reason for this policy..."
                        value={notes} onChange={e => setNotes(e.target.value)}
                        style={inputStyle} />
                </div>
            </div>

            {/* ── No view selected ─── */}
            {!viewKey && (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem', borderRadius: '0.75rem',
                    border: '2px dashed var(--app-border)', color: 'var(--app-muted-foreground)',
                }}>
                    <Columns3 size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontWeight: 700, fontSize: '1rem' }}>Select a list view above</p>
                    <p style={{ fontSize: '0.8rem' }}>
                        Then you&apos;ll see all columns and filters with toggles to control visibility.
                    </p>
                </div>
            )}

            {/* ── Global wildcard ─── */}
            {viewKey === '*' && (
                <div style={{
                    padding: '2rem', borderRadius: '0.75rem',
                    border: '1px solid var(--app-border)', background: 'var(--app-surface)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Globe size={20} style={{ color: 'var(--app-primary)' }} />
                        <h3 style={{ fontWeight: 700, color: 'var(--app-foreground)', margin: 0 }}>Global Policy</h3>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)', marginBottom: '1rem' }}>
                        This applies to ALL list views as a base. Type column/filter keys manually.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--app-error)' }}>Hidden Columns (comma-separated)</label>
                            <textarea placeholder="balance, cost_price, margin, internal_notes"
                                value={Array.from(hiddenColumns).join(', ')}
                                onChange={e => setHiddenColumns(new Set(e.target.value.split(',').map(s => s.trim()).filter(Boolean)))}
                                rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: 'var(--app-warning)' }}>Hidden Filters (comma-separated)</label>
                            <textarea placeholder="profit_margin, cost_analysis"
                                value={Array.from(hiddenFilters).join(', ')}
                                onChange={e => setHiddenFilters(new Set(e.target.value.split(',').map(s => s.trim()).filter(Boolean)))}
                                rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Loading fields ─── */}
            {viewKey && viewKey !== '*' && fieldsLoading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    Loading model fields...
                </div>
            )}

            {/* ── Two-Panel Field Toggles ─── */}
            {viewKey && viewKey !== '*' && !fieldsLoading && fields.length > 0 && (
                <>
                    {/* Summary Bar */}
                    <div style={{
                        display: 'flex', gap: '1.5rem', padding: '0.75rem 1rem',
                        borderRadius: '0.75rem', marginBottom: '1rem',
                        background: 'var(--app-surface)', border: '1px solid var(--app-border)',
                        fontSize: '0.8rem', alignItems: 'center', flexWrap: 'wrap',
                    }}>
                        <span style={{ color: 'var(--app-foreground)', fontWeight: 700 }}>
                            {fields.length} fields
                        </span>
                        <span style={{ color: 'var(--app-success)', fontWeight: 700 }}>
                            <Eye size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                            {fields.length - hiddenColumns.size} visible
                        </span>
                        <span style={{ color: 'var(--app-error)', fontWeight: 700 }}>
                            <EyeOff size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                            {hiddenColumns.size} hidden
                        </span>
                        <span style={{ color: 'var(--app-success)', fontWeight: 700 }}>
                            <Lock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                            {forcedColumns.size} forced
                        </span>
                        <span style={{ color: 'var(--app-warning)', fontWeight: 700 }}>
                            <Filter size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                            {hiddenFilters.size} blocked filters
                        </span>
                    </div>

                    {/* Two Panels Side by Side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* ── COLUMNS Panel ─── */}
                        <div style={{
                            border: '1px solid var(--app-border)', borderRadius: '0.75rem',
                            background: 'var(--app-surface)', overflow: 'hidden',
                        }}>
                            {/* Panel Header */}
                            <div style={{
                                padding: '0.75rem 1rem', borderBottom: '1px solid var(--app-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'var(--app-surface-2, rgba(0,0,0,0.02))',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Columns3 size={16} style={{ color: 'var(--app-primary)' }} />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--app-foreground)' }}>
                                        Columns
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <SmallBtn onClick={showAll} label="Show All" />
                                    <SmallBtn onClick={hideAll} label="Hide All" danger />
                                </div>
                            </div>
                            {/* Search */}
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--app-border)' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{
                                        position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                        color: 'var(--app-muted-foreground)'
                                    }} />
                                    <input placeholder="Search columns..."
                                        value={colSearch} onChange={e => setColSearch(e.target.value)}
                                        style={{ ...inputStyle, paddingLeft: '1.75rem', fontSize: '0.78rem', padding: '0.375rem 0.5rem 0.375rem 1.75rem' }}
                                    />
                                </div>
                            </div>
                            {/* Field List */}
                            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                                {filteredColFields.map((field, i) => {
                                    const isHidden = hiddenColumns.has(field.key)
                                    const isForced = forcedColumns.has(field.key)
                                    return (
                                        <div key={field.key} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 0.75rem',
                                            borderBottom: i < filteredColFields.length - 1 ? '1px solid var(--app-border)' : 'none',
                                            background: isHidden ? 'rgba(239,68,68,0.04)' : isForced ? 'rgba(34,197,94,0.04)' : 'transparent',
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: 600, fontSize: '0.8rem',
                                                    color: isHidden ? 'var(--app-error)' : 'var(--app-foreground)',
                                                    textDecoration: isHidden ? 'line-through' : 'none',
                                                }}>
                                                    {field.label}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.62rem', color: 'var(--app-muted-foreground)',
                                                    fontFamily: 'monospace',
                                                }}>
                                                    {field.key} · {field.type}
                                                </div>
                                            </div>
                                            <ToggleBtn
                                                active={isHidden}
                                                onClick={() => toggleHidden(field.key)}
                                                activeLabel="Hidden" inactiveLabel="Visible"
                                                activeColor="var(--app-error)" activeIcon={<EyeOff size={11} />}
                                                inactiveIcon={<Eye size={11} />}
                                            />
                                            <ToggleBtn
                                                active={isForced}
                                                onClick={() => toggleForced(field.key)}
                                                activeLabel="Forced" inactiveLabel="Normal"
                                                activeColor="var(--app-success)" activeIcon={<Lock size={11} />}
                                                inactiveIcon={<ToggleLeft size={11} />}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ── FILTERS Panel ─── */}
                        <div style={{
                            border: '1px solid var(--app-border)', borderRadius: '0.75rem',
                            background: 'var(--app-surface)', overflow: 'hidden',
                        }}>
                            {/* Panel Header */}
                            <div style={{
                                padding: '0.75rem 1rem', borderBottom: '1px solid var(--app-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'var(--app-surface-2, rgba(0,0,0,0.02))',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Filter size={16} style={{ color: 'var(--app-warning)' }} />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--app-foreground)' }}>
                                        Filters
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <SmallBtn onClick={allowAllFilters} label="Allow All" />
                                    <SmallBtn onClick={blockAllFilters} label="Block All" danger />
                                </div>
                            </div>
                            {/* Search */}
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--app-border)' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{
                                        position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                        color: 'var(--app-muted-foreground)'
                                    }} />
                                    <input placeholder="Search filters..."
                                        value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                                        style={{ ...inputStyle, paddingLeft: '1.75rem', fontSize: '0.78rem', padding: '0.375rem 0.5rem 0.375rem 1.75rem' }}
                                    />
                                </div>
                            </div>
                            {/* Filter List */}
                            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                                {filteredFilterFields.map((field, i) => {
                                    const isBlocked = hiddenFilters.has(field.key)
                                    return (
                                        <div key={field.key} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 0.75rem',
                                            borderBottom: i < filteredFilterFields.length - 1 ? '1px solid var(--app-border)' : 'none',
                                            background: isBlocked ? 'rgba(239,68,68,0.04)' : 'transparent',
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: 600, fontSize: '0.8rem',
                                                    color: isBlocked ? 'var(--app-error)' : 'var(--app-foreground)',
                                                    textDecoration: isBlocked ? 'line-through' : 'none',
                                                }}>
                                                    {field.label}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.62rem', color: 'var(--app-muted-foreground)',
                                                    fontFamily: 'monospace',
                                                }}>
                                                    {field.key} · {field.type}
                                                </div>
                                            </div>
                                            <ToggleBtn
                                                active={isBlocked}
                                                onClick={() => toggleFilterHidden(field.key)}
                                                activeLabel="Blocked" inactiveLabel="Allowed"
                                                activeColor="var(--app-error)" activeIcon={<EyeOff size={11} />}
                                                inactiveIcon={<CheckCircle size={11} />}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── No fields found ─── */}
            {viewKey && viewKey !== '*' && !fieldsLoading && fields.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '3rem', borderRadius: '0.75rem',
                    border: '1px dashed var(--app-border)', color: 'var(--app-muted-foreground)',
                }}>
                    <Info size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 600 }}>No field metadata available</p>
                    <p style={{ fontSize: '0.8rem' }}>This model may not be registered in the field discovery map.</p>
                </div>
            )}

            {/* ── Bottom Save Bar ─── */}
            {viewKey && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem',
                    border: '1px solid var(--app-border)', background: 'var(--app-surface)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>
                        {hiddenColumns.size > 0 || hiddenFilters.size > 0 || forcedColumns.size > 0 ? (
                            <span>
                                <strong style={{ color: 'var(--app-error)' }}>{hiddenColumns.size}</strong> hidden columns,{' '}
                                <strong style={{ color: 'var(--app-success)' }}>{forcedColumns.size}</strong> forced,{' '}
                                <strong style={{ color: 'var(--app-warning)' }}>{hiddenFilters.size}</strong> blocked filters
                            </span>
                        ) : (
                            <span>No restrictions set — all fields visible to org users</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => router.push('/listview-policies')} style={{
                            padding: '0.5rem 1rem', borderRadius: '0.5rem',
                            border: '1px solid var(--app-border)', background: 'transparent',
                            color: 'var(--app-muted-foreground)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        }}>Cancel</button>
                        <button onClick={handleSave} disabled={saving} style={{
                            padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none',
                            background: 'var(--app-primary)', color: '#fff', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.85rem',
                            boxShadow: '0 4px 14px var(--app-primary-glow, rgba(99,102,241,0.3))',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            opacity: saving ? 0.7 : 1,
                        }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Policy
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ── Shared Components ──────────────────────── */

function ToggleBtn({ active, onClick, activeLabel, inactiveLabel, activeColor, activeIcon, inactiveIcon }: {
    active: boolean, onClick: () => void,
    activeLabel: string, inactiveLabel: string,
    activeColor: string, activeIcon: React.ReactNode, inactiveIcon: React.ReactNode
}) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            padding: '0.25rem 0.5rem', borderRadius: '0.35rem',
            border: '1px solid', fontSize: '0.66rem', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            background: active ? `${activeColor}18` : 'transparent',
            borderColor: active ? activeColor : 'var(--app-border)',
            color: active ? activeColor : 'var(--app-muted-foreground)',
        }}>
            {active ? activeIcon : inactiveIcon}
            {active ? activeLabel : inactiveLabel}
        </button>
    )
}

function SmallBtn({ onClick, label, danger }: { onClick: () => void, label: string, danger?: boolean }) {
    return (
        <button onClick={onClick} style={{
            padding: '0.2rem 0.5rem', borderRadius: '0.3rem',
            border: '1px solid var(--app-border)', fontSize: '0.65rem',
            fontWeight: 600, cursor: 'pointer', background: 'transparent',
            color: danger ? 'var(--app-error)' : 'var(--app-muted-foreground)',
        }}>{label}</button>
    )
}

const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, color: 'var(--app-muted-foreground)',
    marginBottom: '0.3rem', display: 'block', textTransform: 'uppercase',
    letterSpacing: '0.05em',
}
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
    border: '1px solid var(--app-border)', background: 'var(--app-surface)',
    color: 'var(--app-foreground)', fontSize: '0.85rem', outline: 'none',
}
