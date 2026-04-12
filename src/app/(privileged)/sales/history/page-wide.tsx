// @ts-nocheck
'use client'

/**
 * Sales History Page - WIDE-SCREEN ENHANCED
 * ==========================================
 * Features:
 * - Tier 1 (1280-1919px): Single column list (current design)
 * - Tier 2 (1920-2559px): List + Preview panel
 * - Tier 3 (2560-3439px): KPIs + List + Preview
 * - Layout switcher for user preference
 */

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesOrder } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import {
  History, Printer, User, Search,
  Filter, Hash,
  ArrowUpRight, RefreshCw,
  DollarSign, Activity, AlertCircle,
  MoreHorizontal, Eye, Edit3, Trash2, Truck, Clipboard,
  Package, CreditCard, Undo2, Link2, MessageSquare, Mail, BookOpen
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { deleteOrder, lockOrder, verifyOrder } from "../actions"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  STATUS_CONFIG, TYPE_CONFIG,
  ORDER_STATUS_CONFIG, DELIVERY_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG, INVOICE_STATUS_CONFIG
} from '@/types/sales'
import { SalesKpiCard } from '@/components/modules/sales/SalesKpiCard'
import { ConfirmOrderDialog } from '@/components/modules/sales/ConfirmOrderDialog'
import { OrderPreviewPanel } from '@/components/modules/sales/OrderPreviewPanel'
import { LayoutSwitcher, useLayoutMode, type LayoutMode } from '@/components/layouts/LayoutSwitcher'
import { useAdmin } from '@/context/AdminContext'

