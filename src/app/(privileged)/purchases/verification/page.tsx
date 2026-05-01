'use client'

/**
 * PURCHASE INVOICE VERIFICATION - REDIRECT
 * =========================================
 * This page redirects to the new workspace-based verification system
 */

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FileText, Search, Filter, AlertTriangle,
  CheckCircle2, Clock, Package, Receipt,
  TrendingUp, Hash, Calendar
} from 'lucide-react'
import { DocumentViewer } from '@/components/verification/DocumentViewer'
import { ComparisonPanel } from '@/components/verification/ComparisonPanel'
import { LayoutSwitcher, useLayoutMode } from '@/components/layouts/LayoutSwitcher'
import { useCurrency } from '@/lib/utils/currency'

// Mock data structure (replace with real API)
interface PurchaseInvoice {
  id: number
  invoice_number: string
  supplier_name: string
  invoice_date: string
  due_date: string
  total_amount: number
  status: 'PENDING' | 'VERIFIED' | 'DISCREPANCY' | 'REJECTED'
  purchase_order_id: number
  goods_receipt_id?: number
  document_url?: string

  // PO data
  po_number: string
  po_total: number
  po_items: Array<{
    product_name: string
    quantity_ordered: number
    unit_price: number
    subtotal: number
  }>

  // Receipt data (what was actually received)
  receipt_number?: string
  quantity_received?: number
  received_date?: string

