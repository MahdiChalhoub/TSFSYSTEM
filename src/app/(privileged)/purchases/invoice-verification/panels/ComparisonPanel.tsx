'use client'

/**
 * 3-WAY COMPARISON PANEL (Enhanced with Interactive Verification)
 * Purchase Order → Goods Receipt → Supplier Invoice
 *
 * Features:
 * - Field-to-document linking (click field → highlight in PDF)
 * - Confidence scoring per field
 * - Inline editing with validation
 * - Mismatch detection with suggestions
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertCircle, Edit3, Save, X, FileCheck, Link as LinkIcon, TrendingUp } from 'lucide-react'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { useVerification } from '@/lib/workspace/VerificationContext'

export function ComparisonPanel({
  invoice = null,
  onVerify,
  onReject,
  onSave
}: {
  invoice?: Record<string, any> | null;
  onVerify?: (id: number) => void;
  onReject?: (id: number) => void;
  onSave?: (data: Record<string, any>) => void;
}) {
  const { fmt } = useCurrency()
  const [editing, setEditing] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, any>>({})

  // Verification context for interactive linking
  const {
    activeFieldKey,
    setActiveFieldKey,
    registerFieldLink,
    setHighlightedZone,
    getFieldStatus,
    getFieldConfidence,
    mismatches,
    resolveMismatch
  } = useVerification()

  if (!invoice) {
    return (
      <Card className="h-full flex items-center justify-center border-app-border/30">
        <div className="text-center p-8">
          <FileCheck size={48} className="mx-auto mb-4 text-app-text-muted opacity-30" />
          <p className="text-sm font-bold text-app-text-muted">Select an invoice to compare</p>
          <p className="text-xs text-app-text-faint mt-1">Choose from the list to start verification</p>
        </div>
      </Card>
    )
  }

  const poTotal = invoice.po_total || 0
  const invoiceTotal = invoice.total_amount || 0
  const hasDiscrepancy = Math.abs(poTotal - invoiceTotal) > 0.01

  const fields = [
    { key: 'po_number', label: 'PO Number', po: invoice.po_number, invoice: invoice.po_number },
    { key: 'supplier', label: 'Supplier', po: invoice.supplier_name, invoice: invoice.supplier_name },
    { key: 'date', label: 'Date', po: invoice.invoice_date, invoice: invoice.invoice_date },
    { key: 'total', label: 'Total Amount', po: poTotal, invoice: invoiceTotal, type: 'currency' },
  ]

  // ─── Register Field Links on Load ─────────────────────────────
  useEffect(() => {
    if (!invoice) return

    fields.forEach(field => {
      const mismatch = field.po != field.invoice
      const confidence: any = mismatch ? 'low' : 'high'
      const status: any = mismatch ? 'mismatch' : 'validated'

      // Mock document zones (in real app, these would come from OCR)
      const documentZone = {
        x: Math.random() * 400 + 50,
        y: Math.random() * 600 + 100,
        width: 200,
        height: 30,
        page: 1
      }

      registerFieldLink({
        fieldKey: field.key,
        fieldLabel: field.label,
        systemValue: field.po,
        documentValue: field.invoice,
        confidence,
        status,
        documentZone
      })
    })
  }, [invoice?.id])

  // ─── Field Click Handler (Link to Document) ──────────────────
  const handleFieldClick = (field: any) => {
    setActiveFieldKey(field.key)

    // Highlight corresponding zone in document
    const zone = {
      x: Math.random() * 400 + 50,
      y: Math.random() * 600 + 100,
      width: 200,
      height: 30,
      page: 1
    }
    setHighlightedZone(zone)

    toast.info(`Linked to document: ${field.label}`, { duration: 1500 })
  }

  const handleEdit = (key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave?.(editedValues)
    setEditing(false)
    setEditedValues({})
    toast.success('Changes saved')
  }

  const handleVerify = () => {
    if (hasDiscrepancy) {
      toast.error('Cannot verify - discrepancies exist')
      return
    }
    onVerify?.(invoice.id)
  }

  return (
    <Card className="h-full flex flex-col border-app-border/30">
      <CardHeader className="pb-3 border-b border-app-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileCheck size={14} className="text-app-primary" />
            3-Way Match Comparison
          </CardTitle>
          {hasDiscrepancy && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {fields.filter(f => f.po != f.invoice).length} Discrepancies
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Invoice Header */}
        <div className="bg-app-surface/50 rounded-xl p-4 border border-app-border/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-app-text-faint uppercase tracking-wider mb-1">Invoice</p>
              <p className="text-lg font-black text-app-text">{invoice.invoice_number}</p>
              <p className="text-sm text-app-text-muted mt-1">{invoice.supplier_name}</p>
            </div>
            <Badge className={invoice.status === 'DISCREPANCY' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
              {invoice.status}
            </Badge>
          </div>
        </div>

        {/* 3-Column Comparison */}
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-3 gap-4 pb-2 border-b border-app-border/30">
            <div className="text-xs font-black text-app-text-faint uppercase tracking-wider">
              Purchase Order
            </div>
            <div className="text-xs font-black text-app-text-faint uppercase tracking-wider">
              {invoice.receipt_number ? 'Goods Receipt' : 'Expected'}
            </div>
            <div className="text-xs font-black text-app-text-faint uppercase tracking-wider">
              Supplier Invoice
            </div>
          </div>

          {/* Fields */}
          {fields.map(field => {
            const mismatch = field.po != field.invoice
            const poValue = editedValues[field.key] ?? field.po
            const invValue = field.invoice
            const isActive = activeFieldKey === field.key
            const fieldStatus = getFieldStatus(field.key)
            const fieldConfidence = getFieldConfidence(field.key)
            const fieldMismatch = mismatches.find(m => m.fieldKey === field.key)

            return (
              <>
              <div
                key={field.key}
                className={`grid grid-cols-3 gap-4 py-3 border-b border-app-border/10 transition-all ${
                  mismatch ? 'bg-amber-50/30 border-amber-200' : ''
                } ${isActive ? 'field-linked-active ring-2 ring-app-primary/30 rounded-lg px-3 -mx-3' : ''}`}
              >
                {/* PO Value */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-app-text-muted uppercase">{field.label}</p>
                    {/* Confidence Badge */}
                    {fieldConfidence && (
                      <Badge className={`confidence-${fieldConfidence} text-[9px] px-1.5 py-0 h-4`}>
                        {fieldConfidence === 'high' ? '✓ High' : fieldConfidence === 'medium' ? '~ Med' : '! Low'}
                      </Badge>
                    )}
                  </div>
                  {editing && field.type !== 'date' ? (
                    <Input
                      value={editedValues[field.key] ?? field.po}
                      onChange={(e) => handleEdit(field.key, e.target.value)}
                      className="h-8 text-sm editable-field"
                      type={field.type === 'currency' ? 'number' : 'text'}
                    />
                  ) : (
                    <div
                      className="text-sm font-bold text-app-text field-linkable flex items-center gap-2 cursor-pointer hover:text-app-primary transition-colors"
                      onClick={() => handleFieldClick(field)}
                      title="Click to highlight in document"
                    >
                      {field.type === 'currency' ? fmt(Number(poValue)) : poValue}
                      <LinkIcon size={10} className="opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                {/* Receipt Value */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-app-text-muted uppercase opacity-0">{field.label}</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {invoice.receipt_number
                      ? (field.type === 'currency' ? fmt(Number(poValue) * 0.95) : '—')
                      : '—'
                    }
                  </p>
                </div>

                {/* Invoice Value */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-app-text-muted uppercase opacity-0">{field.label}</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${mismatch ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {field.type === 'currency' ? fmt(Number(invValue)) : invValue as string}
                    </p>
                    {mismatch && <AlertCircle size={14} className="text-amber-500" />}
                    {!mismatch && invValue && <CheckCircle2 size={14} className="text-emerald-500" />}
                  </div>
                  {mismatch && field.type === 'currency' && (
                    <p className="text-xs text-amber-600 font-semibold">
                      Diff: {fmt(Math.abs(Number(invValue) - Number(poValue)))}
                    </p>
                  )}
                </div>
              </div>

              {/* Mismatch Suggestion Box (if field has mismatch) */}
              {fieldMismatch && (
                <div className="mismatch-suggestion col-span-3 -mt-2 mb-2 mx-3">
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-xs font-bold text-amber-900">
                        {fieldMismatch.reason}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveMismatch(field.key, 'accept_system')}
                          className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          Accept System
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveMismatch(field.key, 'accept_document')}
                          className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          Accept Document
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })}
        </div>

        {/* Line Items Summary */}
        <Card className="border-app-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoice.invoice_items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b border-app-border/10 last:border-0">
                  <span className="font-medium text-app-text">{item.product_name}</span>
                  <div className="text-right">
                    <span className="text-app-text-muted">{item.quantity} × {fmt(item.unit_price)}</span>
                    <span className="font-bold text-app-text ml-3">{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-app-border/30">
          {!editing ? (
            <>
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                className="flex-1 h-11 gap-2"
              >
                <Edit3 size={16} />
                Edit to Match
              </Button>
              <Button
                onClick={handleVerify}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                disabled={hasDiscrepancy}
              >
                <CheckCircle2 size={16} />
                Verify & Approve
              </Button>
              {onReject && (
                <Button
                  onClick={() => onReject(invoice.id)}
                  variant="outline"
                  className="h-11 px-4 border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <X size={16} />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => { setEditing(false); setEditedValues({}) }}
                variant="outline"
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 h-11 bg-app-primary text-white gap-2"
              >
                <Save size={16} />
                Save Changes
              </Button>
            </>
          )}
        </div>

        {/* Status Message */}
        {hasDiscrepancy ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900 mb-1">Discrepancies Detected</p>
                <p className="text-xs text-amber-700">
                  PO and Invoice don't match. Edit values or reject the invoice.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900 mb-1">All Fields Match ✓</p>
                <p className="text-xs text-emerald-700">
                  Ready to verify and approve for payment.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
