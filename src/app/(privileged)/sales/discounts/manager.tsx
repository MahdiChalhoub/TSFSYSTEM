'use client'

import { useState } from 'react'
import {
    Percent, Tag, Plus, Trash2, ToggleLeft, ToggleRight, ShoppingCart,
    Layers, Gift, Clock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    createDiscountRule, deleteDiscountRule, toggleDiscountRule, getDiscountUsageLog
} from '@/app/actions/discounts'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface DiscountRule {
    id: number; name: string; code: string | null
    discount_type: string; scope: string; value: number
    max_discount: number | null; min_order_amount: number | null; min_quantity: number | null
    product_name: string | null; category_name: string | null; brand_name: string | null
    is_active: boolean; auto_apply: boolean
    start_date: string | null; end_date: string | null
    usage_limit: number | null; times_used: number; priority: number
    created_by_name: string | null; created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    PERCENTAGE: { label: 'Percentage', icon: Percent, color: 'bg-blue-100 text-blue-700' },
    FIXED: { label: 'Fixed Amount', icon: Tag, color: 'bg-emerald-100 text-emerald-700' },
    BUY_X_GET_Y: { label: 'Buy X Get Y', icon: Gift, color: 'bg-purple-100 text-purple-700' },
}

const SCOPE_CONFIG: Record<string, string> = {
    ORDER: 'Entire Order',
    PRODUCT: 'Specific Product',
    CATEGORY: 'Product Category',
    BRAND: 'Product Brand',
}

const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)

