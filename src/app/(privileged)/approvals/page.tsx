'use client'

/**
 * UNIFIED APPROVAL CENTER
 * ========================
 * Central hub for all pending approvals across the organization
 *
 * Features:
 * - Aggregate view of all pending items
 * - Quick approve/reject actions
 * - Priority-based sorting
 * - Department/category filtering
 * - Real-time counters
 */

import { useState, type ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ClipboardList,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Filter,
  ArrowUpDown
} from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string
  type: 'PAYMENT' | 'PURCHASE' | 'EXPENSE' | 'USER' | 'OPERATIONAL' | 'LEAVE'
  title: string
  amount?: number
  requester: string
  date: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  detailUrl: string
}

// ─── Mock Data ──────────────────────────────────────────────────────

const mockApprovals: ApprovalItem[] = [
  {
    id: 'PAY-001',
    type: 'PAYMENT',
    title: 'Supplier Payment - ABC Electronics',
    amount: 125000,
    requester: 'Finance Team',
    date: '2026-03-17',
    priority: 'HIGH',
    status: 'PENDING',
    detailUrl: '/finance/payments/1'
  },
  {
    id: 'PO-2024-1234',
    type: 'PURCHASE',
    title: 'Purchase Order - Office Supplies',
    amount: 15750,
    requester: 'Admin Dept',
    date: '2026-03-17',
    priority: 'MEDIUM',
    status: 'PENDING',
    detailUrl: '/purchases/purchase-orders/1234'
  },
  {
    id: 'EXP-445',
    type: 'EXPENSE',
    title: 'Travel Expense - Dubai Conference',
    amount: 8500,
    requester: 'John Smith',
    date: '2026-03-16',
    priority: 'MEDIUM',
    status: 'PENDING',
    detailUrl: '/finance/expenses/445'
  },
  {
    id: 'USER-789',
    type: 'USER',
    title: 'New User Registration - Sarah Ahmed',
    requester: 'HR Department',
    date: '2026-03-16',
    priority: 'LOW',
    status: 'PENDING',
    detailUrl: '/users/approvals'
  },
  {
    id: 'OP-REQ-112',
    type: 'OPERATIONAL',
    title: 'Stock Adjustment Request - Warehouse A',
    requester: 'Inventory Manager',
    date: '2026-03-15',
    priority: 'HIGH',
    status: 'PENDING',
    detailUrl: '/inventory/requests/112'
  },
  {
    id: 'LEAVE-334',
    type: 'LEAVE',
    title: 'Annual Leave - Ahmed Hassan (5 days)',
    requester: 'Ahmed Hassan',
    date: '2026-03-15',
    priority: 'LOW',
    status: 'PENDING',
    detailUrl: '/hr/leaves'
  },
]

// ─── Config ─────────────────────────────────────────────────────────

type ApprovalType = ApprovalItem['type']
type ApprovalPriority = ApprovalItem['priority']

interface TypeConfigEntry {
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
  color: string
  bg: string
}

