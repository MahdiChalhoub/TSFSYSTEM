'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getContactSummary, getContactPersons, getInteractions, createInteraction, createContactPerson } from "@/app/actions/crm/contacts"
import { ContactSummaryData } from "@/types/erp"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    ArrowLeft, User, Mail, Phone, MapPin, DollarSign,
    ShoppingCart, CreditCard, BookOpen, FileText,
    TrendingUp, Clock, CheckCircle2, AlertCircle,
    Tag, Star, BarChart3, Percent, Hash, UserCircle,
    MessageSquare, PhoneCall, Globe, Eye, Send,
    Users, Briefcase, Plus, X, Award, Target, Zap
} from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-app-surface-2 text-app-muted-foreground',
    PENDING: 'bg-app-warning-bg text-app-warning',
    AUTHORIZED: 'bg-app-info-bg text-app-info',
    COMPLETED: 'bg-app-primary-light text-app-success',
    INVOICED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-app-error-bg text-app-error',
    POSTED: 'bg-app-primary-light text-app-success',
}

const CHANNEL_ICONS: Record<string, any> = {
    CALL: PhoneCall, VISIT: Eye, WHATSAPP: MessageSquare,
    EMAIL: Mail, NOTE: FileText, SMS: Send, OTHER: Globe,
}
const CHANNEL_COLORS: Record<string, string> = {
    CALL: 'var(--app-info)', VISIT: 'var(--app-success)', WHATSAPP: '#25D366',
    EMAIL: 'var(--app-warning)', NOTE: 'var(--app-text-muted)', SMS: '#8B5CF6', OTHER: 'var(--app-text-faint)',
}

type TabKey = 'orders' | 'payments' | 'journal' | 'analytics' | 'pricing' | 'timeline' | 'people' | 'scorecard'

