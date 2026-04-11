'use client'

import React, { useState, useTransition } from 'react'
import { LifecycleBar, LifecycleStatus, ApprovalEntry } from '@/components/common/LifecycleBar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency-core'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
    Calendar, User, Tag, MapPin, Receipt,
    HandCoins, Clock, Info, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InvoiceClientPageProps {
    invoice: any
    currency: string
}

export function InvoiceClientPage({ invoice, currency }: InvoiceClientPageProps) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const fmt = (n: number) => formatCurrency(n, currency)

    const handleLifecycleAction = async (action: string, params?: any) => {
        startTransition(async () => {
            try {
                const { erpFetch } = await import('@/lib/erp-api')
                // Generic handler for lifecycle actions provided by LifecycleViewSetMixin
                await erpFetch(`invoices/${invoice.id}/${action}/`, {
                    method: 'POST',
                    body: params ? JSON.stringify(params) : undefined
                })

                toast.success(`Action '${action}' successful`)
                router.refresh()
            } catch (err: any) {
                toast.error(err.message || `Failed to perform ${action}`)
            }
        })
    }

    const canAction = (action: string, level?: number) => {
        // Simple permission check client-side (real checks are on backend)
        // For now, if the status matches the LifecycleBar transitions, we allow the click
        return true
    }

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* Main Lifecycle Bar */}
                <LifecycleBar
                    status={invoice.status as LifecycleStatus}
                    approvals={invoice.approvals || []}
                    onAction={handleLifecycleAction}
                    canAction={canAction}
                    isLoading={isPending}
                />

                {/* Items Table */}
                <div className="bg-app-surface rounded-[2rem] shadow-xl border border-app-border overflow-hidden animate-in fade-in duration-500 delay-150">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center justify-between font-black text-[10px] text-app-muted-foreground uppercase tracking-widest">
                        <span>Line Items</span>
                        <span>{invoice.lines?.length || 0} Products</span>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-app-muted/5">
                                <tr className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    <th className="p-6">Description</th>
                                    <th className="p-6 text-center">Qty</th>
                                    <th className="p-6 text-right">Unit Price</th>
                                    <th className="p-6 text-right">Tax</th>
                                    <th className="p-6 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border">
                                {invoice.lines?.map((line: any) => (
                                    <tr key={line.id} className="text-sm hover:bg-app-primary/5 transition-colors group">
                                        <td className="p-6">
                                            <div className="font-bold text-app-foreground group-hover:text-app-primary transition-colors">{line.description}</div>
                                            {line.product_name && (
                                                <div className="text-[10px] text-app-muted-foreground font-mono mt-1">
                                                    SKU: {line.product_sku || 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-6 text-center font-bold text-app-foreground">{line.quantity}</td>
                                        <td className="p-6 text-right font-medium text-app-muted-foreground">
                                            {fmt(line.unit_price)}
                                        </td>
                                        <td className="p-6 text-right text-app-muted-foreground">
                                            {fmt(line.tax_amount || 0)}
                                        </td>
                                        <td className="p-6 text-right font-black text-app-foreground">
                                            {fmt(line.line_total_ttc)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Footer */}
                <div className="app-glass text-app-foreground p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex gap-12">
                        <div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 italic">Subtotal HT</div>
                            <div className="text-2xl font-black">{fmt(invoice.subtotal_ht)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 italic">VAT Amount</div>
                            <div className="text-2xl font-black text-app-primary">{fmt(invoice.tax_amount)}</div>
                        </div>
                    </div>
                    <div className="text-center md:text-right">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 italic tracking-[0.2em]">Grand Total TTC</div>
                        <div className="text-6xl font-black text-app-foreground tracking-tighter italic">
                            {fmt(invoice.total_amount)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-700">
                <Card className="p-6 rounded-[2rem] border border-app-border bg-app-surface/50 backdrop-blur-sm space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-app-primary/10 text-app-primary rounded-2xl">
                            <User size={20} />
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Contact Information</div>
                            <div className="text-sm font-black text-app-foreground truncate">{invoice.contact_display || invoice.contact_name}</div>
                            <div className="text-[10px] text-app-muted-foreground mt-1 truncate">{invoice.contact_email || 'No email provided'}</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-app-info/10 text-app-info rounded-2xl">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Timeline</div>
                            <div className="text-sm font-black text-app-foreground">Issued: {invoice.issue_date}</div>
                            <div className={cn(
                                "text-[10px] font-bold mt-1",
                                invoice.is_overdue ? "text-app-error" : "text-app-success"
                            )}>
                                Due: {invoice.due_date} {invoice.is_overdue && '(OVERDUE)'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-app-warning/10 text-app-warning rounded-2xl">
                            <Tag size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Conditions</div>
                            <div className="text-sm font-black text-app-foreground uppercase">{invoice.payment_terms || 'NET_30'}</div>
                            <div className="text-[10px] text-app-muted-foreground mt-1">Prices are {invoice.display_mode || 'TTC'}</div>
                        </div>
                    </div>
                </Card>

                {/* Important Notes */}
                {(invoice.notes || invoice.internal_notes) && (
                    <div className="bg-app-background/50 border border-app-border p-6 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-2 text-app-muted-foreground">
                            <Info size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Document Notes</span>
                        </div>
                        {invoice.notes && (
                            <div className="text-xs text-app-foreground leading-relaxed">
                                <span className="font-bold opacity-60">Public:</span> {invoice.notes}
                            </div>
                        )}
                        {invoice.internal_notes && (
                            <div className="text-xs text-app-warning leading-relaxed border-t border-app-border pt-4">
                                <span className="font-bold opacity-60">Internal:</span> {invoice.internal_notes}
                            </div>
                        )}
                    </div>
                )}

                {/* Reversal Info */}
                {invoice.status === 'REVERSED' && (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-[2rem] flex items-start gap-3">
                        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-1">Reversed Document</span>
                            <p className="text-xs text-orange-700 font-medium">
                                This document has been reversed. Offsetting accounting entries have been generated.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
