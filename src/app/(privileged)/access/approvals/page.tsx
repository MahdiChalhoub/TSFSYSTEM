'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    ClipboardCheck, Search, Loader2, CheckCircle, XCircle, Clock,
    RefreshCw, MessageSquare, Users, AlertTriangle, Send,
    ChevronDown, ChevronUp, Link2, UserPlus
} from 'lucide-react'

type ApprovalRequest = {
    id: number
    request_type: string; status: string
    target_user: number; user_email: string; user_name: string
    target_contact: number | null; contact_name: string | null
    submitted_data: Record<string, any>
    review_notes: string | null; correction_notes: string | null
    reviewed_by: number | null; reviewed_by_name: string | null; reviewed_at: string | null
    created_at: string; updated_at: string
}

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    CLIENT_REGISTRATION: { label: 'Client Registration', color: 'var(--app-success)' },
    SUPPLIER_REGISTRATION: { label: 'Supplier Registration', color: 'var(--app-warning)' },
    PORTAL_LINK_CHANGE: { label: 'Link Change', color: 'var(--app-primary)' },
    ACCESS_REACTIVATION: { label: 'Reactivation', color: 'var(--app-info, #10b981)' },
}

const STATUS_STYLE: Record<string, { color: string; label: string; icon: any }> = {
    PENDING: { color: 'var(--app-warning)', label: 'Pending', icon: Clock },
    APPROVED: { color: 'var(--app-success)', label: 'Approved', icon: CheckCircle },
    REJECTED: { color: 'var(--app-danger)', label: 'Rejected', icon: XCircle },
    NEEDS_CORRECTION: { color: 'var(--app-warning)', label: 'Needs Correction', icon: AlertTriangle },
    CANCELLED: { color: 'var(--app-muted-foreground)', label: 'Cancelled', icon: XCircle },
}

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('PENDING')
    const [expanded, setExpanded] = useState<number | null>(null)
    const [correctionId, setCorrectionId] = useState<number | null>(null)
    const [correctionNotes, setCorrectionNotes] = useState('')
    const [processing, setProcessing] = useState<number | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
            const data = await erpFetch(`iam/approvals/${params}`)
            setRequests(Array.isArray(data) ? data : data?.results ?? [])
        } catch { toast.error('Failed to load approval requests') }
        setLoading(false)
    }, [statusFilter])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        if (!search) return requests
        const q = search.toLowerCase()
        return requests.filter(r =>
            r.user_name?.toLowerCase().includes(q) ||
            r.user_email?.toLowerCase().includes(q) ||
            r.contact_name?.toLowerCase().includes(q) ||
            r.submitted_data?.company_name?.toLowerCase()?.includes(q)
        )
    }, [requests, search])

    const kpis = useMemo(() => ({
        pending: requests.filter(r => r.status === 'PENDING').length,
        correction: requests.filter(r => r.status === 'NEEDS_CORRECTION').length,
        approved: requests.filter(r => r.status === 'APPROVED').length,
        rejected: requests.filter(r => r.status === 'REJECTED').length,
    }), [requests])

    const handleApprove = async (req: ApprovalRequest) => {
        setProcessing(req.id)
        let contactId = req.target_contact

        // For supplier registrations, we might need to ask for contact linkage
        if (req.request_type === 'SUPPLIER_REGISTRATION' && !contactId) {
            const id = prompt('Enter the Supplier Contact ID to link this user to:')
            if (!id) { setProcessing(null); return }
            contactId = parseInt(id)
            if (isNaN(contactId)) { toast.error('Invalid contact ID'); setProcessing(null); return }
        }

        try {
            await erpFetch(`iam/approvals/${req.id}/approve/`, {
                method: 'POST',
                body: JSON.stringify({ contact_id: contactId }),
                headers: { 'Content-Type': 'application/json' },
            })
            toast.success(`Request #${req.id} approved`)
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to approve')
        }
        setProcessing(null)
    }

    const handleReject = async (req: ApprovalRequest) => {
        const reason = prompt('Reason for rejection:')
        if (reason === null) return
        setProcessing(req.id)
        try {
            await erpFetch(`iam/approvals/${req.id}/reject/`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
                headers: { 'Content-Type': 'application/json' },
            })
            toast.success(`Request #${req.id} rejected`)
            load()
        } catch { toast.error('Failed to reject') }
        setProcessing(null)
    }

    const handleCorrection = async () => {
        if (!correctionId || !correctionNotes.trim()) return
        setProcessing(correctionId)
        try {
            await erpFetch(`iam/approvals/${correctionId}/correction/`, {
                method: 'POST',
                body: JSON.stringify({ notes: correctionNotes }),
                headers: { 'Content-Type': 'application/json' },
            })
            toast.success('Correction requested')
            setCorrectionId(null)
            setCorrectionNotes('')
            load()
        } catch { toast.error('Failed to request correction') }
        setProcessing(null)
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'var(--app-primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <ClipboardCheck size={24} color="white" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)', margin: 0 }}>
                        Approval Queue
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--app-muted-foreground)', margin: 0 }}>
                        Review and approve portal access requests
                    </p>
                </div>
                <button onClick={load} style={{
                    marginLeft: 'auto', padding: '0.5rem 1rem', borderRadius: 8,
                    background: 'var(--app-muted)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: 'var(--app-foreground)', fontSize: '0.875rem',
                }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Pending', value: kpis.pending, icon: Clock, color: 'var(--app-warning)' },
                    { label: 'Needs Correction', value: kpis.correction, icon: AlertTriangle, color: 'var(--app-warning)' },
                    { label: 'Approved', value: kpis.approved, icon: CheckCircle, color: 'var(--app-success)' },
                    { label: 'Rejected', value: kpis.rejected, icon: XCircle, color: 'var(--app-danger)' },
                ].map(k => (
                    <div key={k.label} style={{
                        padding: '1.25rem', borderRadius: 12,
                        background: 'var(--app-card)', border: '1px solid var(--app-border)',
                        display: 'flex', alignItems: 'center', gap: '1rem',
                    }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: `color-mix(in srgb, ${k.color} 15%, transparent)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <k.icon size={20} color={k.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>{k.value}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'var(--app-muted)', borderRadius: 8, padding: '0.5rem 0.75rem',
                }}>
                    <Search size={16} color="var(--app-muted-foreground)" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by user, email, company..."
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--app-foreground)', fontSize: '0.875rem',
                        }}
                    />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
                    padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.875rem',
                    background: 'var(--app-muted)', border: 'none', color: 'var(--app-foreground)',
                }}>
                    <option value="PENDING">Pending</option>
                    <option value="NEEDS_CORRECTION">Needs Correction</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="all">All</option>
                </select>
            </div>

            {/* Correction Modal */}
            {correctionId && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
                }}>
                    <div style={{
                        background: 'var(--app-card)', borderRadius: 16, padding: '2rem',
                        width: '90%', maxWidth: 500, border: '1px solid var(--app-border)',
                    }}>
                        <h3 style={{ margin: '0 0 1rem', color: 'var(--app-foreground)', fontSize: '1.125rem' }}>
                            Request Correction
                        </h3>
                        <textarea
                            value={correctionNotes}
                            onChange={e => setCorrectionNotes(e.target.value)}
                            placeholder="Describe what needs to be corrected..."
                            rows={4}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: 8, fontSize: '0.875rem',
                                background: 'var(--app-muted)', border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)', resize: 'vertical',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setCorrectionId(null); setCorrectionNotes('') }}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.875rem',
                                    background: 'var(--app-muted)', border: 'none', cursor: 'pointer',
                                    color: 'var(--app-foreground)',
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleCorrection}
                                disabled={!correctionNotes.trim()}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.875rem',
                                    background: 'var(--app-warning)', border: 'none', cursor: 'pointer',
                                    color: 'white', fontWeight: 600, opacity: correctionNotes.trim() ? 1 : 0.5,
                                }}
                            >
                                <Send size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Send Correction
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                    Loading approval requests...
                </div>
            ) : filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem', color: 'var(--app-muted-foreground)',
                    background: 'var(--app-card)', borderRadius: 12, border: '1px solid var(--app-border)',
                }}>
                    <ClipboardCheck size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ fontSize: '1rem', margin: 0 }}>
                        {statusFilter === 'PENDING' ? 'No pending requests 🎉' : 'No requests match your filter'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(req => {
                        const typeInfo = REQUEST_TYPE_LABELS[req.request_type] || { label: req.request_type, color: 'var(--app-primary)' }
                        const stInfo = STATUS_STYLE[req.status] || STATUS_STYLE.PENDING
                        const StIcon = stInfo.icon
                        const isExpanded = expanded === req.id

                        return (
                            <div key={req.id} style={{
                                borderRadius: 12, border: '1px solid var(--app-border)',
                                background: 'var(--app-card)', overflow: 'hidden',
                            }}>
                                {/* Row Header */}
                                <div
                                    onClick={() => setExpanded(isExpanded ? null : req.id)}
                                    style={{
                                        padding: '1rem 1.25rem', display: 'flex', alignItems: 'center',
                                        gap: '1rem', cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: 'var(--app-primary)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.875rem', fontWeight: 600, color: 'white',
                                        }}>
                                            {(req.user_name?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--app-foreground)', fontSize: '0.875rem' }}>
                                                {req.user_name} <span style={{ color: 'var(--app-muted-foreground)', fontWeight: 400 }}>({req.user_email})</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)', marginTop: 2 }}>
                                                {req.submitted_data?.company_name && (
                                                    <span>🏢 {req.submitted_data.company_name} · </span>
                                                )}
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <span style={{
                                        padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.7rem',
                                        fontWeight: 500, color: typeInfo.color,
                                        background: `color-mix(in srgb, ${typeInfo.color} 12%, transparent)`,
                                    }}>{typeInfo.label}</span>

                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                        padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.7rem',
                                        fontWeight: 500, color: stInfo.color,
                                        background: `color-mix(in srgb, ${stInfo.color} 12%, transparent)`,
                                    }}>
                                        <StIcon size={12} /> {stInfo.label}
                                    </span>

                                    {/* Actions (only for actionable statuses) */}
                                    {req.status === 'PENDING' && (
                                        <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleApprove(req)}
                                                disabled={processing === req.id}
                                                title="Approve"
                                                style={{
                                                    padding: '0.375rem 0.75rem', borderRadius: 6, border: 'none',
                                                    background: 'var(--app-success)', color: 'white', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                }}
                                            ><CheckCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Approve</button>
                                            <button
                                                onClick={() => setCorrectionId(req.id)}
                                                title="Request Correction"
                                                style={{
                                                    padding: '0.375rem 0.75rem', borderRadius: 6, border: 'none',
                                                    background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)',
                                                    color: 'var(--app-warning)', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                }}
                                            ><MessageSquare size={14} /></button>
                                            <button
                                                onClick={() => handleReject(req)}
                                                title="Reject"
                                                style={{
                                                    padding: '0.375rem 0.75rem', borderRadius: 6, border: 'none',
                                                    background: 'color-mix(in srgb, var(--app-danger) 15%, transparent)',
                                                    color: 'var(--app-danger)', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                }}
                                            ><XCircle size={14} /></button>
                                        </div>
                                    )}

                                    {isExpanded ? <ChevronUp size={16} color="var(--app-muted-foreground)" /> :
                                        <ChevronDown size={16} color="var(--app-muted-foreground)" />}
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--app-border)',
                                        paddingTop: '1rem',
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            {/* Submitted Data */}
                                            <div>
                                                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-muted-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                                    Submitted Data
                                                </h4>
                                                <div style={{
                                                    background: 'var(--app-muted)', borderRadius: 8, padding: '0.75rem',
                                                    fontSize: '0.8rem', color: 'var(--app-foreground)',
                                                }}>
                                                    {Object.entries(req.submitted_data || {}).map(([k, v]) => (
                                                        <div key={k} style={{ marginBottom: '0.25rem' }}>
                                                            <span style={{ color: 'var(--app-muted-foreground)' }}>{k}: </span>
                                                            <span style={{ fontWeight: 500 }}>{String(v)}</span>
                                                        </div>
                                                    ))}
                                                    {Object.keys(req.submitted_data || {}).length === 0 && (
                                                        <span style={{ color: 'var(--app-muted-foreground)' }}>No data submitted</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Review Info */}
                                            <div>
                                                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-muted-foreground)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                                    Review Info
                                                </h4>
                                                <div style={{
                                                    background: 'var(--app-muted)', borderRadius: 8, padding: '0.75rem',
                                                    fontSize: '0.8rem', color: 'var(--app-foreground)',
                                                }}>
                                                    <div><span style={{ color: 'var(--app-muted-foreground)' }}>Linked Contact: </span>{req.contact_name || 'Not linked yet'}</div>
                                                    {req.reviewed_by_name && <div><span style={{ color: 'var(--app-muted-foreground)' }}>Reviewed by: </span>{req.reviewed_by_name}</div>}
                                                    {req.reviewed_at && <div><span style={{ color: 'var(--app-muted-foreground)' }}>Reviewed at: </span>{new Date(req.reviewed_at).toLocaleString()}</div>}
                                                    {req.review_notes && <div style={{ marginTop: '0.5rem' }}><span style={{ color: 'var(--app-muted-foreground)' }}>Notes: </span>{req.review_notes}</div>}
                                                    {req.correction_notes && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: 6, background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)' }}>
                                                            <span style={{ color: 'var(--app-warning)', fontWeight: 600 }}>Correction: </span>{req.correction_notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
