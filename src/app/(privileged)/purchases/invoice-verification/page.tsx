'use client'

/**
 * PURCHASE INVOICE VERIFICATION PAGE - REAL DATA
 * ================================================
 * 3-way matching workflow with real backend integration
 */

import { useState, useEffect } from 'react'
import { WorkspaceProvider } from '@/lib/workspace/WorkspaceContext'
import { VerificationProvider } from '@/lib/workspace/VerificationContext'
import { WorkspaceLayoutShell } from '@/components/workspace/WorkspaceLayoutShell'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { InvoiceListPanel } from './panels/InvoiceListPanel'
import { ComparisonPanel } from './panels/ComparisonPanel'
import { DocumentViewerPanel } from './panels/DocumentViewerPanel'
import { ActionsPanel } from './panels/ActionsPanel'
import { PageCapability } from '@/lib/workspace/types'
import { FileCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getInvoicesPendingVerification,
  getInvoiceDetail,
  verifyInvoice,
  rejectInvoice,
  holdInvoice,
  uploadInvoiceDocument,
} from '@/app/actions/invoice-verification'
import type { InvoiceListItem, InvoiceDetail } from '@/types/invoice-verification'

// ─── Page Capability Schema ─────────────────────────────────────
const PURCHASE_VERIFICATION_CAPABILITY: PageCapability = {
  pageId: 'purchase-verification',
  displayName: 'Purchase Invoice Verification',
  modes: {
    // Standard: single invoice list (mobile/tablet)
    standard: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {},
        },
      ],
      layout: 'single',
    },

    // Split: list + comparison (wide screens)
    split: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'comparison',
          component: ComparisonPanel,
          title: '3-Way Match',
          defaultCollapsed: false,
          props: {},
        },
      ],
      layout: 'grid',
      gridTemplate: '400px 1fr',
    },

    // Workspace: DUAL VERIFICATION MODE (4 panels)
    // List | System Data | Scanned Document | Actions
    workspace: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'system-data',
          component: ComparisonPanel,
          title: 'System Data (Editable)',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'scanned-document',
          component: DocumentViewerPanel,
          title: 'Scanned Invoice',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'verification-engine',
          component: ActionsPanel,
          title: 'Verification',
          defaultCollapsed: false,
          props: {},
        },
      ],
      layout: 'grid',
      gridTemplate: '300px 1fr 1fr 380px', // DUAL CENTER PANELS
    },

    // Command: FULL POWER VERIFICATION MODE (4-5 panels)
    command: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'system-data',
          component: ComparisonPanel,
          title: 'System Data (Editable)',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'scanned-document',
          component: DocumentViewerPanel,
          title: 'Scanned Invoice (Interactive)',
          defaultCollapsed: false,
          props: {},
        },
        {
          id: 'verification-engine',
          component: ActionsPanel,
          title: 'Verification Engine',
          defaultCollapsed: false,
          props: {},
        },
      ],
      layout: 'grid',
      gridTemplate: '300px 1fr 1fr 400px', // DUAL VERIFICATION
    },
  },
}

