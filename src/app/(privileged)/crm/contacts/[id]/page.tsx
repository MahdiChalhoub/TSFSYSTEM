'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getContactSummary } from "@/app/actions/crm/contacts"
import { ContactSummaryData } from "@/types/erp"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ArrowLeft, User, Mail, Phone, MapPin, DollarSign,
    ShoppingCart, CreditCard, BookOpen, FileText,
    TrendingUp, Clock, CheckCircle2, AlertCircle,
    Tag, Star, BarChart3, Percent, Hash
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-app-surface-2 text-app-foreground',
    PENDING: 'bg-app-warning-bg text-app-warning',
    AUTHORIZED: 'bg-app-info-bg text-app-info',
    COMPLETED: 'bg-app-success-bg text-app-success',
    INVOICED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-app-error-bg text-app-error',
    POSTED: 'bg-app-success-bg text-app-success',
}

export default function ContactDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [data, setData] = useState<ContactSummaryData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'journal' | 'analytics' | 'pricing'>('orders')

    useEffect(() => {
        if (params.id) loadData()
    }, [params.id])

    async function loadData() {
        try {
            const result = await getContactSummary(Number(params.id))
            setData(result)
        } catch {
            toast.error("Failed to load contact details")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    if (!data?.contact) {
        return (
            <div className="p-6 text-center py-20">
                <AlertCircle size={48} className="mx-auto mb-4 text-app-faint" />
                <p className="text-app-muted-foreground">Contact not found</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/crm/contacts')}>
                    <ArrowLeft size={16} className="mr-2" /> Back to Contacts
                </Button>
            </div>
        )
    }

    const { contact, orders, payments, balance, journal_entries, analytics, pricing_rules } = data
    const isCustomer = contact.type === 'CUSTOMER'

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/crm/contacts')}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${isCustomer ? 'bg-app-primary shadow-emerald-100' : 'bg-app-info shadow-blue-100'
                                }`}>
                                <User size={24} />
                            </div>
                            <div>
                                <h1>{contact.name}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className={isCustomer ? 'bg-app-success-bg text-app-success' : 'bg-app-info-bg text-app-info'}>
                                        {contact.type}
                                    </Badge>
                                    {contact.supplier_category && contact.supplier_category !== 'REGULAR' && (
                                        <Badge className={contact.supplier_category === 'DEPOT_VENTE' ? 'bg-purple-100 text-purple-700' : 'bg-app-warning-bg text-app-warning'}>
                                            {contact.supplier_category === 'DEPOT_VENTE' ? 'Consignment' : 'Mixed'}
                                        </Badge>
                                    )}
                                    {contact.customer_tier && contact.customer_tier !== 'STANDARD' && (
                                        <Badge className={contact.customer_tier === 'VIP' ? 'bg-app-warning-bg text-app-warning' : 'bg-app-info-soft text-app-info'}>
                                            {contact.customer_tier === 'VIP' && '⭐ '}{contact.customer_tier}
                                        </Badge>
                                    )}
                                    {contact.vat_id && (
                                        <span className="text-xs text-app-muted-foreground">VAT: {contact.vat_id}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Contact Info + Balance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Contact Info */}
                <Card>
                    <CardContent className="py-4 space-y-3">
                        <h3 className="text-app-muted-foreground uppercase">Contact Info</h3>
                        {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                                <Mail size={14} className="text-app-muted-foreground" />
                                <span>{contact.email}</span>
                            </div>
                        )}
                        {contact.phone && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone size={14} className="text-app-muted-foreground" />
                                <span>{contact.phone}</span>
                            </div>
                        )}
                        {contact.address && (
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin size={14} className="text-app-muted-foreground" />
                                <span className="line-clamp-2">{contact.address}</span>
                            </div>
                        )}
                        {(contact.credit_limit ?? 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <CreditCard size={14} className="text-app-muted-foreground" />
                                <span>Credit Limit: {fmt(contact.credit_limit ?? 0)}</span>
                            </div>
                        )}
                        {(contact.payment_terms_days ?? 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <Clock size={14} className="text-app-muted-foreground" />
                                <span>Payment Terms: {contact.payment_terms_days} days</span>
                            </div>
                        )}
                        {(contact.loyalty_points ?? 0) > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <Star size={14} className="text-app-warning" />
                                <span className="font-semibold text-app-warning">{contact.loyalty_points} loyalty points</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Balance */}
                <Card className={`border-l-4 ${balance.current_balance > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
                    <CardContent className="py-4">
                        <h3 className="text-app-muted-foreground uppercase mb-2">
                            {isCustomer ? 'Amount Owed to You' : 'Amount You Owe'}
                        </h3>
                        <p className={`text-3xl font-bold ${balance.current_balance > 0 ? 'text-app-error' : 'text-app-success'}`}>
                            {fmt(Math.abs(balance.current_balance))}
                        </p>
                        {balance.last_payment_date && (
                            <p className="text-xs text-app-muted-foreground mt-2">
                                Last payment: {balance.last_payment_date}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Stats */}
                <Card>
                    <CardContent className="py-4 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-app-muted-foreground uppercase">Total Orders</p>
                            <p className="text-2xl font-bold text-app-foreground">{orders.stats.total_count}</p>
                            <p className="text-xs text-app-muted-foreground">{fmt(orders.stats.total_amount)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-app-muted-foreground uppercase">Total Paid</p>
                            <p className="text-2xl font-bold text-app-foreground">{payments.stats.payment_count}</p>
                            <p className="text-xs text-app-muted-foreground">{fmt(payments.stats.total_paid)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-app-muted-foreground uppercase">Completed</p>
                            <p className="text-lg font-semibold text-app-success">{orders.stats.completed}</p>
                        </div>
                        <div>
                            <p className="text-xs text-app-muted-foreground uppercase">Draft</p>
                            <p className="text-lg font-semibold text-app-warning">{orders.stats.draft}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
                {[
                    { key: 'orders' as const, label: isCustomer ? 'Sales Orders' : 'Purchase Orders', icon: ShoppingCart },
                    { key: 'payments' as const, label: 'Payments', icon: CreditCard },
                    { key: 'journal' as const, label: 'Journal Entries', icon: BookOpen },
                    { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
                    { key: 'pricing' as const, label: `Pricing (${(pricing_rules || []).length})`, icon: Tag },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === key
                            ? 'border-blue-600 text-app-info'
                            : 'border-transparent text-app-muted-foreground hover:text-app-foreground'
                            }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <Card>
                <CardContent className="p-0">
                    {activeTab === 'orders' && (
                        orders.recent.length === 0 ? (
                            <div className="text-center py-12 text-app-muted-foreground">
                                <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                                <p>No orders found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-app-surface/50">
                                        <TableHead>Order</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Tax</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.recent.map((o: Record<string, any>) => (
                                        <TableRow key={o.id} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-sm">
                                                {o.ref_code || `ORD-${o.id}`}
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">
                                                {o.invoice_number || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[o.status] || 'bg-app-surface-2'}>
                                                    {o.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {fmt(o.total_amount)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-app-muted-foreground">
                                                {fmt(o.tax_amount)}
                                            </TableCell>
                                            <TableCell className="text-sm">{o.payment_method}</TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">
                                                {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )
                    )}

                    {activeTab === 'payments' && (
                        payments.recent.length === 0 ? (
                            <div className="text-center py-12 text-app-muted-foreground">
                                <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
                                <p>No payments recorded</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-app-surface/50">
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.recent.map((p: Record<string, any>) => (
                                        <TableRow key={p.id} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-sm">
                                                {p.reference || `PAY-${p.id}`}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {fmt(p.amount)}
                                            </TableCell>
                                            <TableCell className="text-sm">{p.method}</TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[p.status] || 'bg-app-surface-2'}>
                                                    {p.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">
                                                {p.description || '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">
                                                {p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )
                    )}

                    {activeTab === 'journal' && (
                        journal_entries.length === 0 ? (
                            <div className="text-center py-12 text-app-muted-foreground">
                                <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                                <p>No journal entries</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-app-surface/50">
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {journal_entries.map((j: Record<string, any>, idx: number) => (
                                        <TableRow key={idx} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-sm">
                                                {j.reference || `JE-${j.id}`}
                                            </TableCell>
                                            <TableCell className="text-sm">{j.account || '—'}</TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">
                                                {j.description || '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-app-error">
                                                {j.debit > 0 ? fmt(j.debit) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-app-success">
                                                {j.credit > 0 ? fmt(j.credit) : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">{j.date || '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )
                    )}

                    {/* Analytics Tab */}
                    {activeTab === 'analytics' && (
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-app-info-bg rounded-xl p-4">
                                    <p className="text-xs font-bold text-app-info uppercase">Avg Order Value</p>
                                    <p className="text-2xl font-bold text-app-info">{fmt(analytics?.avg_order_value || 0)}</p>
                                </div>
                                <div className="bg-app-success-bg rounded-xl p-4">
                                    <p className="text-xs font-bold text-app-success uppercase">Monthly Frequency</p>
                                    <p className="text-2xl font-bold text-app-success">{analytics?.monthly_frequency || 0} orders/mo</p>
                                </div>
                                <div className="bg-purple-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-purple-600 uppercase">Total Revenue</p>
                                    <p className="text-2xl font-bold text-purple-900">{fmt(analytics?.total_revenue || 0)}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-app-muted-foreground uppercase mb-3">Top Products</h3>
                                {(analytics?.top_products || []).length === 0 ? (
                                    <p className="text-app-muted-foreground text-sm">No product data available yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {analytics?.top_products?.map((p: Record<string, any>, i: number) => (
                                            <div key={i} className="flex items-center gap-3 bg-app-surface rounded-xl p-3">
                                                <span className="text-xs font-bold text-app-muted-foreground w-6">#{i + 1}</span>
                                                <span className="flex-1 font-medium text-sm text-app-foreground">{p.product_name}</span>
                                                <span className="text-xs text-app-muted-foreground">Qty: {p.total_qty}</span>
                                                <span className="font-semibold text-sm">{fmt(p.total_revenue)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pricing Rules Tab */}
                    {activeTab === 'pricing' && (
                        <div className="p-6">
                            {(pricing_rules || []).length === 0 ? (
                                <div className="text-center py-12 text-app-muted-foreground">
                                    <Tag size={48} className="mx-auto mb-3 opacity-30" />
                                    <p>No pricing rules for this contact</p>
                                    <p className="text-xs mt-1">Create rules from the Client Pricing page</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(pricing_rules ?? []).map((rule: Record<string, any>) => (
                                        <div key={rule.id} className="flex items-center gap-4 bg-app-surface rounded-xl p-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${rule.discount_type === 'FIXED_PRICE' ? 'bg-app-success-bg text-app-success' :
                                                rule.discount_type === 'PERCENTAGE' ? 'bg-app-info-bg text-app-info' : 'bg-app-warning-bg text-app-warning'
                                                }`}>
                                                {rule.discount_type === 'PERCENTAGE' ? <Percent size={18} /> :
                                                    rule.discount_type === 'AMOUNT_OFF' ? <Hash size={18} /> : <DollarSign size={18} />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge className={
                                                        rule.discount_type === 'FIXED_PRICE' ? 'bg-app-success-bg text-app-success' :
                                                            rule.discount_type === 'PERCENTAGE' ? 'bg-app-info-bg text-app-info' : 'bg-app-warning-bg text-app-warning'
                                                    }>
                                                        {rule.discount_type === 'FIXED_PRICE' ? 'Fixed Price' :
                                                            rule.discount_type === 'PERCENTAGE' ? '% Discount' : 'Amount Off'}
                                                    </Badge>
                                                    <span className="font-bold">
                                                        {rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` : fmt(parseFloat(rule.value))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-app-muted-foreground mt-1">
                                                    {rule.product_name || rule.category_name || 'All products'}
                                                    {rule.group_name && ` · via ${rule.group_name}`}
                                                    {rule.min_quantity > 1 && ` · min qty: ${rule.min_quantity}`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
