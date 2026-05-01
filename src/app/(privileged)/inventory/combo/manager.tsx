'use client'

import { useState, useEffect } from 'react'
import { Package, Plus, Trash2, Search, Layers, Hash, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getComboComponents, addComboComponent, removeComboComponent } from '@/app/actions/combo'

interface Product {
    id: number
    sku: string
    barcode: string | null
    name: string
    product_type: string
    selling_price_ttc: number
    category_name: string | null
    brand_name: string | null
}

interface ComboComponent {
    id: number
    combo_product: number
    component_product: number
    component_name: string
    component_sku: string
    component_price: number
    quantity: number
    price_override: number | null
    sort_order: number
}

export default function ComboManager({
    comboProducts,
    allProducts,
}: {
    comboProducts: Product[]
    allProducts: Product[]
}) {
    const [selectedCombo, setSelectedCombo] = useState<Product | null>(null)
    const [components, setComponents] = useState<ComboComponent[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [addSearch, setAddSearch] = useState('')
    const [addQty, setAddQty] = useState(1)
    const [addPriceOverride, setAddPriceOverride] = useState<string>('')

    useEffect(() => {
        if (selectedCombo) loadComponents(selectedCombo.id)
    }, [selectedCombo])

    async function loadComponents(productId: number) {
        setLoading(true)
        try {
            const res = await getComboComponents(productId)
            setComponents(Array.isArray(res) ? res : [])
        } catch {
            setComponents([])
        }
        setLoading(false)
    }

    async function handleAdd(componentId: number) {
        if (!selectedCombo) return
        await addComboComponent(
            selectedCombo.id,
            componentId,
            addQty,
            addPriceOverride ? parseFloat(addPriceOverride) : undefined,
        )
        loadComponents(selectedCombo.id)
        setShowAddModal(false)
        setAddSearch('')
        setAddQty(1)
        setAddPriceOverride('')
    }

    async function handleRemove(componentId: number) {
        if (!selectedCombo) return
        await removeComboComponent(selectedCombo.id, componentId)
        loadComponents(selectedCombo.id)
    }

    const filteredCombos = comboProducts.filter(
        p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    const filteredAddProducts = allProducts.filter(
        p =>
            (p.name.toLowerCase().includes(addSearch.toLowerCase()) ||
                p.sku.toLowerCase().includes(addSearch.toLowerCase())) &&
            !components.some(c => c.component_product === p.id),
    )

    const totalComponentValue = components.reduce(
        (sum, c) => sum + (c.price_override ?? c.component_price) * c.quantity,
        0,
    )

    const fmt = (n: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Combo List */}
            <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Combo Products</CardTitle>
                    <div className="relative mt-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                            placeholder="Search combos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredCombos.length === 0 ? (
                        <div className="text-center py-8 text-app-muted-foreground">
                            <Package size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No combo products found</p>
                            <p className="text-xs mt-1">Set a product&apos;s type to &quot;Combo&quot; first</p>
                        </div>
                    ) : (
                        filteredCombos.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedCombo(p)}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedCombo?.id === p.id
                                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                                        : 'border-app-border hover:border-purple-300 hover:bg-app-surface'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{p.name}</span>
                                    <Badge className="bg-purple-100 text-purple-700 text-xs">COMBO</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-app-muted-foreground">
                                    <span>{p.sku}</span>
                                    <span>{fmt(p.selling_price_ttc)}</span>
                                </div>
                            </button>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Right: Component Editor */}
            <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                            {selectedCombo ? (
                                <>Components of <span className="text-purple-600">{selectedCombo.name}</span></>
                            ) : (
                                'Select a combo product'
                            )}
                        </CardTitle>
                        {selectedCombo && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                <Plus size={14} />
                                Add Component
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedCombo ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <Layers size={48} className="mx-auto mb-3 opacity-30" />
                            <p>Select a combo product from the left panel</p>
                        </div>
                    ) : loading ? (
                        <div className="text-center py-12 text-app-muted-foreground">Loading...</div>
                    ) : components.length === 0 ? (
                        <div className="text-center py-12 text-app-muted-foreground">
                            <Package size={40} className="mx-auto mb-3 opacity-30" />
                            <p>No components yet</p>
                            <p className="text-xs mt-1">Click &quot;Add Component&quot; to build this bundle</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {components.map(c => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-4 p-3 bg-app-surface rounded-xl hover:bg-app-surface-2 transition-colors"
                                    >
                                        <div className="w-9 h-9 bg-app-info-bg rounded-lg flex items-center justify-center text-app-info shrink-0">
                                            <Package size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{c.component_name}</p>
                                            <p className="text-xs text-app-muted-foreground">{c.component_sku}</p>
                                        </div>
                                        <div className="flex items-center gap-1 text-sm shrink-0">
                                            <Hash size={12} className="text-app-muted-foreground" />
                                            <span className="font-semibold">{c.quantity}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold">
                                                {fmt((c.price_override ?? c.component_price) * c.quantity)}
                                            </p>
                                            {c.price_override && (
                                                <p className="text-xs text-orange-500">Override: {fmt(c.price_override)}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemove(c.id)}
                                            className="p-1.5 text-red-400 hover:text-app-error hover:bg-app-error-bg rounded-lg transition-colors shrink-0"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Summary row */}
                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <div className="text-sm text-app-muted-foreground">
                                    {components.length} component{components.length !== 1 ? 's' : ''} ·
                                    Component value: <span className="font-semibold text-app-foreground">{fmt(totalComponentValue)}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-app-muted-foreground">Combo price: </span>
                                    <span className={`font-bold ${selectedCombo.selling_price_ttc < totalComponentValue ? 'text-app-success' : 'text-app-warning'}`}>
                                        {fmt(selectedCombo.selling_price_ttc)}
                                    </span>
                                    {selectedCombo.selling_price_ttc < totalComponentValue && (
                                        <span className="text-xs text-app-success ml-1">
                                            (saves {fmt(totalComponentValue - selectedCombo.selling_price_ttc)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Add Component Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-app-surface rounded-2xl w-full max-w-lg shadow-xl">
                        <div className="p-5 border-b">
                            <h3 className="text-lg font-bold">Add Component</h3>
                            <p className="text-sm text-app-muted-foreground">Search for a product to add to this combo</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                    placeholder="Search products by name or SKU..."
                                    value={addSearch}
                                    onChange={e => setAddSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-app-muted-foreground mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        value={addQty}
                                        onChange={e => setAddQty(Number(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-app-muted-foreground mb-1">Price Override (optional)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="—"
                                        value={addPriceOverride}
                                        onChange={e => setAddPriceOverride(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="max-h-[250px] overflow-y-auto space-y-1 border rounded-lg p-2">
                                {filteredAddProducts.slice(0, 20).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleAdd(p.id)}
                                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-purple-50 transition-colors"
                                    >
                                        <div className="w-8 h-8 bg-app-surface-2 rounded-lg flex items-center justify-center text-app-muted-foreground shrink-0">
                                            <Package size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{p.name}</p>
                                            <p className="text-xs text-app-muted-foreground">{p.sku}</p>
                                        </div>
                                        <span className="text-sm font-semibold shrink-0">{fmt(p.selling_price_ttc)}</span>
                                    </button>
                                ))}
                                {filteredAddProducts.length === 0 && (
                                    <p className="text-sm text-app-muted-foreground text-center py-4">No products match your search</p>
                                )}
                            </div>
                        </div>
                        <div className="p-5 border-t flex justify-end">
                            <button
                                onClick={() => {
                                    setShowAddModal(false)
                                    setAddSearch('')
                                    setAddQty(1)
                                    setAddPriceOverride('')
                                }}
                                className="px-4 py-2 text-sm font-medium text-app-muted-foreground bg-app-surface-2 rounded-lg hover:bg-app-surface-2 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
