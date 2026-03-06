'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'

export default function QuoteRequestsDetailPage() {
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
      const data = await erpFetch(`client_portal/quote-requests/${id}/`)
      setItem(data)
    } catch (error) {
      console.error('Failed to load quote-requests:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await erpFetch(`client_portal/quote-requests/${id}/`, {
        method: 'DELETE'
      })
      router.push('/client_portal/quote-requests')
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
              {item.name || item.title || `Quote-Requests #${item.id}`}
            </h1>
            <p className="theme-text-muted mt-1">
              View and manage quote requests details
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/client_portal/quote-requests/${id}/edit`)}
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
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="layout-card-radius theme-surface">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(item).map(([key, value]) => (
                  <div key={key} className="border-b border-app-border pb-3">
                    <dt className="text-sm font-bold text-app-muted-foreground uppercase">
                      {key.replace('_', ' ')}
                    </dt>
                    <dd className="mt-1 text-app-foreground">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

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