  // Invoice data (what supplier is charging)
  invoice_items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

export default function PurchaseVerificationPage() {
  // Redirect to new workspace-based system
  if (typeof window !== 'undefined') {
    window.location.href = '/purchases/invoice-verification'
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-app-text-muted mb-4">Redirecting to new verification system...</p>
        <a href="/purchases/invoice-verification" className="text-app-primary hover:underline">
          Click here if not redirected automatically
        </a>
      </div>
    </div>
  )
}

function OldPurchaseVerificationPage() {
  const { fmt } = useCurrency()
  const layoutMode = useLayoutMode('purchase-verification-layout')

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Load invoices
  useEffect(() => {
    loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      // const { erpFetch } = await import("@/lib/erp-api")
      // const data = await erpFetch('purchases/invoices/verification/')

      // Mock data for demo
      const mockData: PurchaseInvoice[] = [
        {
          id: 1,
          invoice_number: 'SUP-INV-001',
          supplier_name: 'ABC Suppliers Ltd',
          invoice_date: '2024-03-15',
          due_date: '2024-04-15',
          total_amount: 1305.00,
          status: 'DISCREPANCY',
          purchase_order_id: 1234,
          po_number: 'PO-1234',
          po_total: 1250.00,
          po_items: [
            { product_name: 'Product A', quantity_ordered: 100, unit_price: 10.00, subtotal: 1000.00 },
            { product_name: 'Product B', quantity_ordered: 50, unit_price: 5.00, subtotal: 250.00 }
          ],
          receipt_number: 'GRN-5678',
          quantity_received: 95,
          received_date: '2024-03-10',
          invoice_items: [
            { product_name: 'Product A', quantity: 100, unit_price: 10.50, subtotal: 1050.00 },
            { product_name: 'Product B', quantity: 50, unit_price: 5.10, subtotal: 255.00 }
          ],
          document_url: undefined // Would be actual PDF URL
        },
        {
          id: 2,
          invoice_number: 'SUP-INV-002',
          supplier_name: 'XYZ Trading Co',
          invoice_date: '2024-03-14',
          due_date: '2024-04-14',
          total_amount: 850.00,
          status: 'PENDING',
          purchase_order_id: 1235,
          po_number: 'PO-1235',
          po_total: 850.00,
          po_items: [
            { product_name: 'Product C', quantity_ordered: 200, unit_price: 4.25, subtotal: 850.00 }
          ],
          receipt_number: 'GRN-5679',
          quantity_received: 200,
          received_date: '2024-03-12',
          invoice_items: [
            { product_name: 'Product C', quantity: 200, unit_price: 4.25, subtotal: 850.00 }
          ],
          document_url: undefined
        }
      ]

      setInvoices(mockData)
      if (mockData.length > 0 && !selectedInvoice) {
        setSelectedInvoice(mockData[0])
      }
    } catch (error) {
      toast.error('Failed to load invoices')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = !searchQuery ||
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.po_number.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterStatus === 'all' || inv.status === filterStatus

      return matchesSearch && matchesFilter
    })
  }, [invoices, searchQuery, filterStatus])

  // Stats
  const stats = useMemo(() => {
    return {
      pending: invoices.filter(i => i.status === 'PENDING').length,
      discrepancies: invoices.filter(i => i.status === 'DISCREPANCY').length,
      verified: invoices.filter(i => i.status === 'VERIFIED').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.total_amount, 0)
    }
  }, [invoices])

  // Prepare comparison data for selected invoice
  const comparisonData = useMemo(() => {
    if (!selectedInvoice) return null

    const poTotal = selectedInvoice.po_total
    const invoiceTotal = selectedInvoice.total_amount
    const priceDiff = invoiceTotal - poTotal

    return {
      systemData: {
        label: 'Purchase Order',
        fields: [
          { key: 'po_number', label: 'PO Number', systemValue: selectedInvoice.po_number, physicalValue: selectedInvoice.po_number },
          { key: 'supplier', label: 'Supplier', systemValue: selectedInvoice.supplier_name, physicalValue: selectedInvoice.supplier_name },
          { key: 'date', label: 'Order Date', systemValue: selectedInvoice.invoice_date, physicalValue: selectedInvoice.invoice_date, type: 'date' as const },
          { key: 'total', label: 'PO Total', systemValue: poTotal, physicalValue: invoiceTotal, type: 'currency' as const, editable: false },
        ]
      },
      receiptData: selectedInvoice.receipt_number ? {
        label: 'Goods Receipt',
        fields: [
          { key: 'grn', label: 'GRN', systemValue: selectedInvoice.receipt_number },
          { key: 'received_date', label: 'Received Date', systemValue: selectedInvoice.received_date },
          { key: 'qty_received', label: 'Qty Received', systemValue: selectedInvoice.quantity_received },
          { key: 'status', label: 'Status', systemValue: 'Received' },
        ]
      } : undefined,
      physicalData: {
        label: 'Supplier Invoice',
        fields: []
      }
    }
  }, [selectedInvoice])

  const handleVerify = () => {
    if (!selectedInvoice) return

    // TODO: API call to verify invoice
    toast.success(`Invoice ${selectedInvoice.invoice_number} verified!`)

    // Update local state
    setInvoices(prev => prev.map(inv =>
      inv.id === selectedInvoice.id ? { ...inv, status: 'VERIFIED' } : inv
    ))
  }

  const handleReject = () => {
    if (!selectedInvoice) return
    toast.error(`Invoice ${selectedInvoice.invoice_number} rejected`)

    setInvoices(prev => prev.map(inv =>
      inv.id === selectedInvoice.id ? { ...inv, status: 'REJECTED' } : inv
    ))
  }

  const handleSaveChanges = (updatedFields: Record<string, any>) => {
    toast.success('Changes saved')
    console.log('Updated fields:', updatedFields)
  }

  const handleDocumentUpload = (file: File) => {
    // TODO: Upload to cloud storage
    toast.success(`Uploaded: ${file.name}`)
    console.log('Uploading file:', file)
  }

  // Layout classes with debugging
  const getLayoutClasses = () => {
    console.log('Current layoutMode:', layoutMode) // Debug
    if (layoutMode === 'single') return 'max-w-[1400px] mx-auto space-y-6'
    if (layoutMode === 'dual') return 'max-w-none grid grid-cols-[380px_1fr] gap-6'
    if (layoutMode === 'triple') return 'max-w-none grid grid-cols-[320px_1fr_420px] gap-6'
    if (layoutMode === 'quad') return 'max-w-none grid grid-cols-[280px_1fr_400px_340px] gap-6'
    return 'max-w-none grid grid-cols-[380px_1fr] gap-6' // Default to dual
  }

  const statusColors = {
    PENDING: 'bg-app-info-bg text-app-info border-app-info',
    VERIFIED: 'bg-app-success-bg text-app-success border-app-success',
    DISCREPANCY: 'bg-app-warning-bg text-app-warning border-app-warning',
    REJECTED: 'bg-app-error-bg text-app-error border-app-error'
  }

  return (
    <div className="w-full min-h-screen p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-black text-[10px] uppercase tracking-widest px-3 py-1">
              Procurement Verification
            </Badge>
            <span className="text-[10px] font-bold text-app-faint uppercase tracking-widest flex items-center gap-1">
              <FileText size={12} /> 3-Way Match Engine
            </span>
          </div>
          <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.8rem] bg-purple-600 flex items-center justify-center shadow-2xl shadow-purple-200">
              <Receipt size={32} className="text-white" />
            </div>
            Invoice <span className="text-purple-600">Verification</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <LayoutSwitcher storageKey="purchase-verification-layout" />
          <Button onClick={loadInvoices} variant="outline" className="h-12 px-6 rounded-2xl">
            Refresh
          </Button>
        </div>
      </header>

      {/* Stats KPIs */}
      {layoutMode === 'single' && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-app-border/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock size={20} className="text-app-info" />
                <Badge className="bg-app-info-bg text-app-info">PENDING</Badge>
              </div>
              <p className="text-3xl font-black text-app-text">{stats.pending}</p>
              <p className="text-xs text-app-text-muted mt-1">Awaiting Review</p>
            </CardContent>
          </Card>

          <Card className="border-app-border/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle size={20} className="text-app-warning" />
                <Badge className="bg-app-warning-bg text-app-warning">ISSUES</Badge>
              </div>
              <p className="text-3xl font-black text-app-text">{stats.discrepancies}</p>
              <p className="text-xs text-app-text-muted mt-1">Discrepancies Found</p>
            </CardContent>
          </Card>

          <Card className="border-app-border/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 size={20} className="text-app-success" />
                <Badge className="bg-app-success-bg text-app-success">VERIFIED</Badge>
              </div>
              <p className="text-3xl font-black text-app-text">{stats.verified}</p>
              <p className="text-xs text-app-text-muted mt-1">Approved</p>
            </CardContent>
          </Card>

          <Card className="border-app-border/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp size={20} className="text-purple-500" />
                <Badge className="bg-purple-100 text-purple-700">TOTAL</Badge>
              </div>
              <p className="text-2xl font-black text-app-text">{fmt(stats.totalAmount)}</p>
              <p className="text-xs text-app-text-muted mt-1">Pending Value</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Workspace */}
      <div className={getLayoutClasses()}>
        {/* LEFT: Invoice List (always visible or hidden in single mode) */}
        {layoutMode !== 'single' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <Card className="border-app-border/30">
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
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
                    onClick={() => setFilterStatus('all')}
                    className="flex-1 h-9 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant={filterStatus === 'PENDING' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('PENDING')}
                    className="flex-1 h-9 text-xs"
                  >
                    Pending
                  </Button>
                  <Button
                    variant={filterStatus === 'DISCREPANCY' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('DISCREPANCY')}
                    className="flex-1 h-9 text-xs"
                  >
                    Issues
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Invoice List */}
            <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto custom-scrollbar">
              {filteredInvoices.map(invoice => (
                <Card
                  key={invoice.id}
                  className={`cursor-pointer transition-all border-app-border/30 hover:shadow-md ${
                    selectedInvoice?.id === invoice.id ? 'ring-2 ring-app-primary bg-app-primary/5' : ''
                  }`}
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-app-text">{invoice.invoice_number}</p>
                        <p className="text-xs text-app-text-muted">{invoice.supplier_name}</p>
                      </div>
                      <Badge className={statusColors[invoice.status]}>{invoice.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-app-text-faint flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-app-text">{fmt(invoice.total_amount)}</span>
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
        )}

        {/* CENTER: Comparison Panel */}
        <div className={layoutMode === 'single' ? 'space-y-6' : ''}>
          {comparisonData && (
            <ComparisonPanel
              title="3-Way Match Comparison"
              systemData={comparisonData.systemData}
              receiptData={comparisonData.receiptData}
              physicalData={comparisonData.physicalData}
              onSave={handleSaveChanges}
              onVerify={handleVerify}
              onReject={handleReject}
              className="h-full"
            />
          )}
        </div>

        {/* RIGHT: Document Viewer */}
        {layoutMode !== 'single' && layoutMode !== 'dual' && (
          <div className="sticky top-8 h-[calc(100vh-10rem)]">
            <DocumentViewer
              documentUrl={selectedInvoice?.document_url}
              documentType={selectedInvoice?.document_url ? 'pdf' : 'none'}
              title="Supplier Invoice"
              onUpload={handleDocumentUpload}
              allowUpload={true}
            />
          </div>
        )}

        {/* QUAD: Mini Stats */}
        {layoutMode === 'quad' && (
          <div className="space-y-4 sticky top-8">
            <Card className="border-app-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-app-text-muted">Pending</span>
                  <span className="font-bold">{stats.pending}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-app-text-muted">Issues</span>
                  <span className="font-bold text-app-warning">{stats.discrepancies}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-app-text-muted">Verified</span>
                  <span className="font-bold text-app-success">{stats.verified}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-app-border/30">
                  <span className="text-app-text-muted">Total Value</span>
                  <span className="font-bold">{fmt(stats.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
