'use client'

/**
 * INVOICE LIST PANEL
 * For Purchase Verification Workspace
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Calendar, AlertTriangle } from 'lucide-react'
import { useCurrency } from '@/lib/utils/currency'

export function InvoiceListPanel({
  invoices = [],
  selectedInvoice,
  onSelectInvoice,
  filterStatus = 'all',
  onFilterChange
}: {
  invoices?: Record<string, any>[];
  selectedInvoice?: Record<string, any> | null;
  onSelectInvoice?: (inv: Record<string, any>) => void;
  filterStatus?: string;
  onFilterChange?: (status: string) => void;
}) {
  const { fmt } = useCurrency()
  const [searchQuery, setSearchQuery] = useState('')

  const statusColors = {
    PENDING: 'bg-app-info-bg text-app-info border-app-info',
    VERIFIED: 'bg-app-success-bg text-app-success border-app-success',
    DISCREPANCY: 'bg-app-warning-bg text-app-warning border-app-warning',
    REJECTED: 'bg-app-error-bg text-app-error border-app-error'
  }

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = !searchQuery ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = filterStatus === 'all' || inv.status === filterStatus

    return matchesSearch && matchesFilter
  })

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <Card className="border-app-border/30 mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange?.('all')}
              className="flex-1 h-9 text-xs"
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'PENDING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange?.('PENDING')}
              className="flex-1 h-9 text-xs"
            >
              Pending
            </Button>
            <Button
              variant={filterStatus === 'DISCREPANCY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange?.('DISCREPANCY')}
              className="flex-1 h-9 text-xs"
            >
              Issues
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        {filteredInvoices.map((invoice) => (
          <Card
            key={invoice.id}
            className={`cursor-pointer transition-all border-app-border/30 hover:shadow-md ${
              selectedInvoice?.id === invoice.id ? 'ring-2 ring-app-primary bg-app-primary/5' : ''
            }`}
            onClick={() => onSelectInvoice?.(invoice)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-app-foreground">{invoice.invoice_number}</p>
                  <p className="text-xs text-app-muted-foreground">{invoice.supplier_name}</p>
                </div>
                <Badge className={(statusColors as any)[invoice.status]}>{invoice.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-muted-foreground flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </span>
                <span className="font-bold text-app-foreground">{fmt(invoice.total_amount)}</span>
              </div>
              {invoice.status === 'DISCREPANCY' && (
                <div className="mt-2 flex items-center gap-1 text-xs text-app-warning">
                  <AlertTriangle size={12} />
                  Price difference detected
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