export default function OrderHistoryPageWide() {
  const { viewScope } = useAdmin()
  const { fmt } = useCurrency()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const layoutMode = useLayoutMode('sales-history-layout')

  const settings = useListViewSettings('sales_history', {
    columns: [
      'actions', 'created_at', 'invoice_number', 'contact_name',
      'order_status', 'delivery_status', 'payment_status', 'invoice_status',
      'total_amount', 'total_paid', 'amount_due',
      'is_locked'
    ],
    pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
  })

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmOrderTargetId, setConfirmOrderTargetId] = useState<number | null>(null)

  useEffect(() => { loadOrders() }, [viewScope])

  async function loadOrders() {
    setLoading(true)
    try {
      const { erpFetch } = await import("@/lib/erp-api")
      const data = await erpFetch(`pos/orders/?type=SALE&scope=${viewScope}`, { cache: 'no-store' })
      const ordersList = Array.isArray(data) ? data : data.results || []
      setOrders(ordersList)

      // Auto-select first order on wide screens
      if (ordersList.length > 0 && !selectedOrder && layoutMode !== 'single') {
        setSelectedOrder(ordersList[0])
      }
    } catch {
      toast.error("Failed to load transaction history")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenConfirmOrder = (orderId: number) => {
    setConfirmOrderTargetId(orderId)
  }

  const executeConfirmWorkflow = async (warehouseId: string | null) => {
    if (!confirmOrderTargetId) return
    toast.loading('Confirming order...')
    try {
      const mod = await import('../workflow-actions')
      const result = await mod.triggerOrderWorkflow(confirmOrderTargetId, {
        action: 'confirm',
        warehouse_id: warehouseId ? warehouseId : undefined
      })
      toast.dismiss()
      if (result.success) {
        toast.success('✓ Order confirmed')
        loadOrders()
      } else {
        toast.error(result.error || 'Confirmation failed')
      }
    } catch (e: any) {
      toast.dismiss()
      toast.error(e?.message || 'Confirmation failed')
    } finally {
      setConfirmOrderTargetId(null)
    }
  }

  const handleDelete = async (id: number) => {
    toast.promise(deleteOrder(id), {
      loading: 'Suppression en cours...',
      success: () => {
        loadOrders()
        return 'Facture supprimée avec succès'
      },
      error: 'Échec de la suppression'
    })
    setConfirmDeleteId(null)
  }

  const toggleLock = async (id: number, current: boolean) => {
    const res = await lockOrder(id, !current)
    if (res.success) {
      toast.success(!current ? 'Transaction verrouillée' : 'Transaction déverrouillée')
      loadOrders()
    }
  }

  const toggleVerify = async (id: number, current: boolean) => {
    const res = await verifyOrder(id, !current)
    if (res.success) {
      toast.success(!current ? 'Transaction vérifiée' : 'Transaction non-vérifiée')
      loadOrders()
    }
  }

  async function downloadInvoice(orderId: number, ref: string) {
    toast.loading(`Generating invoice for #${ref}...`)
    try {
      const { erpFetch } = await import("@/lib/erp-api")
      const blob = await erpFetch(`pos/${orderId}/invoice-pdf/`)
      if (!(blob instanceof Blob)) throw new Error("Invalid response")
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Invoice_${ref || orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.dismiss()
      toast.success("Document dispatched successfully")
    } catch (e) {
      toast.dismiss()
      toast.error("Dispatch failed")
    }
  }

  async function handleWorkflow(orderId: number, action: string, label: string) {
    toast.loading(`${label}...`)
    try {
      const mod = await import('../workflow-actions')
      const result = await mod.triggerOrderWorkflow(orderId, { action: action as any })
      toast.dismiss()
      if (result.success) {
        toast.success(`✓ ${label}`)
        loadOrders()
      } else {
        toast.error(result.error || 'Action failed')
      }
    } catch (e: any) {
      toast.dismiss()
      toast.error(e?.message || 'Action failed')
    }
  }

  const handleRowClick = (order: SalesOrder) => {
    setSelectedOrder(order)
  }

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      key: 'actions',
      label: 'Action',
      align: 'center',
      render: (order) => (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-indigo-600 hover:bg-indigo-50" asChild title="View in Ledger">
            <Link href={`/finance/ledger?q=${order.invoice_number || order.ref_code || order.id}`}>
              <BookOpen size={16} />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-app-surface-2">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-app-border shadow-xl">
              <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-app-text-faint px-3 py-2">
                Sales Management
              </DropdownMenuLabel>
              <DropdownMenuItem asChild className="focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer py-2.5">
                <Link href={`/sales/${order.id}`} className="flex items-center gap-2 w-full">
                  <Eye size={14} /> View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadInvoice(order.id, order.ref_code || order.id)} className="focus:bg-app-bg cursor-pointer py-2.5 text-indigo-600 font-semibold">
                <Printer size={14} className="mr-2" /> Print Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirmDeleteId(order.id)} className="focus:bg-rose-50 focus:text-rose-600 cursor-pointer py-2.5">
                <Trash2 size={14} className="mr-2" /> Delete
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Workflow actions */}
              {(!order.order_status || order.order_status === 'DRAFT') && (
                <DropdownMenuItem
                  onClick={() => handleOpenConfirmOrder(order.id)}
                  className="focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer py-2.5"
                >
                  <Package size={14} className="mr-2" /> Confirm Order
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (order) => (
        <div className="text-xs text-app-text-muted">
          {new Date(order.created_at).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'invoice_number',
      label: 'Invoice #',
      sortable: true,
      render: (order) => (
        <div className="flex items-center gap-2">
          <Hash size={12} className="text-app-primary" />
          <span className="text-xs font-bold text-app-text">
            {order.invoice_number || order.ref_code || `#${order.id}`}
          </span>
        </div>
      )
    },
    {
      key: 'contact_name',
      label: 'Client',
      sortable: true,
      render: (order) => (
        <div className="flex items-center gap-2">
          <User size={12} className="text-app-text-muted" />
          <span className="text-xs font-semibold text-app-text">
            {order.contact_name || 'Walk-In'}
          </span>
        </div>
      )
    },
    {
      key: 'order_status',
      label: 'Order Status',
      render: (order) => {
        const config = ORDER_STATUS_CONFIG[order.order_status as keyof typeof ORDER_STATUS_CONFIG]
        return config ? <Badge className={config.color}>{config.label}</Badge> : null
      }
    },
    {
      key: 'delivery_status',
      label: 'Delivery',
      render: (order) => {
        const config = DELIVERY_STATUS_CONFIG[order.delivery_status as keyof typeof DELIVERY_STATUS_CONFIG]
        return config ? <Badge className={config.color}>{config.label}</Badge> : null
      }
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (order) => {
        const config = PAYMENT_STATUS_CONFIG[order.payment_status as keyof typeof PAYMENT_STATUS_CONFIG]
        return config ? <Badge className={config.color}>{config.label}</Badge> : null
      }
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      align: 'right',
      render: (order) => (
        <span className="text-sm font-black text-app-text tabular-nums">
          {fmt(parseFloat(String(order.total_amount || 0)))}
        </span>
      )
    },
    {
      key: 'total_paid',
      label: 'Paid',
      align: 'right',
      render: (order) => (
        <span className="text-sm font-bold text-emerald-600 tabular-nums">
          {fmt(parseFloat(String(order.total_paid || 0)))}
        </span>
      )
    },
    {
      key: 'amount_due',
      label: 'Due',
      sortable: true,
      align: 'right',
      render: (order) => {
        const due = parseFloat(String(order.amount_due || 0))
        return (
          <span className={`text-sm font-bold tabular-nums ${due > 0 ? 'text-rose-600' : 'text-app-text-muted'}`}>
            {fmt(due)}
          </span>
        )
      }
    }
  ], [fmt])

  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      !searchQuery ||
      (o.ref_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [orders, searchQuery])

  const stats = useMemo(() => {
    const vol = filteredOrders.reduce((acc, o) => acc + parseFloat(String(o.total_amount || 0)), 0)
    const exposure = filteredOrders.filter(o => o.status !== 'CANCELLED').reduce((acc, o) => acc + parseFloat(String(o.total_amount || 0)), 0)
    return { volume: vol, exposure, count: filteredOrders.length }
  }, [filteredOrders])

  // Determine layout classes based on mode
  const getLayoutClasses = () => {
    if (layoutMode === 'single') {
      return 'max-w-[1400px] mx-auto'
    }
    if (layoutMode === 'dual') {
      return 'max-w-none grid grid-cols-[1fr_400px] gap-6'
    }
    if (layoutMode === 'triple') {
      return 'max-w-none grid grid-cols-[300px_1fr_400px] gap-6'
    }
    if (layoutMode === 'quad') {
      return 'max-w-none grid grid-cols-[280px_1fr_400px_320px] gap-6'
    }
    return 'max-w-[1400px] mx-auto'
  }

  return (
    <div className="w-full min-h-screen p-8 space-y-8 animate-in fade-in duration-500 bg-app-surface/30">
      {/* Header */}
      <header className="flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
              Node: POS Registry
            </Badge>
            <span className="text-[10px] font-bold text-app-faint uppercase tracking-widest flex items-center gap-1">
              <Activity size={12} /> Transaction Stream
            </span>
          </div>
          <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.8rem] bg-app-bg flex items-center justify-center shadow-2xl shadow-stone-200">
              <History size={32} className="text-app-text" />
            </div>
            Transaction <span className="text-indigo-600">History</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <LayoutSwitcher storageKey="sales-history-layout" />
          <Button onClick={loadOrders} variant="outline" className="h-12 w-12 p-0 rounded-2xl border-app-border text-app-text-faint hover:text-indigo-600 hover:bg-app-bg transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button asChild className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-app-text font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
            <Link href="/sales">
              <ArrowUpRight size={18} /> Terminal
            </Link>
          </Button>
        </div>
      </header>

      {/* Dynamic Layout Container */}
      <div className={getLayoutClasses()}>
        {/* KPI Sidebar (Triple/Quad only) */}
        {(layoutMode === 'triple' || layoutMode === 'quad') && (
          <div className="space-y-4">
            <SalesKpiCard
              icon={<Activity size={20} />}
              badge="VOLUME"
              label="Total Vol"
              value={fmt(stats.volume)}
            />
            <SalesKpiCard
              icon={<DollarSign size={20} />}
              badge="EXPOSURE"
              label="Net Exposure"
              value={fmt(stats.exposure)}
              variant="dark"
            />
            <SalesKpiCard
              icon={<Hash size={20} />}
              badge="COUNT"
              label="Transactions"
              value={`${stats.count}`}
            />
          </div>
        )}

        {/* Main List (Always visible) */}
        <div className={layoutMode === 'single' ? 'space-y-6' : ''}>
          {/* KPI Cards for Single layout */}
          {layoutMode === 'single' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SalesKpiCard
                icon={<Activity size={24} />}
                badge="VOLUME"
                label="Total Transaction Vol"
                value={fmt(stats.volume)}
              />
              <SalesKpiCard
                icon={<DollarSign size={24} />}
                badge="EXPOSURE"
                label="Net Realized Exposure"
                value={fmt(stats.exposure)}
                variant="dark"
              />
              <SalesKpiCard
                icon={<Hash size={24} />}
                badge="COUNT"
                label="Transaction Count"
                value={`${stats.count}`}
              />
            </div>
          )}

          <TypicalListView
            title="Registre Opérationnel des Ventes"
            data={filteredOrders}
            loading={loading}
            getRowId={(o) => o.id}
            columns={columns}
            selection={{
              selectedIds,
              onSelectionChange: setSelectedIds
            }}
            visibleColumns={settings.visibleColumns}
            onToggleColumn={settings.toggleColumn}
            pageSize={settings.pageSize}
            onPageSizeChange={settings.setPageSize}
            sortKey={settings.sortKey}
            sortDir={settings.sortDir}
            onSort={settings.setSort}
            className="rounded-[2.5rem] border-0 shadow-2xl shadow-stone-200/50 overflow-hidden bg-app-surface"
            headerExtra={
              <div className="flex items-center gap-3">
                <div className="relative w-80">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-faint" />
                  <Input
                    placeholder="Rechercher par n° facture, client..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 rounded-[1rem] text-sm border-0 bg-app-surface-2 focus-visible:ring-indigo-500/30 transition-all focus:bg-app-surface focus:shadow-sm"
                  />
                </div>
                <Button variant="outline" className="h-12 rounded-[1rem] border-app-border text-app-text-muted gap-2 font-bold px-5 hover:bg-app-surface hover:shadow-sm">
                  <Filter size={14} /> Filtres
                </Button>
              </div>
            }
          />
        </div>

        {/* Preview Panel (Dual/Triple/Quad) */}
        {layoutMode !== 'single' && (
          <div className="sticky top-8 h-[calc(100vh-10rem)]">
            <OrderPreviewPanel
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
            />
          </div>
        )}

        {/* Analytics Panel (Quad only) */}
        {layoutMode === 'quad' && (
          <div className="space-y-4 sticky top-8">
            <div className="bg-app-surface rounded-2xl p-6 border border-app-border/30">
              <h3 className="text-sm font-bold mb-4 text-app-text">Quick Stats</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Today's Sales</span>
                  <span className="font-bold">--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-muted">This Week</span>
                  <span className="font-bold">--</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-muted">This Month</span>
                  <span className="font-bold">--</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Supprimer la Facture ?"
        description="Cette action est irréversible."
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId) }}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
      />

      <ConfirmOrderDialog
        open={confirmOrderTargetId !== null}
        onOpenChange={(open) => !open && setConfirmOrderTargetId(null)}
        onConfirm={executeConfirmWorkflow}
        defaultWarehouseId={(orders.find(o => o.id === confirmOrderTargetId)?.site as any)?.id}
      />
    </div>
  )
}