export default function DiscountManager({
    initialRules, products, categories,
}: {
    initialRules: DiscountRule[]
    products: any[]
    categories: any[]
}) {
    const [rules, setRules] = useState<DiscountRule[]>(initialRules)
    const [showCreate, setShowCreate] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedLog, setSelectedLog] = useState<{ ruleId: number; logs: any[] } | null>(null)

    // Create form
    const [form, setForm] = useState({
        name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER',
        value: '', max_discount: '', min_order_amount: '', min_quantity: '',
        product: '', category: '', auto_apply: false,
        start_date: '', end_date: '', usage_limit: '', priority: '0',
    })

    const handleCreate = async () => {
        setLoading(true)
        try {
            const data: Record<string, unknown> = {
                name: form.name,
                discount_type: form.discount_type,
                scope: form.scope,
                value: parseFloat(form.value) || 0,
                auto_apply: form.auto_apply,
                priority: parseInt(form.priority) || 0,
            }
            if (form.code) data.code = form.code
            if (form.max_discount) data.max_discount = parseFloat(form.max_discount)
            if (form.min_order_amount) data.min_order_amount = parseFloat(form.min_order_amount)
            if (form.min_quantity) data.min_quantity = parseInt(form.min_quantity)
            if (form.product) data.product = parseInt(form.product)
            if (form.category) data.category = parseInt(form.category)
            if (form.start_date) data.start_date = form.start_date
            if (form.end_date) data.end_date = form.end_date
            if (form.usage_limit) data.usage_limit = parseInt(form.usage_limit)

            const res = await createDiscountRule(data)
            setRules(prev => [res, ...prev])
            setShowCreate(false)
            setForm({ name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER', value: '', max_discount: '', min_order_amount: '', min_quantity: '', product: '', category: '', auto_apply: false, start_date: '', end_date: '', usage_limit: '', priority: '0' })
        } catch { /* ignore */ }
        setLoading(false)
    }

    const handleToggle = async (id: number) => {
        const res = await toggleDiscountRule(id)
        setRules(prev => prev.map(r => r.id === id ? res : r))
    }

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const handleDelete = async () => {
        if (deleteTarget === null) return
        await deleteDiscountRule(deleteTarget)
        setRules(prev => prev.filter(r => r.id !== deleteTarget))
        setDeleteTarget(null)
    }

    const handleViewLog = async (ruleId: number) => {
        const logs = await getDiscountUsageLog(ruleId)
        setSelectedLog({ ruleId, logs: Array.isArray(logs) ? logs : [] })
    }

    const activeCount = rules.filter(r => r.is_active).length
    const autoCount = rules.filter(r => r.auto_apply).length

    return (
        <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4">
                <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-gray-400">Total Rules</p>
                    <p className="text-2xl font-bold">{rules.length}</p>
                </CardContent></Card>
                <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-gray-400">Active</p>
                    <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
                </CardContent></Card>
                <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-gray-400">Auto-Apply</p>
                    <p className="text-2xl font-bold text-blue-600">{autoCount}</p>
                </CardContent></Card>
                <Card><CardContent className="py-4 text-center">
                    <p className="text-xs text-gray-400">Total Uses</p>
                    <p className="text-2xl font-bold">{rules.reduce((s, r) => s + r.times_used, 0)}</p>
                </CardContent></Card>
            </div>

            {/* Create Button */}
            <div className="flex justify-end">
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">
                    <Plus size={16} /> New Rule
                </button>
            </div>

            {/* Rules List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Discount Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {rules.length === 0 ? (
                        <p className="text-center text-gray-400 py-10">No discount rules created</p>
                    ) : rules.map(rule => {
                        const tcfg = TYPE_CONFIG[rule.discount_type] || TYPE_CONFIG.PERCENTAGE
                        const Icon = tcfg.icon
                        return (
                            <div key={rule.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tcfg.color}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{rule.name}</span>
                                        {rule.code && <Badge className="bg-gray-100 text-gray-600 text-[10px]">{rule.code}</Badge>}
                                        <Badge className={`text-[10px] ${tcfg.color}`}>{tcfg.label}</Badge>
                                        {rule.auto_apply && <Badge className="bg-blue-100 text-blue-600 text-[10px]">Auto</Badge>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                        <span>{SCOPE_CONFIG[rule.scope] || rule.scope}</span>
                                        <span className="font-semibold text-gray-600">
                                            {rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` : fmt(rule.value)}
                                        </span>
                                        {rule.product_name && <span>→ {rule.product_name}</span>}
                                        {rule.category_name && <span>→ {rule.category_name}</span>}
                                        {rule.brand_name && <span>→ {rule.brand_name}</span>}
                                        <span>Used: {rule.times_used}{rule.usage_limit ? `/${rule.usage_limit}` : ''}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => handleViewLog(rule.id)}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg" title="Usage Log">
                                        <Clock size={14} />
                                    </button>
                                    <button onClick={() => handleToggle(rule.id)}
                                        className={`p-2 rounded-lg ${rule.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-200'}`}>
                                        {rule.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                    </button>
                                    <button onClick={() => setDeleteTarget(rule.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowCreate(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">New Discount Rule</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                                    <input className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Promo Code</label>
                                    <input className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder="Optional" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                                    <select className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                                        <option value="PERCENTAGE">Percentage Off</option>
                                        <option value="FIXED">Fixed Amount Off</option>
                                        <option value="BUY_X_GET_Y">Buy X Get Y</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Value *</label>
                                    <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder={form.discount_type === 'PERCENTAGE' ? '10' : '5000'}
                                        value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
                                    <select className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                                        <option value="ORDER">Entire Order</option>
                                        <option value="PRODUCT">Specific Product</option>
                                        <option value="CATEGORY">Category</option>
                                        <option value="BRAND">Brand</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                                    <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
                                </div>
                            </div>
                            {form.scope === 'PRODUCT' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
                                    <select className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}>
                                        <option value="">Select product</option>
                                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {form.scope === 'CATEGORY' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                                    <select className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                        <option value="">Select category</option>
                                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Discount</label>
                                    <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        placeholder="No cap" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Order</label>
                                    <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        placeholder="No min" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Usage Limit</label>
                                    <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        placeholder="Unlimited" value={form.usage_limit} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                                    <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                                    <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                                        value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 mt-2">
                                <input type="checkbox" className="w-4 h-4 rounded"
                                    checked={form.auto_apply} onChange={e => setForm(f => ({ ...f, auto_apply: e.target.checked }))} />
                                <span className="text-sm text-gray-600">Auto-apply at POS checkout</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowCreate(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleCreate} disabled={loading || !form.name || !form.value}
                                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40">
                                Create Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Usage Log Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">Usage Log</h3>
                        {selectedLog.logs.length === 0 ? (
                            <p className="text-center text-gray-400 py-6">No uses recorded yet</p>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {selectedLog.logs.map((log: any) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium">{log.order_ref || `Order #${log.order}`}</p>
                                            <p className="text-xs text-gray-400">{new Date(log.applied_at).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-red-500">-{fmt(log.discount_amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end mt-4">
                            <button onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
                        </div>
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
