// @ts-nocheck
'use client'

/**
 * PURCHASE INVOICE VERIFICATION PAGE
 * Pilot implementation of Workspace Layout System
 * Supports: standard, split, workspace, command modes
 */

import { useState } from 'react'
import { WorkspaceProvider } from '@/lib/workspace/WorkspaceContext'
import { VerificationProvider } from '@/lib/workspace/VerificationContext'
import { WorkspaceLayoutShell } from '@/components/workspace/WorkspaceLayoutShell'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { InvoiceListPanel } from './panels/InvoiceListPanel'
import { ComparisonPanel } from './panels/ComparisonPanel'
import { DocumentViewerPanel } from './panels/DocumentViewerPanel'
import { ActionsPanel } from './panels/ActionsPanel'
import { PageCapability } from '@/lib/workspace/types'
import { FileCheck } from 'lucide-react'

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
          props: {}
        }
      ],
      layout: 'single'
    },

    // Split: list + comparison (wide screens)
    split: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'comparison',
          component: ComparisonPanel,
          title: '3-Way Match',
          defaultCollapsed: false,
          props: {}
        }
      ],
      layout: 'grid',
      gridTemplate: '400px 1fr'
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
          props: {}
        },
        {
          id: 'system-data',
          component: ComparisonPanel,
          title: 'System Data (Editable)',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'scanned-document',
          component: DocumentViewerPanel,
          title: 'Scanned Invoice',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'verification-engine',
          component: ActionsPanel,
          title: 'Verification',
          defaultCollapsed: false,
          props: {}
        }
      ],
      layout: 'grid',
      gridTemplate: '300px 1fr 1fr 380px' // DUAL CENTER PANELS
    },

    // Command: FULL POWER VERIFICATION MODE (4-5 panels)
    // List | System Data | Scanned Document | Verification | Audit
    command: {
      panels: [
        {
          id: 'invoice-list',
          component: InvoiceListPanel,
          title: 'Invoices',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'system-data',
          component: ComparisonPanel,
          title: 'System Data (Editable)',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'scanned-document',
          component: DocumentViewerPanel,
          title: 'Scanned Invoice (Interactive)',
          defaultCollapsed: false,
          props: {}
        },
        {
          id: 'verification-engine',
          component: ActionsPanel,
          title: 'Verification Engine',
          defaultCollapsed: false,
          props: {}
        }
      ],
      layout: 'grid',
      gridTemplate: '300px 1fr 1fr 400px' // DUAL VERIFICATION
    }
  }
}

// ─── Mock Invoice Data ──────────────────────────────────────────
const MOCK_INVOICES = [
  {
    id: 1,
    invoice_number: 'SUP-INV-2024-001',
    supplier_name: 'ABC Electronics Ltd',
    po_number: 'PO-2024-1234',
    receipt_number: 'GRN-2024-0567',
    invoice_date: '2024-03-15',
    received_date: '2024-03-14',
    total_amount: 15750.00,
    po_total: 15750.00,
    status: 'VERIFIED',
    document_url: null,
    invoice_items: [
      { product_name: 'Laptop Dell XPS 15', quantity: 10, unit_price: 1250.00, subtotal: 12500.00 },
      { product_name: 'USB-C Dock', quantity: 10, unit_price: 125.00, subtotal: 1250.00 },
      { product_name: 'Laptop Bag', quantity: 10, unit_price: 200.00, subtotal: 2000.00 }
    ]
  },
  {
    id: 2,
    invoice_number: 'SUP-INV-2024-002',
    supplier_name: 'XYZ Office Supplies',
    po_number: 'PO-2024-1235',
    receipt_number: 'GRN-2024-0568',
    invoice_date: '2024-03-16',
    received_date: '2024-03-15',
    total_amount: 4250.00,
    po_total: 4000.00,
    status: 'DISCREPANCY',
    document_url: '/mock/invoice-002.pdf',
    invoice_items: [
      { product_name: 'Office Chair Executive', quantity: 15, unit_price: 250.00, subtotal: 3750.00 },
      { product_name: 'Desk Lamp LED', quantity: 20, unit_price: 25.00, subtotal: 500.00 }
    ]
  },
  {
    id: 3,
    invoice_number: 'SUP-INV-2024-003',
    supplier_name: 'Global Tech Partners',
    po_number: 'PO-2024-1236',
    receipt_number: null,
    invoice_date: '2024-03-17',
    received_date: null,
    total_amount: 28500.00,
    po_total: 28500.00,
    status: 'PENDING',
    document_url: '/mock/invoice-003.pdf',
    invoice_items: [
      { product_name: 'Server Dell PowerEdge R740', quantity: 2, unit_price: 12500.00, subtotal: 25000.00 },
      { product_name: 'Rack Mount Kit', quantity: 2, unit_price: 350.00, subtotal: 700.00 },
      { product_name: 'Power Distribution Unit', quantity: 2, unit_price: 1400.00, subtotal: 2800.00 }
    ]
  },
  {
    id: 4,
    invoice_number: 'SUP-INV-2024-004',
    supplier_name: 'Stationery World',
    po_number: 'PO-2024-1237',
    receipt_number: 'GRN-2024-0569',
    invoice_date: '2024-03-17',
    received_date: '2024-03-16',
    total_amount: 875.50,
    po_total: 875.50,
    status: 'PENDING',
    document_url: null,
    invoice_items: [
      { product_name: 'Printer Paper A4 (Box)', quantity: 50, unit_price: 12.50, subtotal: 625.00 },
      { product_name: 'Stapler Heavy Duty', quantity: 25, unit_price: 8.50, subtotal: 212.50 },
      { product_name: 'Pen Blue (Box of 50)', quantity: 5, unit_price: 7.60, subtotal: 38.00 }
    ]
  },
  {
    id: 5,
    invoice_number: 'SUP-INV-2024-005',
    supplier_name: 'Premium IT Solutions',
    po_number: 'PO-2024-1238',
    receipt_number: 'GRN-2024-0570',
    invoice_date: '2024-03-18',
    received_date: '2024-03-17',
    total_amount: 19200.00,
    po_total: 18500.00,
    status: 'DISCREPANCY',
    document_url: '/mock/invoice-005.pdf',
    invoice_items: [
      { product_name: 'Monitor 27" 4K Dell U2720Q', quantity: 20, unit_price: 850.00, subtotal: 17000.00 },
      { product_name: 'Monitor Arm Mount', quantity: 20, unit_price: 110.00, subtotal: 2200.00 }
    ]
  },
  {
    id: 6,
    invoice_number: 'SUP-INV-2024-006',
    supplier_name: 'Metro Furniture Group',
    po_number: 'PO-2024-1239',
    receipt_number: null,
    invoice_date: '2024-03-18',
    received_date: null,
    total_amount: 12450.00,
    po_total: 12450.00,
    status: 'PENDING',
    document_url: '/mock/invoice-006.pdf',
    invoice_items: [
      { product_name: 'Standing Desk Adjustable', quantity: 8, unit_price: 1200.00, subtotal: 9600.00 },
      { product_name: 'Cable Management Tray', quantity: 8, unit_price: 45.00, subtotal: 360.00 },
      { product_name: 'Anti-Fatigue Mat', quantity: 8, unit_price: 310.00, subtotal: 2490.00 }
    ]
  }
]

