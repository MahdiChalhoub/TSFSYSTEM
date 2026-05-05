'use client'

import { useState, useRef } from 'react'
import { Search, Printer, Plus, Minus, Trash2, Tag, LayoutGrid, LayoutList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Product {
    id: number
    sku: string
    barcode: string | null
    name: string
    brand_name: string | null
    category_name: string | null
    selling_price_ttc: number
    selling_price_ht: number
    tva_rate: number
}

interface LabelItem {
    product: Product
    quantity: number
}

type LabelSize = 'small' | 'medium' | 'large'

export default function LabelPrinter({ products }: { products: Product[] }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [labelItems, setLabelItems] = useState<LabelItem[]>([])
    const [labelSize, setLabelSize] = useState<LabelSize>('medium')
    const [showPrice, setShowPrice] = useState(true)
    const [showBarcode, setShowBarcode] = useState(true)
    const [showSku, setShowSku] = useState(true)
    const [showBrand, setShowBrand] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    const filteredProducts = products.filter(p => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        )
    }).slice(0, 30)

    function addProduct(product: Product) {
        setLabelItems(prev => {
            const existing = prev.find(i => i.product.id === product.id)
            if (existing) {
                return prev.map(i =>
                    i.product.id === product.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i,
                )
            }
            return [...prev, { product, quantity: 1 }]
        })
    }

    function updateQty(productId: number, delta: number) {
        setLabelItems(prev =>
            prev
                .map(i =>
                    i.product.id === productId
                        ? { ...i, quantity: Math.max(0, i.quantity + delta) }
                        : i,
                )
                .filter(i => i.quantity > 0),
        )
    }

    function removeItem(productId: number) {
        setLabelItems(prev => prev.filter(i => i.product.id !== productId))
    }

    function handlePrint() {
        const printContent = printRef.current
        if (!printContent) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const sizeStyles = {
            small: { width: '35mm', height: '22mm', fontSize: '6px', barcodeSize: '8px', priceSize: '9px' },
            medium: { width: '50mm', height: '30mm', fontSize: '8px', barcodeSize: '10px', priceSize: '12px' },
            large: { width: '70mm', height: '40mm', fontSize: '10px', barcodeSize: '12px', priceSize: '16px' },
        }
        const s = sizeStyles[labelSize]

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Label Print</title>
                <style>
                    @page { margin: 3mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, Helvetica, sans-serif; }
                    .label-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 2mm;
                    }
                    .label {
                        width: ${s.width};
                        height: ${s.height};
                        border: 0.3mm solid #ccc;
                        padding: 1.5mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        overflow: hidden;
                        page-break-inside: avoid;
                    }
                    .label-name {
                        font-size: ${s.fontSize};
                        font-weight: bold;
                        line-height: 1.2;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .label-brand {
                        font-size: calc(${s.fontSize} - 1px);
                        color: #666;
                    }
                    .label-barcode {
                        font-family: 'Courier New', monospace;
                        font-size: ${s.barcodeSize};
                        letter-spacing: 1px;
                        text-align: center;
                        padding: 1mm 0;
                    }
                    .label-sku {
                        font-size: calc(${s.fontSize} - 1px);
                        color: #888;
                        text-align: center;
                    }
                    .label-price {
                        font-size: ${s.priceSize};
                        font-weight: bold;
                        text-align: right;
                    }
                    .label-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                    }
                </style>
            </head>
            <body>
                <div class="label-grid">
                    ${labelItems
                .map(item =>
                    Array(item.quantity)
                        .fill(null)
                        .map(
                            () => `
                                    <div class="label">
                                        <div>
                                            <div class="label-name">${item.product.name}</div>
                                            ${showBrand && item.product.brand_name ? `<div class="label-brand">${item.product.brand_name}</div>` : ''}
                                        </div>
                                        ${showBarcode && item.product.barcode ? `<div class="label-barcode">${item.product.barcode}</div>` : ''}
                                        <div class="label-footer">
                                            ${showSku ? `<div class="label-sku">${item.product.sku}</div>` : '<div></div>'}
                                            ${showPrice ? `<div class="label-price">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(item.product.selling_price_ttc)}</div>` : ''}
                                        </div>
                                    </div>
                                `,
                        )
                        .join(''),
                )
                .join('')}
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 300)
    }

    const totalLabels = labelItems.reduce((sum, i) => sum + i.quantity, 0)

    const fmt = (n: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)

    const sizeLabels: Record<LabelSize, string> = {
        small: '35×22mm',
        medium: '50×30mm',
        large: '70×40mm',
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Product Selector */}
            <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Select Products</CardTitle>
                    <div className="relative mt-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-app-success outline-none"
                            placeholder="Search by name, SKU, or barcode..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[450px] overflow-y-auto">
                    {filteredProducts.map(p => {
                        const isAdded = labelItems.some(i => i.product.id === p.id)
                        return (
                            <button
                                key={p.id}
                                onClick={() => addProduct(p)}
                                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all ${isAdded
                                        ? 'bg-app-success-bg border border-app-success'
                                        : 'hover:bg-app-surface border border-transparent'
                                    }`}
                            >
                                <div className="w-8 h-8 bg-app-surface-2 rounded-lg flex items-center justify-center text-app-muted-foreground shrink-0">
                                    <Tag size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-app-muted-foreground">
                                        <span>{p.sku}</span>
                                        {p.barcode && <span>· {p.barcode}</span>}
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-app-muted-foreground shrink-0">
                                    {fmt(p.selling_price_ttc)}
                                </span>
                            </button>
                        )
                    })}
                    {filteredProducts.length === 0 && (
                        <p className="text-sm text-app-muted-foreground text-center py-8">No products found</p>
                    )}
                </CardContent>
            </Card>

            {/* Right: Queue + Settings + Preview */}
            <div className="lg:col-span-2 space-y-6">
                {/* Settings Bar */}
                <Card>
                    <CardContent className="py-4">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Label Size */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-app-muted-foreground">Size:</span>
                                {(['small', 'medium', 'large'] as LabelSize[]).map(size => (
                                    <button
                                        key={size}
                                        onClick={() => setLabelSize(size)}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${labelSize === size
                                                ? 'bg-app-success-bg text-app-success'
                                                : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-surface-2'
                                            }`}
                                    >
                                        {sizeLabels[size]}
                                    </button>
                                ))}
                            </div>

                            <div className="h-6 w-px bg-app-surface-2" />

                            {/* Toggle Options */}
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showPrice}
                                    onChange={e => setShowPrice(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-app-success"
                                />
                                Price
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showBarcode}
                                    onChange={e => setShowBarcode(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-app-success"
                                />
                                Barcode
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showSku}
                                    onChange={e => setShowSku(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-app-success"
                                />
                                SKU
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showBrand}
                                    onChange={e => setShowBrand(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-app-success"
                                />
                                Brand
                            </label>

                            <div className="flex-1" />

                            {/* Print Button */}
                            <button
                                onClick={handlePrint}
                                disabled={labelItems.length === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-app-success text-white text-sm font-bold rounded-xl hover:bg-app-success transition-all shadow-lg hover:shadow-emerald-300/50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Printer size={16} />
                                Print {totalLabels > 0 ? `(${totalLabels})` : ''}
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Label Queue */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                            Print Queue
                            {totalLabels > 0 && (
                                <Badge className="ml-2 bg-app-success-bg text-app-success">{totalLabels} labels</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {labelItems.length === 0 ? (
                            <div className="text-center py-12 text-app-muted-foreground">
                                <Tag size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No products in print queue</p>
                                <p className="text-xs mt-1">Click products from the left panel to add</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {labelItems.map(item => (
                                    <div
                                        key={item.product.id}
                                        className="flex items-center gap-4 p-3 bg-app-surface rounded-xl"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.product.name}</p>
                                            <div className="flex gap-3 text-xs text-app-muted-foreground mt-0.5">
                                                <span>{item.product.sku}</span>
                                                {item.product.barcode && <span>{item.product.barcode}</span>}
                                                <span>{fmt(item.product.selling_price_ttc)}</span>
                                            </div>
                                        </div>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => updateQty(item.product.id, -1)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-app-surface-2 hover:bg-gray-300 text-app-muted-foreground transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQty(item.product.id, 1)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-app-success-bg hover:bg-emerald-200 text-app-success transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => removeItem(item.product.id)}
                                            className="p-1.5 text-red-400 hover:text-app-error hover:bg-app-error-bg rounded-lg transition-colors shrink-0"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Label Preview */}
                {labelItems.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <LayoutGrid size={16} />
                                Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div ref={printRef} className="flex flex-wrap gap-2">
                                {labelItems.map(item =>
                                    Array(Math.min(item.quantity, 4))
                                        .fill(null)
                                        .map((_, idx) => (
                                            <div
                                                key={`${item.product.id}-${idx}`}
                                                className={`border border-app-border rounded p-2 flex flex-col justify-between ${labelSize === 'small'
                                                        ? 'w-[132px] h-[83px]'
                                                        : labelSize === 'medium'
                                                            ? 'w-[189px] h-[113px]'
                                                            : 'w-[264px] h-[151px]'
                                                    }`}
                                            >
                                                <div>
                                                    <p
                                                        className={`font-bold truncate ${labelSize === 'small' ? 'text-[8px]' : labelSize === 'medium' ? 'text-[10px]' : 'text-xs'
                                                            }`}
                                                    >
                                                        {item.product.name}
                                                    </p>
                                                    {showBrand && item.product.brand_name && (
                                                        <p className="text-app-muted-foreground">{item.product.brand_name}</p>
                                                    )}
                                                </div>
                                                {showBarcode && item.product.barcode && (
                                                    <p
                                                        className={`font-mono text-center tracking-wider ${labelSize === 'small' ? 'text-[8px]' : labelSize === 'medium' ? 'text-[10px]' : 'text-xs'
                                                            }`}
                                                    >
                                                        {item.product.barcode}
                                                    </p>
                                                )}
                                                <div className="flex justify-between items-end">
                                                    {showSku && (
                                                        <span className="text-app-muted-foreground">{item.product.sku}</span>
                                                    )}
                                                    {showPrice && (
                                                        <span
                                                            className={`font-bold ${labelSize === 'small'
                                                                    ? 'text-[9px]'
                                                                    : labelSize === 'medium'
                                                                        ? 'text-xs'
                                                                        : 'text-sm'
                                                                }`}
                                                        >
                                                            {fmt(item.product.selling_price_ttc)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )),
                                )}
                                {totalLabels > labelItems.reduce((s, i) => s + Math.min(i.quantity, 4), 0) && (
                                    <div className="w-full text-center text-xs text-app-muted-foreground pt-2">
                                        Showing preview of first 4 labels per product. Full set prints when you click Print.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
