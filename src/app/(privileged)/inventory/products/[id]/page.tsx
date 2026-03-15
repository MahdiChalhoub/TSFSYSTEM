'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Trash2, Package, Barcode, TrendingUp, Activity } from 'lucide-react'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'

export default function ProductsDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const data = await erpFetch(`inventory/products/${id}/`)
      setItem(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await erpFetch(`inventory/products/${id}/`, {
        method: 'DELETE'
      })
      router.push('/inventory/products')
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete item')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-primary"></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-app-muted-foreground">Item not found</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  // Key product info for display
  const infoFields = [
    { label: 'SKU', value: item.sku },
    { label: 'Barcode', value: item.barcode },
    { label: 'Category', value: item.category_name },
    { label: 'Brand', value: item.brand_name },
    { label: 'Unit', value: item.unit_name },
    { label: 'Status', value: item.is_active ? 'Active' : 'Inactive' },
  ]

  const priceFields = [
    { label: 'Selling Price TTC', value: item.selling_price_ttc, color: 'text-emerald-400' },
    { label: 'Selling Price HT', value: item.selling_price_ht },
    { label: 'Cost Price', value: item.cost_price, color: 'text-blue-400' },
    { label: 'TVA Rate', value: item.tva_rate ? `${item.tva_rate}%` : '—' },
  ]

  const stockFields = [
    { label: 'On Hand', value: item.on_hand_qty },
    { label: 'Reserved', value: item.reserved_qty },
    { label: 'Available', value: item.available_qty },
    { label: 'Min Stock', value: item.min_stock_level },
  ]

  return (
    <div className="min-h-screen layout-container-padding theme-bg">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black theme-text">
              {item.name || `Product #${item.id}`}
            </h1>
            <p className="theme-text-muted mt-1">
              {item.sku && <span className="font-mono text-sm">{item.sku}</span>}
              {item.barcode && <span className="ml-3 text-xs"><Barcode className="inline h-3 w-3 mr-1" />{item.barcode}</span>}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/inventory/products/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="packaging">
            <Package className="h-4 w-4 mr-1.5" />Packaging
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-1.5" />Activity
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Product Info */}
            <Card className="layout-card-radius theme-surface">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {infoFields.map(f => (
                    <div key={f.label} className="flex justify-between items-center border-b border-app-border/50 pb-2">
                      <dt className="text-xs font-medium theme-text-muted">{f.label}</dt>
                      <dd className="text-sm font-semibold theme-text">{f.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="layout-card-radius theme-surface">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {priceFields.map(f => (
                    <div key={f.label} className="flex justify-between items-center border-b border-app-border/50 pb-2">
                      <dt className="text-xs font-medium theme-text-muted">{f.label}</dt>
                      <dd className={`text-sm font-bold ${f.color || 'theme-text'}`}>
                        {typeof f.value === 'number' ? Number(f.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : f.value || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Stock */}
            <Card className="layout-card-radius theme-surface">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {stockFields.map(f => (
                    <div key={f.label} className="flex justify-between items-center border-b border-app-border/50 pb-2">
                      <dt className="text-xs font-medium theme-text-muted">{f.label}</dt>
                      <dd className="text-sm font-bold theme-text">
                        {f.value != null ? Number(f.value).toLocaleString() : '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Packaging Tab ── */}
        <TabsContent value="packaging">
          <Card className="layout-card-radius theme-surface">
            <CardContent className="pt-6">
              <ProductPackagingTab
                productId={id}
                productName={item.name}
                basePriceTTC={item.selling_price_ttc}
                basePriceHT={item.selling_price_ht}
                productUnitId={item.unit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Tab ── */}
        <TabsContent value="activity">
          <Card className="layout-card-radius theme-surface">
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-app-muted-foreground">Activity tracking coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
