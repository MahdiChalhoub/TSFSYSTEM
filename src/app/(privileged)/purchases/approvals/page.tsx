'use client'

/**
 * PURCHASE ORDER APPROVAL CENTER
 * ===============================
 * PO approval workflow with budget validation
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PurchaseApprovalsPage() {
  return (
    <div className="min-h-screen bg-app-bg p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-app-border/30">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
              <ShoppingCart size={40} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-app-text mb-2">Purchase Order Approvals</h1>
            <p className="text-sm text-app-text-muted mb-8">
              Multi-level PO approval with budget checks
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-left">
                <p className="text-sm font-bold text-blue-900 mb-2">🚧 Coming Soon</p>
                <p className="text-xs text-blue-700">
                  Purchase order approval workflow with amount thresholds and budget validation.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link href="/purchases/purchase-orders">
                    <ArrowRight size={16} className="mr-2" />
                    View Purchase Orders
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/approvals">
                    View Approval Center
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