export default function ContactDetailPage() {
    const { fmt } = useCurrency()
    const params = useParams()
    const router = useRouter()
    const [data, setData] = useState<ContactSummaryData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<TabKey>('orders')
    // Timeline & People
    const [interactions, setInteractions] = useState<any[]>([])
    const [people, setPeople] = useState<any[]>([])
    const [showLogModal, setShowLogModal] = useState(false)
    const [showPersonModal, setShowPersonModal] = useState(false)
    const [logSaving, setLogSaving] = useState(false)

    useEffect(() => { if (params.id) loadData() }, [params.id])

    async function loadData() {
        try {
            const result = await getContactSummary(Number(params.id))
            if (result?.error) { setError(result.error); toast.error(`Backend: ${result.error}`) }
            else setData(result)
        } catch (e: any) {
            const msg = e?.message || 'Failed to load'
            setError(msg); toast.error(msg)
        } finally { setLoading(false) }
    }

    async function loadTimeline() {
        const res = await getInteractions(Number(params.id))
        setInteractions(res)
    }
    async function loadPeople() {
        const res = await getContactPersons(Number(params.id))
        setPeople(res)
    }

    useEffect(() => {
        if (activeTab === 'timeline') loadTimeline()
        if (activeTab === 'people') loadPeople()
    }, [activeTab])

    if (loading) {
        return (
            <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                <div style={{ height: '3rem', width: '16rem', borderRadius: '0.5rem', background: 'var(--app-surface-2)', marginBottom: '1rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="app-card" style={{ height: '7rem' }} />)}
                </div>
                <div className="app-card" style={{ height: '20rem' }} />
            </div>
        )
    }
    if (!data?.contact) {
        return (
            <div className="app-page" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, color: 'var(--app-text-muted)' }} />
                <p style={{ color: 'var(--app-text-muted)' }}>Contact not found</p>
                {error && <p style={{ fontSize: '0.75rem', color: 'var(--app-error)', marginTop: '0.5rem' }}>{error}</p>}
                <Button variant="outline" className="mt-4" onClick={() => router.push('/crm/contacts')}>
                    <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
            </div>
        )
    }

    const { contact, orders, payments, balance, journal_entries, analytics, pricing_rules } = data
    const isCustomer = contact.type === 'CUSTOMER' || contact.type === 'BOTH'
    const isSupplier = contact.type === 'SUPPLIER' || contact.type === 'BOTH'
    const typeLabel = contact.type === 'BOTH' ? 'Client + Supplier' : contact.type === 'CUSTOMER' ? 'Customer' : contact.type === 'SUPPLIER' ? 'Supplier' : contact.type
    const typeColor = isCustomer ? 'var(--app-success)' : isSupplier ? 'var(--app-info)' : 'var(--app-primary)'
    const typeBg = isCustomer ? 'var(--app-success-bg, rgba(16,185,129,0.08))' : isSupplier ? 'var(--app-info-bg, rgba(59,130,246,0.08))' : 'var(--app-primary-light)'
    const initials = (contact.name || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

    const allTabs: { key: TabKey; label: string; icon: any }[] = [
        { key: 'orders', label: isCustomer ? 'Sales' : 'Purchases', icon: ShoppingCart },
        { key: 'payments', label: 'Payments', icon: CreditCard },
        { key: 'journal', label: 'Ledger', icon: BookOpen },
        { key: 'timeline', label: 'Timeline', icon: MessageSquare },
        { key: 'people', label: 'People', icon: Users },
        { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        { key: 'pricing', label: `Pricing (${(pricing_rules || []).length})`, icon: Tag },
    ]
    if (isSupplier) allTabs.push({ key: 'scorecard', label: 'Scorecard', icon: Award })

    async function handleLogInteraction(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLogSaving(true)
        const fd = new FormData(e.currentTarget)
        const res = await createInteraction({
            contact: Number(params.id),
            channel: fd.get('channel'),
            direction: fd.get('direction') || 'OUTBOUND',
            summary: fd.get('summary'),
            outcome: fd.get('outcome') || 'NEUTRAL',
            interaction_at: new Date().toISOString(),
        })
        setLogSaving(false)
        if (res?.error) { toast.error(res.error); return }
        toast.success('Interaction logged')
        setShowLogModal(false)
        loadTimeline()
    }

    async function handleAddPerson(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await createContactPerson({
            contact: Number(params.id),
            name: fd.get('name'),
            role: fd.get('role'),
            email: fd.get('email') || '',
            phone: fd.get('phone') || '',
            is_primary: fd.get('is_primary') === 'on',
        })
        if (res?.error) { toast.error(res.error); return }
        toast.success('Person added')
        setShowPersonModal(false)
        loadPeople()
    }

    /* shared styles */
    const modalOverlay: React.CSSProperties = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }
    const modalBox: React.CSSProperties = {
        background: 'var(--app-surface)', borderRadius: 'var(--app-radius)', width: '100%', maxWidth: '28rem',
        border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
    }
    const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[var(--app-bg)] border border-[var(--app-border)] text-sm font-medium text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]"
    const lblCls = "block text-[0.5625rem] font-bold uppercase tracking-wide text-[var(--app-text-faint)] mb-1"

    return (
        <div className="app-page" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
            {/* ── Header ── */}
            <header className="fade-in-up" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: 'clamp(1rem, 2vw, 1.5rem)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <button onClick={() => router.push('/crm/contacts')} style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-surface)', border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--app-text-muted)', flexShrink: 0 }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div style={{ width: '3.25rem', height: '3.25rem', borderRadius: '1rem', background: `linear-gradient(135deg, ${typeColor}, ${typeColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${typeColor}30`, flexShrink: 0, fontSize: '1.125rem', fontWeight: 800, color: '#fff' }}>
                        {initials || <User size={22} />}
                    </div>
                    <div>
                        <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>{contact.name}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ padding: '0.125rem 0.5rem', borderRadius: '99px', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: typeBg, color: typeColor }}>{typeLabel}</span>
                            {contact.customer_tier && contact.customer_tier !== 'STANDARD' && (
                                <span style={{ padding: '0.125rem 0.4375rem', borderRadius: '99px', fontSize: '0.5625rem', fontWeight: 700, background: contact.customer_tier === 'VIP' ? '#FEF3C7' : 'var(--app-surface-2)', color: contact.customer_tier === 'VIP' ? '#B45309' : 'var(--app-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.125rem' }}>
                                    {contact.customer_tier === 'VIP' && <Star size={8} style={{ fill: '#EAB308', color: '#EAB308' }} />}{contact.customer_tier}
                                </span>
                            )}
                            {contact.company_name && <span style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)' }}>{contact.company_name}</span>}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button onClick={() => { setActiveTab('timeline'); setShowLogModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4375rem 0.75rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--app-surface)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)', cursor: 'pointer' }}>
                        <MessageSquare size={13} /> Log
                    </button>
                    <button onClick={() => router.push(`/crm/contacts/${params.id}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4375rem 0.875rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.75rem', fontWeight: 700, background: 'var(--app-primary)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        <FileText size={13} /> Edit
                    </button>
                </div>
            </header>

            {/* ── Info Cards ── */}
            <div className="grid gap-3 fade-in-up" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', animationDelay: '40ms', marginBottom: 'clamp(0.75rem, 2vw, 1.25rem)' }}>
                {/* Contact Info */}
                <div className="app-card" style={{ padding: '1.125rem 1.25rem' }}>
                    <h3 style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-muted)', marginBottom: '0.75rem' }}>Contact Info</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {contact.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--app-text)' }}><Mail size={13} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} /><span>{contact.email}</span></div>}
                        {contact.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--app-text)' }}><Phone size={13} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} /><span>{contact.phone}</span></div>}
                        {contact.address && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--app-text)' }}><MapPin size={13} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} /><span>{contact.address}</span></div>}
                        {(contact.credit_limit ?? 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}><CreditCard size={13} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} /><span>Credit: <strong>{fmt(contact.credit_limit ?? 0)}</strong></span></div>}
                        {(contact.loyalty_points ?? 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}><Star size={13} style={{ color: '#EAB308', flexShrink: 0 }} /><span style={{ fontWeight: 700, color: '#B45309' }}>{contact.loyalty_points} pts</span></div>}
                        {contact.vat_id && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}><Hash size={13} style={{ color: 'var(--app-text-faint)', flexShrink: 0 }} /><span>VAT: <strong>{contact.vat_id}</strong></span></div>}
                        {!contact.email && !contact.phone && !contact.address && <p style={{ fontSize: '0.8125rem', color: 'var(--app-text-faint)', fontStyle: 'italic' }}>No contact info</p>}
                    </div>
                </div>

                {/* Balance */}
                <div className="app-card" style={{ padding: '1.125rem 1.25rem', position: 'relative', overflow: 'hidden', borderLeft: `3px solid ${balance.current_balance > 0 ? 'var(--app-error)' : 'var(--app-success)'}` }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '5rem', height: '5rem', background: balance.current_balance > 0 ? 'var(--app-error)' : 'var(--app-success)', opacity: 0.04, borderRadius: '0 0 0 100%' }} />
                    <h3 style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-muted)', marginBottom: '0.5rem' }}>{isCustomer ? 'Amount Owed to You' : 'Amount You Owe'}</h3>
                    <p style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, letterSpacing: '-0.03em', color: balance.current_balance > 0 ? 'var(--app-error)' : 'var(--app-success)', lineHeight: 1.1 }}>{fmt(Math.abs(balance.current_balance))}</p>
                    {balance.last_payment_date && <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-faint)', marginTop: '0.5rem' }}>Last payment: {balance.last_payment_date}</p>}
                </div>

                {/* Stats */}
                <div className="app-card" style={{ padding: '1.125rem 1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)', marginBottom: '0.125rem' }}>Total Orders</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{orders.stats.total_count}</p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>{fmt(orders.stats.total_amount)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)', marginBottom: '0.125rem' }}>Total Paid</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--app-text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{payments.stats.payment_count}</p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>{fmt(payments.stats.total_paid)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)', marginBottom: '0.125rem' }}>Completed</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--app-success)', lineHeight: 1.1 }}>{orders.stats.completed}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)', marginBottom: '0.125rem' }}>Draft</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--app-warning)', lineHeight: 1.1 }}>{orders.stats.draft}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="app-card fade-in-up" style={{ overflow: 'hidden', borderRadius: 'var(--app-radius)', animationDelay: '80ms' }}>
                <div style={{ display: 'flex', overflowX: 'auto', gap: 0, borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }} className="hide-scrollbar">
                    {allTabs.map(({ key, label, icon: Icon }) => {
                        const active = activeTab === key
                        return (
                            <button key={key} onClick={() => setActiveTab(key)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: active ? 700 : 500, color: active ? 'var(--app-primary)' : 'var(--app-text-muted)', borderBottom: active ? '2px solid var(--app-primary)' : '2px solid transparent', background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                                <Icon size={14} />{label}
                            </button>
                        )
                    })}
                </div>

                <div>
                    {/* ── Orders Tab ── */}
                    {activeTab === 'orders' && (orders.recent.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--app-text-faint)' }}><ShoppingCart size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} /><p>No orders</p></div>
                    ) : (
                        <Table><TableHeader><TableRow className="bg-app-surface-2/50"><TableHead>Order</TableHead><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Tax</TableHead><TableHead>Payment</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                            <TableBody>{orders.recent.map((o: any) => (<TableRow key={o.id} className="hover:bg-app-surface-2/50"><TableCell className="font-mono text-sm">{o.ref_code || `ORD-${o.id}`}</TableCell><TableCell className="text-sm text-app-muted-foreground">{o.invoice_number || '—'}</TableCell><TableCell><Badge className={STATUS_COLORS[o.status] || 'bg-app-surface-2'}>{o.status}</Badge></TableCell><TableCell className="text-right font-semibold">{fmt(o.total_amount)}</TableCell><TableCell className="text-right text-sm text-app-muted-foreground">{fmt(o.tax_amount)}</TableCell><TableCell className="text-sm">{o.payment_method}</TableCell><TableCell className="text-sm text-app-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</TableCell></TableRow>))}</TableBody></Table>
                    ))}

                    {/* ── Payments Tab ── */}
                    {activeTab === 'payments' && (payments.recent.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--app-text-faint)' }}><CreditCard size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} /><p>No payments</p></div>
                    ) : (
                        <Table><TableHeader><TableRow className="bg-app-surface-2/50"><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Description</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                            <TableBody>{payments.recent.map((p: any) => (<TableRow key={p.id} className="hover:bg-app-surface-2/50"><TableCell className="font-mono text-sm">{p.reference || `PAY-${p.id}`}</TableCell><TableCell className="text-right font-semibold">{fmt(p.amount)}</TableCell><TableCell className="text-sm">{p.method}</TableCell><TableCell><Badge className={STATUS_COLORS[p.status] || 'bg-app-surface-2'}>{p.status}</Badge></TableCell><TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">{p.description || '—'}</TableCell><TableCell className="text-sm text-app-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</TableCell></TableRow>))}</TableBody></Table>
                    ))}

                    {/* ── Journal Tab ── */}
                    {activeTab === 'journal' && (journal_entries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--app-text-faint)' }}><BookOpen size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} /><p>No journal entries</p></div>
                    ) : (
                        <Table><TableHeader><TableRow className="bg-app-surface-2/50"><TableHead>Reference</TableHead><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                            <TableBody>{journal_entries.map((j: any, i: number) => (<TableRow key={i} className="hover:bg-app-surface-2/50"><TableCell className="font-mono text-sm">{j.reference || `JE-${j.id}`}</TableCell><TableCell className="text-sm">{j.account || '—'}</TableCell><TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">{j.description || '—'}</TableCell><TableCell className="text-right font-semibold text-app-error">{j.debit > 0 ? fmt(j.debit) : '—'}</TableCell><TableCell className="text-right font-semibold text-app-primary">{j.credit > 0 ? fmt(j.credit) : '—'}</TableCell><TableCell className="text-sm text-app-muted-foreground">{j.date || '—'}</TableCell></TableRow>))}</TableBody></Table>
                    ))}

                    {/* ── Timeline Tab ── */}
                    {activeTab === 'timeline' && (
                        <div style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--app-text)' }}>Interaction History</h3>
                                <button onClick={() => setShowLogModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--app-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    <Plus size={12} /> Log Interaction
                                </button>
                            </div>
                            {interactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--app-text-faint)' }}>
                                    <MessageSquare size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '0.875rem' }}>No interactions logged yet</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click "Log Interaction" to record a call, visit, or note</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {interactions.map((int: any) => {
                                        const ChIcon = CHANNEL_ICONS[int.channel] || Globe
                                        const chColor = CHANNEL_COLORS[int.channel] || 'var(--app-text-faint)'
                                        return (
                                            <div key={int.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                                <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: `${chColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <ChIcon size={14} style={{ color: chColor }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.125rem' }}>
                                                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: chColor, textTransform: 'uppercase' }}>{int.channel}</span>
                                                        <span style={{ fontSize: '0.5625rem', color: 'var(--app-text-faint)' }}>{int.direction}</span>
                                                        <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--app-text-faint)' }}>
                                                            {int.interaction_at ? new Date(int.interaction_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '0.8125rem', color: 'var(--app-text)' }}>{int.summary || '—'}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── People Tab ── */}
                    {activeTab === 'people' && (
                        <div style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--app-text)' }}>Contact Book</h3>
                                <button onClick={() => setShowPersonModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--app-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    <Plus size={12} /> Add Person
                                </button>
                            </div>
                            {people.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--app-text-faint)' }}>
                                    <Users size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '0.875rem' }}>No people associated</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Add key contacts like CEO, accountant, or sales rep</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem' }}>
                                    {people.map((p: any) => (
                                        <div key={p.id} style={{ padding: '0.875rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-bg)', border: '1px solid var(--app-border)', display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                                            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', background: 'var(--app-primary)12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--app-primary)', flexShrink: 0 }}>
                                                {(p.name || '?')[0].toUpperCase()}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--app-text)' }}>{p.name}</p>
                                                <p style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--app-primary)', textTransform: 'uppercase' }}>{p.role}</p>
                                                {p.email && <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</p>}
                                                {p.phone && <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)' }}>{p.phone}</p>}
                                                {p.is_primary && <span style={{ fontSize: '0.5rem', fontWeight: 700, background: 'var(--app-success-bg)', color: 'var(--app-success)', padding: '0.0625rem 0.25rem', borderRadius: '99px', textTransform: 'uppercase' }}>Primary</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Analytics Tab ── */}
                    {activeTab === 'analytics' && (
                        <div style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
                                {[
                                    { label: 'Avg Order Value', value: fmt(analytics?.avg_order_value || 0), color: 'var(--app-info)' },
                                    { label: 'Monthly Frequency', value: `${analytics?.monthly_frequency || 0}/mo`, color: 'var(--app-success)' },
                                    { label: 'Total Revenue', value: fmt(analytics?.total_revenue || 0), color: '#8B5CF6' },
                                ].map((m, i) => (
                                    <div key={i} style={{ padding: '0.875rem', borderRadius: 'var(--app-radius-sm)', background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
                                        <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', color: m.color }}>{m.label}</p>
                                        <p style={{ fontSize: '1.375rem', fontWeight: 800, color: m.color, marginTop: '0.125rem' }}>{m.value}</p>
                                    </div>
                                ))}
                            </div>
                            <h3 style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--app-text-faint)', marginBottom: '0.5rem' }}>Top Products</h3>
                            {(analytics?.top_products || []).length === 0 ? <p style={{ fontSize: '0.8125rem', color: 'var(--app-text-faint)' }}>No product data yet</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    {analytics?.top_products?.map((p: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-bg)' }}>
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--app-text-faint)', width: '1.25rem' }}>#{i + 1}</span>
                                            <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--app-text)' }}>{p.product_name}</span>
                                            <span style={{ fontSize: '0.6875rem', color: 'var(--app-text-faint)' }}>Qty: {p.total_qty}</span>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{fmt(p.total_revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Pricing Tab ── */}
                    {activeTab === 'pricing' && (
                        <div style={{ padding: '1.25rem' }}>
                            {(pricing_rules || []).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--app-text-faint)' }}><Tag size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.2 }} /><p>No pricing rules</p></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {(pricing_rules ?? []).map((rule: any) => (
                                        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--app-radius-sm)', background: 'var(--app-bg)' }}>
                                            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: rule.discount_type === 'PERCENTAGE' ? 'var(--app-info-bg)' : 'var(--app-primary-light)', color: rule.discount_type === 'PERCENTAGE' ? 'var(--app-info)' : 'var(--app-primary)' }}>
                                                {rule.discount_type === 'PERCENTAGE' ? <Percent size={16} /> : <DollarSign size={16} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                    <Badge className={rule.discount_type === 'PERCENTAGE' ? 'bg-app-info-bg text-app-info' : 'bg-app-primary-light text-app-success'}>{rule.discount_type === 'PERCENTAGE' ? '% Discount' : rule.discount_type === 'FIXED_PRICE' ? 'Fixed Price' : 'Amount Off'}</Badge>
                                                    <span style={{ fontWeight: 700 }}>{rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` : fmt(parseFloat(rule.value))}</span>
                                                </div>
                                                <p style={{ fontSize: '0.6875rem', color: 'var(--app-text-muted)', marginTop: '0.125rem' }}>{rule.product_name || rule.category_name || 'All products'}{rule.group_name && ` · via ${rule.group_name}`}{rule.min_quantity > 1 && ` · min: ${rule.min_quantity}`}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Scorecard Tab (Supplier) ── */}
                    {activeTab === 'scorecard' && (
                        <div style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.625rem' }}>
                                {[
                                    { label: 'Objective Score', value: contact.objective_score ?? '—', desc: 'On-time delivery rate', icon: Target, color: 'var(--app-info)' },
                                    { label: 'Subjective Score', value: contact.subjective_score ?? '—', desc: 'Manual ratings avg', icon: Star, color: 'var(--app-warning)' },
                                    { label: 'Composite Score', value: contact.composite_score ?? '—', desc: '50% obj + 50% subj', icon: Zap, color: 'var(--app-primary)' },
                                    { label: 'Lead Time (avg)', value: contact.avg_lead_time_days ? `${contact.avg_lead_time_days}d` : '—', desc: 'Average delivery days', icon: Clock, color: 'var(--app-success)' },
                                    { label: 'Total POs', value: contact.supplier_total_orders ?? 0, desc: 'Purchase orders placed', icon: ShoppingCart, color: '#8B5CF6' },
                                    { label: 'On-Time Rate', value: contact.on_time_deliveries && contact.supplier_total_orders ? `${Math.round(contact.on_time_deliveries / contact.supplier_total_orders * 100)}%` : '—', desc: 'Deliveries on schedule', icon: CheckCircle2, color: 'var(--app-success)' },
                                ].map((m, i) => (
                                    <div key={i} style={{ padding: '1rem', borderRadius: 'var(--app-radius-sm)', background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                                            <m.icon size={14} style={{ color: m.color }} />
                                            <span style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: m.color }}>{m.label}</span>
                                        </div>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color, lineHeight: 1.1 }}>{m.value}</p>
                                        <p style={{ fontSize: '0.625rem', color: 'var(--app-text-faint)', marginTop: '0.25rem' }}>{m.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Log Interaction Modal ── */}
            {showLogModal && (
                <div style={modalOverlay} onClick={() => setShowLogModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--app-text)' }}>Log Interaction</h2>
                            <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleLogInteraction} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            <div>
                                <label className={lblCls}>Channel *</label>
                                <select name="channel" className={inputCls} required>
                                    <option value="CALL">📞 Call</option>
                                    <option value="VISIT">👁 Visit</option>
                                    <option value="WHATSAPP">💬 WhatsApp</option>
                                    <option value="EMAIL">📧 Email</option>
                                    <option value="NOTE">📝 Note</option>
                                    <option value="SMS">📱 SMS</option>
                                </select>
                            </div>
                            <div>
                                <label className={lblCls}>Direction</label>
                                <select name="direction" className={inputCls}>
                                    <option value="OUTBOUND">Outbound (we contacted them)</option>
                                    <option value="INBOUND">Inbound (they contacted us)</option>
                                </select>
                            </div>
                            <div>
                                <label className={lblCls}>Summary *</label>
                                <textarea name="summary" className={inputCls} rows={3} required placeholder="What happened?" style={{ resize: 'none' }} />
                            </div>
                            <div>
                                <label className={lblCls}>Outcome</label>
                                <select name="outcome" className={inputCls}>
                                    <option value="POSITIVE">Positive</option>
                                    <option value="NEUTRAL">Neutral</option>
                                    <option value="NEGATIVE">Negative</option>
                                    <option value="FOLLOW_UP">Needs Follow-up</option>
                                </select>
                            </div>
                            <button type="submit" disabled={logSaving} style={{ padding: '0.625rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--app-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: logSaving ? 0.6 : 1 }}>
                                {logSaving ? 'Saving...' : 'Save Interaction'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Add Person Modal ── */}
            {showPersonModal && (
                <div style={modalOverlay} onClick={() => setShowPersonModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--app-text)' }}>Add Person</h2>
                            <button onClick={() => setShowPersonModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddPerson} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            <div><label className={lblCls}>Name *</label><input name="name" className={inputCls} required placeholder="John Doe" /></div>
                            <div><label className={lblCls}>Role *</label>
                                <select name="role" className={inputCls} required>
                                    <option value="CEO">CEO / Director</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                    <option value="SALES_REP">Sales Representative</option>
                                    <option value="PURCHASER">Purchaser</option>
                                    <option value="LOGISTICS">Logistics</option>
                                    <option value="TECHNICAL">Technical</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                                <div><label className={lblCls}>Email</label><input name="email" type="email" className={inputCls} placeholder="email@co.com" /></div>
                                <div><label className={lblCls}>Phone</label><input name="phone" className={inputCls} placeholder="+1..." /></div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--app-text-muted)' }}>
                                <input type="checkbox" name="is_primary" /> Primary contact
                            </label>
                            <button type="submit" style={{ padding: '0.625rem', borderRadius: 'var(--app-radius-sm)', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--app-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                Add Person
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
