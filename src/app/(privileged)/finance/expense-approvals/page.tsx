'use client'

/**
 * EXPENSE APPROVAL CENTER
 * ========================
 * Employee expense claim approval workflow
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function ExpenseApprovalsPage() {
  return (
    <div className="min-h-screen bg-app-bg p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-app-border/30">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-purple-50 flex items-center justify-center">
              <FileText size={40} className="text-purple-600" />
            </div>
            <h1 className="mb-2">Expense Approval Center</h1>
            <p className="text-sm text-app-muted-foreground mb-8">
              Employee expense claim review and approval
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-app-info-bg border border-app-info rounded-xl text-left">
                <p className="text-sm font-bold text-app-info mb-2">🚧 Coming Soon</p>
                <p className="text-xs text-app-info">
                  Expense approval with receipt verification and policy compliance checks.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link href="/finance/expenses">
                    <ArrowRight size={16} className="mr-2" />
                    View All Expenses
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
