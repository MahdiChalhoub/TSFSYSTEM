'use client'

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    Tag, Plus, Percent, DollarSign, Package, Layers, Calendar,
    History, Edit2, Trash2, X, Check, Power, AlertCircle, ShoppingCart
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    PERCENTAGE: { label: 'Percentage Off', icon: Percent, color: 'text-blue-600 bg-blue-50' },
    FIXED: { label: 'Fixed Amount', icon: DollarSign, color: 'text-green-600 bg-green-50' },
    BUY_X_GET_Y: { label: 'Buy X Get Y', icon: Plus, color: 'text-purple-600 bg-purple-50' },
}

const SCOPE_CONFIG: Record<string, { label: string; icon: any }> = {
    ORDER: { label: 'Entire Order', icon: ShoppingCart },
    PRODUCT: { label: 'Specific Product', icon: Package },
    CATEGORY: { label: 'Category', icon: Layers },
    BRAND: { label: 'Brand', icon: Tag },
}

export default function DiscountRulesPage() {
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [usageRuleId, setUsageRuleId] = useState<number | null>(null)
    const [usageLogs, setUsageLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)

    // Lookup data
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<any[]>([])

    const [form, setForm] = useState({
        name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER',
        value: '0', max_discount: '', min_order_amount: '', min_quantity: '',
        product: '', category: '', brand: '',
        is_active: true, auto_apply: false,
        start_date: '', end_date: '', usage_limit: '', priority: '0'
    })

    useEffect(() => { loadData(); loadLookups() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/discount-rules/')
            setRules(Array.isArray(data) ? data : data.results || [])
        } catch { toast.error("Failed to load discount rules") }
        finally { setLoading(false) }
    }

    async function loadLookups() {
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [p, c, b] = await Promise.all([
                erpFetch('inventory/products/'),
                erpFetch('inventory/categories/'),
                erpFetch('inventory/brands/')
            ])
            setProducts(Array.isArray(p) ? p : p.results || [])
            setCategories(Array.isArray(c) ? c : c.results || [])
            setBrands(Array.isArray(b) ? b : b.results || [])
        } catch (e) { console.error("Lookup load failed", e) }
    }

    async function viewUsage(id: number) {
        setUsageRuleId(id)
        setLoadingLogs(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch(`pos/discount-rules/${id}/usage-log/`)
            setUsageLogs(data)
        } catch { toast.error("Failed to load usage logs") }
        finally { setLoadingLogs(false) }
    }

    async function toggleRule(id: number) {
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`pos/discount-rules/${id}/toggle/`, { method: 'POST' })
            toast.success("Rule status updated")
            await loadData()
        } catch { toast.error("Failed to toggle rule") }
    }

    function startEdit(rule: any) {
        setEditId(rule.id)
        setForm({
            name: rule.name || '',
            code: rule.code || '',
            discount_type: rule.discount_type || 'PERCENTAGE',
            scope: rule.scope || 'ORDER',
            value: String(rule.value || 0),
            max_discount: rule.max_discount ? String(rule.max_discount) : '',
            min_order_amount: rule.min_order_amount ? String(rule.min_order_amount) : '',
            min_quantity: rule.min_quantity ? String(rule.min_quantity) : '',
            product: rule.product ? String(rule.product) : '',
            category: rule.category ? String(rule.category) : '',
            brand: rule.brand ? String(rule.brand) : '',
            is_active: rule.is_active !== false,
            auto_apply: rule.auto_apply === true,
            start_date: rule.start_date || '',
            end_date: rule.end_date || '',
            usage_limit: rule.usage_limit ? String(rule.usage_limit) : '',
            priority: String(rule.priority || 0)
        })
        setShowForm(true)
    }

    function startCreate() {
        setEditId(null)
        setForm({
            name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER',
            value: '0', max_discount: '', min_order_amount: '', min_quantity: '',
            product: '', category: '', brand: '',
            is_active: true, auto_apply: false,
            start_date: '', end_date: '', usage_limit: '', priority: '0'
        })
        setShowForm(true)
    }

    async function handleSave() {
        if (!form.name.trim()) { toast.error("Name is required"); return }
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const payload = {
                ...form,
                value: parseFloat(form.value) || 0,
                max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
                min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
                min_quantity: form.min_quantity ? parseInt(form.min_quantity) : null,
                product: form.scope === 'PRODUCT' ? parseInt(form.product) : null,
                category: form.scope === 'CATEGORY' ? parseInt(form.category) : null,
                brand: form.scope === 'BRAND' ? parseInt(form.brand) : null,
                usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
                priority: parseInt(form.priority) || 0,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
            }

            if (editId) {
                await erpFetch(`pos/discount-rules/${editId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
                toast.success("Discount rule updated")
            } else {
                await erpFetch('pos/discount-rules/', { method: 'POST', body: JSON.stringify(payload) })
                toast.success("Discount rule created")
            }
            setShowForm(false)
            await loadData()
        } catch { toast.error("Failed to save discount rule") }
    }

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    async function handleDelete() {
        if (deleteTarget === null) return
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`pos/discount-rules/${deleteTarget}/`, { method: 'DELETE' })
            toast.success("Discount rule deleted")
            await loadData()
        } catch { toast.error("Failed to delete rule") }
        setDeleteTarget(null)
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <Percent size={20} className="text-white" />
                        </div>
                        Discount & Promotions
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage promotional rules, coupon codes, and automatic discounts</p>
                </div>
                <button onClick={startCreate}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Plus size={16} /> Create Rule
                </button>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-indigo-500">
                    <CardContent className="py-4">
                        <p className="text-xs text-gray-500 uppercase">Active Rules</p>
                        <p className="text-2xl font-bold">{rules.filter(r => r.is_active).length}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="py-4">
                        <p className="text-xs text-gray-500 uppercase">Total Redemptions</p>
                        <p className="text-2xl font-bold">{rules.reduce((s, r) => s + (r.times_used || 0), 0)}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="py-4">
                        <p className="text-xs text-gray-500 uppercase">Auto-Apply Rules</p>
                        <p className="text-2xl font-bold">{rules.filter(r => r.auto_apply).length}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="py-4">
                        <p className="text-xs text-gray-500 uppercase">Scheduled rules</p>
                        <p className="text-2xl font-bold">{rules.filter(r => r.start_date || r.end_date).length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Form */}
            {showForm && (
                <Card className="border-2 border-indigo-200">
                    <CardHeader className="py-3 flex flex-row items-center justify-between border-b">
                        <CardTitle className="text-base">{editId ? 'Edit Discount Rule' : 'New Discount Rule'}</CardTitle>
                        <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-3 gap-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Rule Name *</label>
                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Summer Sale 20% Off" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Promo Code</label>
                                    <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SUMMER20" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Type</label>
                                        <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                                                    <SelectItem key={k} value={k}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Value</label>
                                        <Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Scope & Restrictions */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Scope</label>
                                        <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(SCOPE_CONFIG).map(([k, c]) => (
                                                    <SelectItem key={k} value={k}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Priority</label>
                                        <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
                                    </div>
                                </div>

                                {form.scope === 'PRODUCT' && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Target Product</label>
                                        <Select value={form.product} onValueChange={v => setForm({ ...form, product: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                                            <SelectContent>
                                                {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {form.scope === 'CATEGORY' && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Target Category</label>
                                        <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {form.scope === 'BRAND' && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Target Brand</label>
                                        <Select value={form.brand} onValueChange={v => setForm({ ...form, brand: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                                            <SelectContent>
                                                {brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Min Amount</label>
                                        <Input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} placeholder="Any" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Min Quantity</label>
                                        <Input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} placeholder="Any" />
                                    </div>
                                </div>
                            </div>

                            {/* Limits & Date */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Start Date</label>
                                        <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">End Date</label>
                                        <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Usage Limit</label>
                                    <Input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} placeholder="Infinite" />
                                </div>
                                <div className="flex items-center gap-6 pt-2">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                                        <label htmlFor="is_active" className="text-xs font-bold uppercase text-gray-700">Active</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="auto_apply" checked={form.auto_apply} onChange={e => setForm({ ...form, auto_apply: e.target.checked })} />
                                        <label htmlFor="auto_apply" className="text-xs font-bold uppercase text-gray-700">Auto Apply</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 border-t pt-6">
                            <button onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2">
                                <Check size={16} /> {editId ? 'Update Rule' : 'Save Rule'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rules.map(rule => {
                    const cfg = TYPE_CONFIG[rule.discount_type] || TYPE_CONFIG.PERCENTAGE
                    const scope = SCOPE_CONFIG[rule.scope] || SCOPE_CONFIG.ORDER
                    const Icon = cfg.icon
                    const ScopeIcon = scope.icon
                    const isValid = rule.is_active // Simplified checking on client

                    return (
                        <Card key={rule.id} className={`hover:shadow-lg transition-all border-l-4 ${rule.is_active ? 'border-l-indigo-500' : 'border-l-gray-300 opacity-60'}`}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${cfg.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-900 leading-tight">{rule.name}</h3>
                                            <p className="font-mono text-[10px] text-indigo-500 font-bold uppercase">{rule.code || 'NO CODE'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleRule(rule.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600">
                                            <Power size={14} />
                                        </button>
                                        <button onClick={() => startEdit(rule)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => setDeleteTarget(rule.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Value</span>
                                        <span className="font-bold">
                                            {rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` :
                                                rule.discount_type === 'FIXED' ? fmt(parseFloat(rule.value)) :
                                                    `Buy ${rule.value} Get 1 Free`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Scope</span>
                                        <span className="flex items-center gap-1 font-medium">
                                            <ScopeIcon size={10} className="text-gray-400" />
                                            {scope.label}
                                            {rule.scope === 'PRODUCT' && `: ${rule.product_name}`}
                                            {rule.scope === 'CATEGORY' && `: ${rule.category_name}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Usage</span>
                                        <span className="font-medium text-indigo-600">{rule.times_used} / {rule.usage_limit || '\u221E'}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t flex items-center justify-between">
                                    <div className="flex gap-2">
                                        {rule.auto_apply && (
                                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200">Auto</Badge>
                                        )}
                                        {rule.is_active ? (
                                            <Badge className="bg-green-100 text-green-700 text-[9px]">Active</Badge>
                                        ) : (
                                            <Badge className="bg-gray-100 text-gray-500 text-[9px]">Paused</Badge>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => viewUsage(rule.id)}
                                        className="text-[10px] text-gray-400 hover:text-indigo-600 flex items-center gap-1 font-bold">
                                        <History size={10} /> View Logs
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Usage Sidebar/Modal */}
            {usageRuleId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="w-[500px] bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <History className="text-indigo-600" /> Redemption Logs
                            </h2>
                            <button onClick={() => setUsageRuleId(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                        </div>

                        {loadingLogs ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                            </div>
                        ) : usageLogs.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 italic">No redemptions yet</div>
                        ) : (
                            <div className="space-y-3">
                                {usageLogs.map(log => (
                                    <div key={log.id} className="p-3 border rounded-lg hover:bg-gray-50 flex items-center justify-between group">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">Order #{log.order_ref || log.order}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(log.applied_at).toLocaleString('fr-FR')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-red-600">-{fmt(parseFloat(log.discount_amount))}</p>
                                            <p className="text-[9px] text-gray-400">Applied by: {log.applied_by_name || 'System'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                title="Delete Discount Rule?"
                description="This will permanently remove this discount rule and its usage history."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
