'use client'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SaasPlan, SaasUsageData } from '@/types/erp'

/* ── Plan Switch Confirmation Dialog ── */
export function PlanSwitchDialog({ plan, usage, switching, onConfirm, onCancel }: {
 plan: SaasPlan | null; usage: SaasUsageData | null
 switching: boolean; onConfirm: () => void; onCancel: () => void
}) {
 return (
 <Dialog open={!!plan} onOpenChange={(open) => !open && onCancel()}>
 <DialogContent className="rounded-2xl max-w-md">
 <DialogHeader><DialogTitle className="font-black text-lg">Confirm Plan Switch</DialogTitle></DialogHeader>
 {plan && (() => {
 const currentPrice = parseFloat(String(usage?.plan?.monthly_price ?? '0'))
 const targetPrice = parseFloat(String((plan as any).price ?? (plan as any).monthly_price ?? '0'))
 const isUpgrade = targetPrice > currentPrice
 const isDowngrade = targetPrice < currentPrice
 const diff = Math.abs(targetPrice - currentPrice)
 return (
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-app-background border border-app-border space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-xs text-app-muted-foreground font-bold uppercase">Current Plan</span>
 <span className="font-bold text-app-foreground">{usage?.plan?.name || 'Free Tier'}</span>
 </div>
 <div className="border-t border-dashed border-app-border" />
 <div className="flex justify-between items-center">
 <span className="text-xs text-app-muted-foreground font-bold uppercase">New Plan</span>
 <span className="font-black text-app-foreground">{plan.name}</span>
 </div>
 </div>
 <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{
 borderColor: isUpgrade ? 'var(--app-success)' : isDowngrade ? 'var(--app-warning)' : '#9ca3af',
 background: isUpgrade ? '#ecfdf5' : isDowngrade ? '#fffbeb' : '#f9fafb'
 }}>
 <div>
 <Badge className={isUpgrade ? 'bg-app-primary-light text-app-success' : isDowngrade ? 'bg-app-warning-bg text-app-warning' : 'bg-app-surface-2 text-app-muted-foreground'}>
 {isUpgrade ? '⬆ Upgrade' : isDowngrade ? '⬇ Downgrade' : '↔ Switch'}
 </Badge>
 </div>
 <div className="text-right">
 <p className="text-xs text-app-muted-foreground font-bold">Price {isUpgrade ? 'Increase' : isDowngrade ? 'Decrease' : 'Change'}</p>
 <p className={`text-lg font-black ${isUpgrade ? 'text-app-primary' : isDowngrade ? 'text-app-warning' : 'text-app-muted-foreground'}`}>
 {isUpgrade ? '+' : isDowngrade ? '-' : ''}${diff.toFixed(2)}/mo
 </p>
 </div>
 </div>
 {isUpgrade && (
 <p className="text-[11px] text-app-muted-foreground">A <strong>Purchase Invoice</strong> of ${diff.toFixed(2)}/mo will be generated for the price difference.</p>
 )}
 {isDowngrade && (
 <p className="text-[11px] text-app-muted-foreground">A <strong>Credit Note</strong> of ${diff.toFixed(2)}/mo will be issued, plus a new <strong>Purchase Invoice</strong> for ${targetPrice.toFixed(2)}/mo.</p>
 )}
 {Array.isArray((plan as any).modules) && (plan as any).modules.length > 0 && (
 <div>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mb-1">Modules in new plan:</p>
 <div className="flex flex-wrap gap-1">
 {(plan as any).modules.map((m: string) => (
 <Badge key={m} className="bg-app-background text-app-muted-foreground text-[9px] border border-app-border uppercase">{m}</Badge>
 ))}
 </div>
 </div>
 )}
 </div>
 )
 })()}
 <DialogFooter>
 <Button variant="ghost" onClick={onCancel} className="rounded-xl">Cancel</Button>
 <Button
 disabled={switching}
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold"
 onClick={onConfirm}>
 {switching ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
 Confirm Switch
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