// ─── Main Page Component ────────────────────────────────────────
export default function PurchaseInvoiceVerificationPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [invoices, setInvoices] = useState(MOCK_INVOICES)

  // ─── Event Handlers ────────────────────────────────────────
  const handleSelectInvoice = (invoice: any) => {
    setSelectedInvoice(invoice)
  }

  const handleVerify = (invoiceId: number) => {
    setInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId ? { ...inv, status: 'VERIFIED' } : inv
      )
    )
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice({ ...selectedInvoice, status: 'VERIFIED' })
    }
  }

  const handleReject = (invoiceId: number) => {
    setInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId ? { ...inv, status: 'REJECTED' } : inv
      )
    )
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice({ ...selectedInvoice, status: 'REJECTED' })
    }
  }

  const handleSave = (editedValues: any) => {
    if (!selectedInvoice) return
    const updatedInvoice = { ...selectedInvoice, ...editedValues }
    setInvoices(prev =>
      prev.map(inv => (inv.id === selectedInvoice.id ? updatedInvoice : inv))
    )
    setSelectedInvoice(updatedInvoice)
  }

  const handleAddNote = (invoiceId: number, noteText: string) => {
    console.log('Note added to invoice', invoiceId, noteText)
  }

  const handleApprove = (invoiceId: number) => {
    handleVerify(invoiceId)
  }

  const handleUpload = (file: File, invoiceId?: number) => {
    console.log('Uploaded file:', file.name, 'for invoice', invoiceId)
    // TODO: Upload to cloud storage and update document_url
  }

  // ─── Build Enhanced Props ──────────────────────────────────
  // Clone capability and inject runtime props into each panel
  const capabilityWithProps: PageCapability = {
    ...PURCHASE_VERIFICATION_CAPABILITY,
    modes: {
      standard: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.standard,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.standard.panels.map(
          panel => ({
            ...panel,
            props:
              panel.id === 'invoice-list'
                ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice }
                : {}
          })
        )
      },
      split: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.split,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.split.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice }
              : panel.id === 'comparison'
              ? {
                  invoice: selectedInvoice,
                  onVerify: handleVerify,
                  onReject: handleReject,
                  onSave: handleSave
                }
              : {}
        }))
      },
      workspace: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.workspace,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.workspace.panels.map(
          panel => ({
            ...panel,
            props:
              panel.id === 'invoice-list'
                ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice }
                : panel.id === 'system-data'
                ? {
                    invoice: selectedInvoice,
                    onVerify: handleVerify,
                    onReject: handleReject,
                    onSave: handleSave
                  }
                : panel.id === 'scanned-document'
                ? { invoice: selectedInvoice, onUpload: handleUpload }
                : panel.id === 'verification-engine'
                ? {
                    invoice: selectedInvoice,
                    onAddNote: handleAddNote,
                    onApprove: handleApprove,
                    onReject: handleReject
                  }
                : {}
          })
        )
      },
      command: {
        ...PURCHASE_VERIFICATION_CAPABILITY.modes.command,
        panels: PURCHASE_VERIFICATION_CAPABILITY.modes.command.panels.map(panel => ({
          ...panel,
          props:
            panel.id === 'invoice-list'
              ? { invoices, selectedInvoice, onSelectInvoice: handleSelectInvoice }
              : panel.id === 'system-data'
              ? {
                  invoice: selectedInvoice,
                  onVerify: handleVerify,
                  onReject: handleReject,
                  onSave: handleSave
                }
              : panel.id === 'scanned-document'
              ? { invoice: selectedInvoice, onUpload: handleUpload }
              : panel.id === 'verification-engine'
              ? {
                  invoice: selectedInvoice,
                  onAddNote: handleAddNote,
                  onApprove: handleApprove,
                  onReject: handleReject
                }
              : {}
        }))
      }
    }
  }

  return (
    <WorkspaceProvider
      pageId="purchase-verification"
      capability={capabilityWithProps}
      storageKey="purchase-verification-layout"
    >
      <VerificationProvider invoiceId={selectedInvoice?.id}>
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

              {/* Workspace Mode Switcher */}
              <WorkspaceSwitcher />
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
