// @ts-nocheck
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/lib/utils/currency'
import {
  User, Calendar, Package, Truck, CreditCard, FileText,
  Hash, DollarSign, Clock, Tag, MapPin, Phone, Mail
} from 'lucide-react'
import type { SalesOrder } from '@/types/erp'
import {
  ORDER_STATUS_CONFIG, DELIVERY_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG, INVOICE_STATUS_CONFIG
} from '@/types/sales'

interface OrderPreviewPanelProps {
  order: SalesOrder | null
  onClose?: () => void
}

export function OrderPreviewPanel({ order, onClose }: OrderPreviewPanelProps) {
  const { fmt } = useCurrency()

  if (!order) {
    return (
      <Card className="h-full flex items-center justify-center border-app-border/30">
        <div className="text-center text-app-text-muted p-8">
          <Package size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-bold">Select an order to preview</p>
          <p className="text-xs mt-1 opacity-60">Click on any order from the list</p>
        </div>
      </Card>
    )
  }

  const orderStatus = ORDER_STATUS_CONFIG[order.order_status as keyof typeof ORDER_STATUS_CONFIG]
  const deliveryStatus = DELIVERY_STATUS_CONFIG[order.delivery_status as keyof typeof DELIVERY_STATUS_CONFIG]
  const paymentStatus = PAYMENT_STATUS_CONFIG[order.payment_status as keyof typeof PAYMENT_STATUS_CONFIG]
  const invoiceStatus = INVOICE_STATUS_CONFIG[order.invoice_status as keyof typeof INVOICE_STATUS_CONFIG]

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <Card className="border-app-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Hash size={16} className="text-app-primary" />
                <CardTitle className="text-lg font-black">
                  {order.invoice_number || order.ref_code || `#${order.id}`}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-app-text-muted">
                <Calendar size={12} />
                {new Date(order.created_at).toLocaleDateString()}
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                ×
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status Badges */}
          <div className="grid grid-cols-2 gap-2">
            {orderStatus && (
              <div className="text-center">
                <p className="text-[9px] text-app-text-faint uppercase tracking-wider mb-1">Order</p>
                <Badge className={orderStatus.color}>{orderStatus.label}</Badge>
              </div>
            )}
            {deliveryStatus && (
              <div className="text-center">
                <p className="text-[9px] text-app-text-faint uppercase tracking-wider mb-1">Delivery</p>
                <Badge className={deliveryStatus.color}>{deliveryStatus.label}</Badge>
              </div>
            )}
            {paymentStatus && (
              <div className="text-center">
                <p className="text-[9px] text-app-text-faint uppercase tracking-wider mb-1">Payment</p>
                <Badge className={paymentStatus.color}>{paymentStatus.label}</Badge>
              </div>
            )}
            {invoiceStatus && (
              <div className="text-center">
                <p className="text-[9px] text-app-text-faint uppercase tracking-wider mb-1">Invoice</p>
                <Badge className={invoiceStatus.color}>{invoiceStatus.label}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer Info */}
      <Card className="border-app-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <User size={14} className="text-app-primary" />
            Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="font-bold text-app-text">{order.contact_name || 'Walk-In'}</div>
          {order.contact && (
            <>
              {(order.contact as any).phone && (
                <div className="flex items-center gap-2 text-xs text-app-text-muted">
                  <Phone size={12} />
                  {(order.contact as any).phone}
                </div>
              )}
              {(order.contact as any).email && (
                <div className="flex items-center gap-2 text-xs text-app-text-muted">
                  <Mail size={12} />
                  {(order.contact as any).email}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Lines */}
      <Card className="border-app-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package size={14} className="text-app-primary" />
            Items ({order.lines?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {order.lines?.map((line: any, i: number) => (
              <div key={i} className="flex items-start justify-between py-2 border-b border-app-border/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">
                    {line.product_name || `Product #${line.product}`}
                  </p>
                  <p className="text-xs text-app-text-muted">
                    {line.quantity} × {fmt(parseFloat(line.unit_price))}
                  </p>
                </div>
                <div className="text-sm font-bold text-app-text">
                  {fmt(parseFloat(line.subtotal))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="border-app-border/30 bg-app-surface-2">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-app-text-muted">Subtotal</span>
              <span className="font-bold">{fmt(parseFloat(String(order.subtotal || 0)))}</span>
            </div>
            {order.discount_amount && parseFloat(String(order.discount_amount)) > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Discount</span>
                <span className="font-bold">-{fmt(parseFloat(String(order.discount_amount)))}</span>
              </div>
            )}
            {order.tax_amount && parseFloat(String(order.tax_amount)) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-app-text-muted">Tax</span>
                <span className="font-bold">{fmt(parseFloat(String(order.tax_amount)))}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black pt-2 border-t border-app-border">
              <span>Total</span>
              <span className="text-app-primary">{fmt(parseFloat(String(order.total_amount)))}</span>
            </div>
            {order.total_paid && parseFloat(String(order.total_paid)) > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Paid</span>
                  <span className="font-bold">{fmt(parseFloat(String(order.total_paid)))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-app-text-muted">Due</span>
                  <span className="font-bold text-rose-600">
                    {fmt(parseFloat(String(order.amount_due || 0)))}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(order.notes || order.staff_notes) && (
        <Card className="border-app-border/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText size={14} className="text-app-primary" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.notes && (
              <div>
                <p className="text-[9px] text-app-text-faint uppercase mb-1">Customer Note</p>
                <p className="text-xs text-app-text">{order.notes}</p>
              </div>
            )}
            {order.staff_notes && (
              <div>
                <p className="text-[9px] text-amber-600/60 uppercase mb-1">Staff Note</p>
                <p className="text-xs text-amber-600">{order.staff_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
