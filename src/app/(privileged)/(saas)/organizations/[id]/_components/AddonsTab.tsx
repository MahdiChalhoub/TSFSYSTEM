'use client'

import { Puzzle, Package, ShoppingCart, XCircle, Loader2, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SaasAddonData } from '@/types/erp'

export function AddonsTab({ addons, orgId, purchasingAddon, cancellingAddon, onPurchase, onCancel }: {
 addons: SaasAddonData
 orgId: string
 purchasingAddon: string | null
 cancellingAddon: string | null
 onPurchase: (addonId: string, addonName: string) => void
 onCancel: (purchaseId: string, addonName: string) => void
}) {
 return (
 <div className="space-y-6">
 {/* Active Purchased Add-ons */}
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <CardTitle className="text-lg font-bold">Active Add-ons</CardTitle>
 <CardDescription>Add-ons currently purchased for this organization</CardDescription>
 </CardHeader>
 <CardContent>
 {addons.purchased?.filter((p: Record<string, any>) => p.status === 'active').length > 0 ? (
 <div className="space-y-3">
 {addons.purchased.filter((p: Record<string, any>) => p.status === 'active').map((p: Record<string, any>) => (
 <div key={p.id} className="flex items-center justify-between p-4 bg-app-primary-light/50 rounded-xl border border-app-success/30 hover:border-app-success transition-all">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-app-primary-light rounded-xl flex items-center justify-center">
 <Puzzle size={18} className="text-app-primary" />
 </div>
 <div>
 <p className="font-bold text-app-foreground">{p.addon_name}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <Badge className="bg-app-primary-light text-app-primary border-app-success/30 text-[10px]">{p.addon_type}</Badge>
 <span className="text-xs text-app-muted-foreground">×{p.quantity}</span>
 <span className="text-xs text-app-muted-foreground">• {p.billing_cycle}</span>
 </div>
 <p className="text-[10px] text-app-muted-foreground mt-1">Purchased {p.purchased_at ? new Date(p.purchased_at).toLocaleDateString() : '—'}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="text-right">
 <p className="font-black text-app-foreground">${p.effective_price}</p>
 <p className="text-[10px] text-app-muted-foreground">{p.billing_cycle === 'ANNUAL' ? '/yr' : '/mo'}</p>
 </div>
 <Button
 size="sm"
 variant="ghost"
 className="text-app-error hover:text-app-error hover:bg-app-error-bg rounded-xl"
 disabled={cancellingAddon === p.id}
 onClick={() => onCancel(p.id, p.addon_name)}
 >
 {cancellingAddon === p.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
 </Button>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-app-muted-foreground">
 <Puzzle size={32} className="mx-auto mb-2 opacity-30" />
 <p className="font-medium">No active add-ons</p>
 <p className="text-xs mt-1">Purchase add-ons below to extend capabilities</p>
 </div>
 )}
 </CardContent>
 </Card>
 {/* Cancelled / Expired History */}
 {addons.purchased?.filter((p: Record<string, any>) => p.status !== 'active').length > 0 && (
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <CardTitle className="text-sm font-bold text-app-muted-foreground">History</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {addons.purchased.filter((p: Record<string, any>) => p.status !== 'active').map((p: Record<string, any>) => (
 <div key={p.id} className="flex items-center justify-between p-3 bg-app-background rounded-xl border border-app-border opacity-60">
 <div>
 <p className="font-medium text-app-muted-foreground text-sm">{p.addon_name}</p>
 <p className="text-[10px] text-app-muted-foreground">
 {p.status === 'cancelled' && p.cancelled_at
 ? `Cancelled ${new Date(p.cancelled_at).toLocaleDateString()}`
 : p.status}
 </p>
 </div>
 <Badge className="bg-app-surface-2 text-app-muted-foreground border-app-border text-[10px]">{p.status}</Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 {/* Available Add-ons for Purchase */}
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <CardTitle className="text-lg font-bold">Available Add-ons</CardTitle>
 <CardDescription>Add-ons available for this organization's plan</CardDescription>
 </CardHeader>
 <CardContent>
 {addons.available?.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {addons.available.map((a: Record<string, any>) => (
 <div key={a.id} className={`p-4 rounded-xl border transition-all ${a.already_purchased
 ? 'bg-app-background border-app-border opacity-50'
 : 'bg-app-surface border-app-border hover:border-app-primary/30 hover:shadow-sm'
 }`}>
 <div className="flex items-start justify-between">
 <div>
 <p className="font-bold text-app-foreground">{a.name}</p>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant="outline" className="text-[10px]">{a.addon_type}</Badge>
 <span className="text-xs text-app-muted-foreground">+{a.quantity} units</span>
 </div>
 </div>
 <div className="text-right">
 <p className="font-black text-app-foreground">${a.monthly_price}</p>
 <p className="text-[10px] text-app-muted-foreground">/month</p>
 {a.annual_price !== '0.00' && (
 <p className="text-[10px] text-app-muted-foreground">${a.annual_price}/yr</p>
 )}
 </div>
 </div>
 <Button
 size="sm"
 className={`w-full mt-3 rounded-xl font-bold text-xs ${a.already_purchased
 ? 'bg-app-border text-app-muted-foreground cursor-not-allowed'
 : 'bg-app-primary hover:bg-app-primary text-app-foreground'
 }`}
 disabled={a.already_purchased || purchasingAddon === a.id}
 onClick={() => onPurchase(a.id, a.name)}
 >
 {purchasingAddon === a.id
 ? <Loader2 size={14} className="animate-spin mr-1" />
 : a.already_purchased
 ? <Check size={14} className="mr-1" />
 : <ShoppingCart size={14} className="mr-1" />}
 {a.already_purchased ? 'Already Purchased' : 'Purchase'}
 </Button>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-app-muted-foreground">
 <Package size={32} className="mx-auto mb-2 opacity-30" />
 <p className="font-medium">No add-ons available</p>
 <p className="text-xs mt-1">Create add-ons in Subscription Plans first</p>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