// ─── Main Page Component ────────────────────────────────────────
export default function PurchaseInvoiceVerificationPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  // Load invoices on mount
  useEffect(() => {
    loadInvoices()
  }, [])

  // Load detail when invoice selected
  useEffect(() => {
    if (selectedInvoiceId) {
      loadInvoiceDetail(selectedInvoiceId)
    } else {
      setInvoiceDetail(null)
    }
  }, [selectedInvoiceId])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const data = await getInvoicesPendingVerification()
      setInvoices(data.invoices)
    } catch (error: unknown) {
      toast.error('Failed to load invoices', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const loadInvoiceDetail = async (invoiceId: number) => {
    try {
      setDetailLoading(true)
      const detail = await getInvoiceDetail(invoiceId)
      setInvoiceDetail(detail)
    } catch (error: unknown) {
      toast.error('Failed to load invoice detail', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── Event Handlers ────────────────────────────────────────
  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId)
  }

  const handleVerify = async (invoiceId: number) => {
    try {
      const result = await verifyInvoice(invoiceId)

      if (result.success) {
        toast.success('Invoice Verified', {
          description: result.message,
        })
        // Reload invoices and detail
        await loadInvoices()
        if (selectedInvoiceId === invoiceId) {
          await loadInvoiceDetail(invoiceId)
        }
      } else {
        // Show violations
        toast.error('3-Way Match Failed', {
          description: result.message,
        })
        // Still reload to show updated status
        await loadInvoices()
        if (selectedInvoiceId === invoiceId) {
          await loadInvoiceDetail(invoiceId)
        }
      }
    } catch (error: unknown) {
      toast.error('Verification Failed', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleReject = async (invoiceId: number, reason: string) => {
    try {
      const result = await rejectInvoice(invoiceId, { reason })
      toast.success('Invoice Rejected', {
        description: result.message,
      })
      // Reload invoices and detail
      await loadInvoices()
      if (selectedInvoiceId === invoiceId) {
        await loadInvoiceDetail(invoiceId)
      }
    } catch (error: unknown) {
      toast.error('Rejection Failed', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleHold = async (invoiceId: number, reason?: string) => {
    try {
      const result = await holdInvoice(invoiceId, { reason })
      toast.success('Invoice On Hold', {
        description: result.message,
      })
      // Reload invoices and detail
      await loadInvoices()
      if (selectedInvoiceId === invoiceId) {
        await loadInvoiceDetail(invoiceId)
      }
    } catch (error: unknown) {
      toast.error('Hold Failed', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleUpload = async (file: File, invoiceId: number) => {
    try {
      const result = await uploadInvoiceDocument(invoiceId, file)
      toast.success('Document Uploaded', {
        description: result.message,
      })
      // Reload invoices and detail
      await loadInvoices()
      if (selectedInvoiceId === invoiceId) {
        await loadInvoiceDetail(invoiceId)
      }
    } catch (error: unknown) {
      toast.error('Upload Failed', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // ─── Build Enhanced Props ──────────────────────────────────
  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId)

  const capabilityWithProps: PageCapability = {
    ...PURCHASE_VERIFICATION_CAPABILITY,
    modes: {
      standard: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.standard,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.standard.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice, loading }
              : {},
        })),
      },
      split: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.split,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.split.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice, loading }
              : panel.id === 'comparison'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onVerify: handleVerify,
                  onReject: handleReject,
                  onHold: handleHold,
                }
              : {},
        })),
      },
      workspace: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.workspace,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.workspace.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice, loading }
              : panel.id === 'system-data'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onVerify: handleVerify,
                  onReject: handleReject,
                  onHold: handleHold,
                }
              : panel.id === 'scanned-document'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onUpload: (file: File) =>
                    selectedInvoiceId && handleUpload(file, selectedInvoiceId),
                }
              : panel.id === 'verification-engine'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onVerify: () => selectedInvoiceId && handleVerify(selectedInvoiceId),
                  onReject: (reason: string) =>
                    selectedInvoiceId && handleReject(selectedInvoiceId, reason),
                  onHold: (reason?: string) =>
                    selectedInvoiceId && handleHold(selectedInvoiceId, reason),
                }
              : {},
        })),
      },
      command: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.command,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.command.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice, loading }
              : panel.id === 'system-data'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onVerify: handleVerify,
                  onReject: handleReject,
                  onHold: handleHold,
                }
              : panel.id === 'scanned-document'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onUpload: (file: File) =>
                    selectedInvoiceId && handleUpload(file, selectedInvoiceId),
                }
              : panel.id === 'verification-engine'
              ? {
                  invoiceDetail,
                  loading: detailLoading,
                  onVerify: () => selectedInvoiceId && handleVerify(selectedInvoiceId),
                  onReject: (reason: string) =>
                    selectedInvoiceId && handleReject(selectedInvoiceId, reason),
                  onHold: (reason?: string) =>
                    selectedInvoiceId && handleHold(selectedInvoiceId, reason),
                }
              : {},
        })),
      },
    },
  }

  return (
    <WorkspaceProvider
      pageId="purchase-verification"
      capability={capabilityWithProps}
      storageKey="purchase-verification-layout"
    >
      <VerificationProvider invoiceId={selectedInvoiceId || undefined}>
        <div className="h-screen flex flex-col bg-app-bg">
          {/* Page Header */}
          <header className="border-b border-app-border/30 bg-app-surface shadow-sm shrink-0">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-app-primary to-app-primary/70 flex items-center justify-center shadow-lg">
                  <FileCheck size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-app-text">
                    Purchase Invoice Verification
                  </h1>
                  <p className="text-xs text-app-text-muted">
                    3-way match: PO → GRN → Supplier Invoice
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-app-text-muted">
                    <Loader2 size={14} className="animate-spin" />
                    Loading...
                  </div>
                )}

                {/* Workspace Mode Switcher */}
                <WorkspaceSwitcher />
              </div>
            </div>
          </header>

          {/* Main Content Area (workspace system manages layout) */}
          <main className="flex-1 overflow-hidden p-6">
            <WorkspaceLayoutShell />
          </main>
        </div>
      </VerificationProvider>
    </WorkspaceProvider>
  )
}
