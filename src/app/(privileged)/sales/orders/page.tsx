'use client'

/**
 * SALES ORDERS (Alternative View)
 * ================================
 * Direct sales orders management (redirects to main sales console)
 */

import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart } from 'lucide-react'

export default function SalesOrdersPage() {
  useEffect(() => {
    // Redirect to main sales page
    window.location.href = '/sales'
  }, [])

  return (
    <div className="min-h-screen bg-app-bg p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-app-border/30">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-app-info-bg flex items-center justify-center">
              <ShoppingCart size={40} className="text-app-info" />
            </div>
            <h1 className="text-lg font-bold text-app-text mb-2">Redirecting to Sales Console...</h1>
            <p className="text-sm text-app-text-muted">
              You'll be redirected to the main sales page momentarily.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
