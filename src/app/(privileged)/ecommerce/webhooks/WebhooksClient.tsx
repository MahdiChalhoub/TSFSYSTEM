'use client'

import { useState, useTransition } from 'react'
import { WebhookSubscription, SupportedEvent, createWebhook, updateWebhook, deleteWebhook } from '@/app/actions/ecommerce/webhooks'
import { Webhook as WebhookIcon, Plus, Trash2, ToggleLeft, ToggleRight, Activity, Globe, CheckCircle } from 'lucide-react'

interface Props { initialWebhooks: WebhookSubscription[]; supportedEvents: SupportedEvent[] }

const defaultForm = { event_type: '', target_url: '', description: '', secret: '' }

export default function WebhooksClient({ initialWebhooks, supportedEvents }: Props) {
    const [hooks, setHooks] = useState(initialWebhooks)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(defaultForm)
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleCreate = () => {
        setError('')
        startTransition(async () => {
            const res = await createWebhook({
                event_type: form.event_type,
                target_url: form.target_url,
                description: form.description || undefined,
                secret: form.secret || undefined,
            })
            if (!res.ok) { setError(res.error ?? 'Failed'); return }
            setHooks(prev => [res.webhook!, ...prev])
            setShowModal(false)
            setForm(defaultForm)
        })
    }

    const handleToggle = (id: number, current: boolean) => {
        startTransition(async () => {
            await updateWebhook(id, { is_active: !current })
            setHooks(prev => prev.map(h => h.id === id ? { ...h, is_active: !current } : h))
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm('Delete this webhook?')) return
        startTransition(async () => {
            await deleteWebhook(id)
            setHooks(prev => prev.filter(h => h.id !== id))
        })
    }

    const active = hooks.filter(h => h.is_active).length

    return (
        <div className="app-page">
            {/* Header */}
            <div className="app-page-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-muted-foreground)' }}>
                        <WebhookIcon size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="app-page-title">Webhooks</h1>
                        <p className="app-page-subtitle">HTTP event callbacks for storefront integrations</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="app-btn app-btn-primary flex items-center gap-1.5" id="create-webhook-btn">
                    <Plus size={15} /> Add Webhook
                </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Endpoints', value: hooks.length, icon: Globe, color: 'var(--app-muted-foreground)' },
                    { label: 'Active', value: active, icon: CheckCircle, color: 'var(--app-primary)' },
                    { label: 'Event Types Available', value: supportedEvents.length, icon: Activity, color: 'var(--app-accent-cyan)' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="app-card flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--app-text)]">{value}</p>
                            <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* List */}
            <div className="app-card p-0 overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--app-border)]">
                    <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">
                        {hooks.length} endpoint{hooks.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {hooks.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#64748b18' }}>
                            <WebhookIcon size={22} style={{ color: 'var(--app-muted-foreground)' }} />
                        </div>
                        <p className="font-semibold text-[var(--app-text)]">No webhooks configured</p>
                        <p className="text-xs text-[var(--app-text-muted)]">Add an endpoint to receive storefront events</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--app-border)]">
                        {hooks.map(h => (
                            <div key={h.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--app-surface-hover)] transition-colors">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ background: h.is_active ? '#10b98118' : 'var(--app-surface)' }}>
                                    <Globe size={14} style={{ color: h.is_active ? 'var(--app-primary)' : 'var(--app-text-muted)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-mono text-sm text-[var(--app-text)] truncate">{h.target_url}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        <span className="px-1.5 py-0.5 rounded text-xs bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] font-mono">
                                            {h.event_type_display || h.event_type}
                                        </span>
                                    </div>
                                    {h.description && (
                                        <p className="text-xs text-[var(--app-text-muted)] mt-1">{h.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => handleToggle(h.id, h.is_active)} id={`toggle-hook-${h.id}`}
                                        className="transition-opacity hover:opacity-80">
                                        {h.is_active
                                            ? <ToggleRight size={22} className="text-app-success" />
                                            : <ToggleLeft size={22} className="text-[var(--app-text-muted)]" />}
                                    </button>
                                    <button onClick={() => handleDelete(h.id)} id={`delete-hook-${h.id}`}
                                        className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-app-error hover:bg-rose-500/10 transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="app-card w-full max-w-md space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-muted-foreground)' }}>
                                <Plus size={16} color="#fff" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[var(--app-text)]">Add Webhook</h2>
                                <p className="text-xs text-[var(--app-text-muted)]">HTTP callback endpoint</p>
                            </div>
                        </div>
                        {error && <p className="text-app-error text-sm bg-rose-500/10 px-3 py-2 rounded-lg">{error}</p>}
                        <div className="space-y-3">
                            <div>
                                <label className="app-label">Event Type</label>
                                <select id="hook-event" className="app-input" value={form.event_type}
                                    onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                                    <option value="">Select an event…</option>
                                    {supportedEvents.map(ev => (
                                        <option key={ev.value} value={ev.value}>{ev.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="app-label">Endpoint URL</label>
                                <input id="hook-url" type="url" className="app-input" placeholder="https://your-site.com/hook"
                                    value={form.target_url} onChange={e => setForm(p => ({ ...p, target_url: e.target.value }))} />
                            </div>
                            <div>
                                <label className="app-label">Description (optional)</label>
                                <input id="hook-desc" className="app-input" placeholder="What is this hook for?"
                                    value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div>
                                <label className="app-label">Secret Key (optional)</label>
                                <input id="hook-secret" className="app-input font-mono" placeholder="Used to sign payloads"
                                    value={form.secret} onChange={e => setForm(p => ({ ...p, secret: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setShowModal(false)} className="app-btn app-btn-ghost flex-1">Cancel</button>
                            <button id="hook-submit" onClick={handleCreate} disabled={isPending || !form.event_type || !form.target_url}
                                className="app-btn app-btn-primary flex-1">
                                {isPending ? 'Adding…' : 'Add Webhook'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