const TYPE_CONFIG: Record<ApprovalType, TypeConfigEntry> = {
  PAYMENT: { label: 'Payment', icon: DollarSign, color: 'text-app-success', bg: 'bg-app-success-soft' },
  PURCHASE: { label: 'Purchase', icon: ShoppingCart, color: 'text-app-info', bg: 'bg-app-info-soft' },
  EXPENSE: { label: 'Expense', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  USER: { label: 'User', icon: Users, color: 'text-app-warning', bg: 'bg-app-warning-soft' },
  OPERATIONAL: { label: 'Operational', icon: Package, color: 'text-app-info', bg: 'bg-app-info-soft' },
  LEAVE: { label: 'Leave', icon: Calendar, color: 'text-app-error', bg: 'bg-app-error-soft' },
}

const PRIORITY_CONFIG: Record<ApprovalPriority, { label: string; color: string }> = {
  HIGH: { label: 'High', color: 'bg-app-error-soft text-app-error border-app-error' },
  MEDIUM: { label: 'Medium', color: 'bg-app-warning-soft text-app-warning border-app-warning' },
  LOW: { label: 'Low', color: 'bg-app-surface-2 text-app-foreground border-app-border' },
}

// ─── Component ──────────────────────────────────────────────────────

export default function ApprovalCenterPage() {
  const { fmt } = useCurrency()
  const [approvals, setApprovals] = useState<ApprovalItem[]>(mockApprovals)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // Filter approvals
  const filteredApprovals = approvals.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.requester.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTab = activeTab === 'all' || item.type === activeTab.toUpperCase()

    return matchesSearch && matchesTab && item.status === 'PENDING'
  })

  // Calculate stats
  const stats = {
    total: approvals.filter(a => a.status === 'PENDING').length,
    high: approvals.filter(a => a.status === 'PENDING' && a.priority === 'HIGH').length,
    amount: approvals
      .filter(a => a.status === 'PENDING' && a.amount)
      .reduce((sum, a) => sum + (a.amount || 0), 0),
    byType: (Object.keys(TYPE_CONFIG) as ApprovalType[]).map(type => ({
      type,
      count: approvals.filter(a => a.status === 'PENDING' && a.type === type).length
    }))
  }

  // Actions
  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'APPROVED' as const } : a
    ))
    toast.success('Item approved successfully')
  }

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'REJECTED' as const } : a
    ))
    toast.error('Item rejected')
  }

  return (
    <div className="min-h-screen bg-app-bg p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-app-primary to-app-primary/70 flex items-center justify-center shadow-lg">
            <ClipboardList size={24} className="text-white" />
          </div>
          <div>
            <h1>Approval Center</h1>
            <p className="text-sm text-app-muted-foreground">Unified dashboard for all pending approvals</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-app-border/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-app-muted-foreground uppercase mb-1">Pending Items</p>
                <p className="text-3xl font-black text-app-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-app-info-soft flex items-center justify-center">
                <Clock size={24} className="text-app-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-app-border/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-app-muted-foreground uppercase mb-1">High Priority</p>
                <p className="text-3xl font-black text-app-error">{stats.high}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-app-error-soft flex items-center justify-center">
                <AlertTriangle size={24} className="text-app-error" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-app-border/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-app-muted-foreground uppercase mb-1">Total Amount</p>
                <p className="text-3xl font-black text-app-success">{fmt(stats.amount)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-app-success-soft flex items-center justify-center">
                <DollarSign size={24} className="text-app-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-app-border/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-app-muted-foreground uppercase mb-1">Categories</p>
                <p className="text-3xl font-black text-app-foreground">{stats.byType.filter(t => t.count > 0).length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <TrendingUp size={24} className="text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border-app-border/30 mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <Input
              placeholder="Search approvals by ID, title, or requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          {stats.byType.filter(t => t.count > 0).map(({ type, count }) => (
            <TabsTrigger key={type} value={type.toLowerCase()}>
              {TYPE_CONFIG[type].label} ({count})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="space-y-3">
            {filteredApprovals.length === 0 ? (
              <Card className="border-app-border/30">
                <CardContent className="p-12 text-center">
                  <CheckCircle2 size={48} className="mx-auto mb-4 text-app-success opacity-30" />
                  <p className="text-sm font-bold text-app-muted-foreground">No pending approvals</p>
                  <p className="text-xs text-app-muted-foreground mt-1">All caught up! 🎉</p>
                </CardContent>
              </Card>
            ) : (
              filteredApprovals.map((item) => {
                const config = TYPE_CONFIG[item.type]
                const Icon = config.icon

                return (
                  <Card key={item.id} className="border-app-border/30 hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                            <Icon size={20} className={config.color} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] font-bold">
                                {item.id}
                              </Badge>
                              <Badge className={PRIORITY_CONFIG[item.priority].color}>
                                {PRIORITY_CONFIG[item.priority].label}
                              </Badge>
                              <Badge variant="outline" className={`${config.color} ${config.bg}`}>
                                {config.label}
                              </Badge>
                            </div>
                            <h3 className="mb-1">{item.title}</h3>
                            <div className="flex items-center gap-4 text-xs text-app-muted-foreground">
                              <span>👤 {item.requester}</span>
                              <span>📅 {new Date(item.date).toLocaleDateString()}</span>
                              {item.amount && <span className="font-bold text-app-success">{fmt(item.amount)}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-9"
                          >
                            <Link href={item.detailUrl}>
                              View Details
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(item.id)}
                            className="h-9 bg-app-success hover:bg-app-success text-white"
                          >
                            <CheckCircle2 size={14} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(item.id)}
                            className="h-9 border-app-error text-app-error hover:bg-app-error-soft"
                          >
                            <XCircle size={14} className="mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
