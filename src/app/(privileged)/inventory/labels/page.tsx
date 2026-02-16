import { erpFetch } from '@/lib/erpFetch'
import LabelPrinter from './printer'

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

export default async function LabelPrintPage() {
    let products: Product[] = []
    try {
        const res = await erpFetch('/products/')
        products = Array.isArray(res) ? res : res.results || []
    } catch { /* empty */ }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Label Printing Studio</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Select products and print barcode labels. Supports shelf labels, price tags, and product stickers.
                </p>
            </div>
            <LabelPrinter products={products} />
        </div>
    )
}
