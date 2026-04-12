// @ts-nocheck
'use client'

/**
 * DOCUMENT VIEWER PANEL (Enhanced with Interactive Zones)
 * For viewing supplier invoices (PDF/Image) with field highlighting
 *
 * Features:
 * - Document ↔ field linking (shows highlighted zones)
 * - Click zones to activate corresponding system fields
 * - Zoom controls and fullscreen mode
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ZoomIn, ZoomOut, RotateCw, Download, Upload, Maximize2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useVerification } from '@/lib/workspace/VerificationContext'

export function DocumentViewerPanel({
  invoice = null,
  onUpload
}: any) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Verification context for highlighting
  const {
    highlightedZone,
    setHighlightedZone,
    activeFieldKey,
    setActiveFieldKey,
    fieldLinks
  } = useVerification()

  const documentUrl = invoice?.document_url

  // Clear highlight when invoice changes
  useEffect(() => {
    setHighlightedZone(null)
  }, [invoice?.id])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload?.(file, invoice?.id)
      toast.success(`Uploaded: ${file.name}`)
    }
  }

  const handleDownload = () => {
    if (documentUrl) {
      const a = document.createElement('a')
      a.href = documentUrl
      a.download = `invoice-${invoice?.invoice_number || 'document'}.pdf`
      a.click()
      toast.success('Download started')
    }
  }

  if (!invoice) {
    return (
      <Card className="h-full flex items-center justify-center border-app-border/30">
        <div className="text-center p-8">
          <FileText size={48} className="mx-auto mb-4 text-app-text-muted opacity-30" />
          <p className="text-sm font-bold text-app-text-muted">No invoice selected</p>
          <p className="text-xs text-app-text-faint mt-1">Select an invoice to view document</p>
        </div>
      </Card>
    )
  }

  if (!documentUrl) {
    return (
      <Card className="h-full flex flex-col border-app-border/30">
        <CardHeader className="pb-3 border-b border-app-border/30">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} className="text-app-primary" />
            Supplier Invoice Document
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-app-surface-2 flex items-center justify-center">
              <FileText size={40} className="text-app-text-muted opacity-30" />
            </div>
            <div>
              <p className="text-sm font-bold text-app-text-muted mb-1">No Document Attached</p>
              <p className="text-xs text-app-text-faint">Upload the supplier's invoice PDF or scan</p>
            </div>
            <div>
              <label htmlFor="doc-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all">
                  <Upload size={16} />
                  Upload Document
                </div>
              </label>
              <input
                id="doc-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
              />
              <p className="text-xs text-app-text-faint mt-2">PDF, JPG, PNG supported</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`h-full flex flex-col border-app-border/30 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3 border-b border-app-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} className="text-app-primary" />
            Supplier Invoice
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(prev => Math.max(prev - 25, 50))}
              disabled={zoom <= 50}
              className="h-8 w-8 p-0"
            >
              <ZoomOut size={14} />
            </Button>
            <span className="text-xs font-bold text-app-text-muted min-w-[50px] text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(prev => Math.min(prev + 25, 200))}
              disabled={zoom >= 200}
              className="h-8 w-8 p-0"
            >
              <ZoomIn size={14} />
            </Button>
            <div className="w-px h-4 bg-app-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="h-8 w-8 p-0"
            >
              <RotateCw size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
            >
              <Download size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? <X size={14} /> : <Maximize2 size={14} />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto bg-app-bg/30 p-4">
        <div className="flex items-center justify-center min-h-full">
          <div
            className="relative"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease'
            }}
          >
            {/* Mock PDF viewer - replace with real implementation */}
            <div className="bg-app-surface rounded-lg shadow-lg p-8 w-[600px] relative">
              <div className="border-b-2 border-app-border pb-4 mb-4">
                <h2 className="text-2xl font-bold">INVOICE</h2>
                <p className="text-sm text-app-muted-foreground">{invoice.supplier_name}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Invoice #:</strong> {invoice.invoice_number}</p>
                <p><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
                <p><strong>PO #:</strong> {invoice.po_number}</p>
              </div>
              <div className="mt-8 border-t-2 border-app-border pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.invoice_items?.map((item: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{item.product_name}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">${item.unit_price}</td>
                        <td className="text-right font-bold">${item.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-8 text-right">
                <p className="text-2xl font-bold">Total: ${invoice.total_amount}</p>
              </div>

              {/* Highlight Overlay (when field is clicked in System Data) */}
              {highlightedZone && (
                <div
                  className="document-highlight absolute pointer-events-none"
                  style={{
                    left: `${highlightedZone.x}px`,
                    top: `${highlightedZone.y}px`,
                    width: `${highlightedZone.width}px`,
                    height: `${highlightedZone.height}px`
                  }}
                >
                  {/* Label showing which field is highlighted */}
                  {activeFieldKey && (
                    <div className="absolute -top-6 left-0 bg-app-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {Array.from(fieldLinks.values()).find(f => f.fieldKey === activeFieldKey)?.fieldLabel}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
