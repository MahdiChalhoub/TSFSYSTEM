// @ts-nocheck
'use client'

import { Users, MapPin, FileText, HardDrive, ShieldCheck, AlertTriangle, UserCircle, Mail, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UsageMeter } from './UsageMeter'
import { useRouter } from 'next/navigation'
import type { SaasOrganization, SaasUsageData, SaasBillingData, SaasPlan } from '@/types/erp'

export function BillingTab({ org, usage, billing, onPlanSwitch }: {
 org: SaasOrganization
 usage: SaasUsageData | null
 billing: SaasBillingData
 onPlanSwitch: (plan: SaasPlan) => void
}) {
 const router = useRouter()
 const usageAny = usage as any
 return (
 <div className="space-y-6">
 {/* Top Row: Subscription + Client Account */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Subscription Card */}
 <Card className="border-app-success/30 bg-app-primary-light/30 shadow-sm">
 <CardHeader>
 <div className="flex justify-between items-start">
 <div>
 <CardTitle className="text-xl font-bold text-app-success">Subscription</CardTitle>
 <CardDescription className="text-app-success">Current active plan</CardDescription>
 </div>
 <Badge className="bg-app-primary text-app-foreground text-lg px-4 py-1">{usage?.plan?.name || 'Free Tier'}</Badge>
 </div>
 </CardHeader>
 <CardContent>
 <div className="p-5 bg-app-surface rounded-2xl border border-app-success/30/50 flex items-center justify-between">
 <div>
 <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Status</p>
 {org.is_active ? (
 <div className="flex items-center gap-2 text-app-primary font-black text-lg"><ShieldCheck size={20} /> ACTIVE</div>
 ) : (
 <div className="flex items-center gap-2 text-app-error font-black text-lg"><AlertTriangle size={20} /> SUSPENDED</div>
 )}
 </div>
 <div className="text-right">
 <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Monthly</p>
 <p className="text-2xl font-black text-app-foreground">${usage?.plan?.monthly_price || '0.00'}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 {/* Client Account / Balance Card */}
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <CardTitle className="text-xl font-bold flex items-center gap-2">
 <UserCircle size={18} className="text-app-muted-foreground" /> Account Owner
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {billing.client ? (
 <div className="p-4 bg-app-background rounded-2xl border border-app-border space-y-2">
 <p className="font-black text-app-foreground text-lg">{billing.client.full_name}</p>
 {billing.client.company_name && (
 <p className="text-sm text-app-muted-foreground">{billing.client.company_name}</p>
 )}
 <div className="flex items-center gap-4 text-xs text-app-muted-foreground">
 {billing.client.email && <span className="flex items-center gap-1"><Mail size={10} /> {billing.client.email}</span>}
 {billing.client.phone && <span>{billing.client.phone}</span>}
 </div>
 </div>
 ) : (
 <div className="p-4 bg-app-warning-bg rounded-2xl border border-app-warning/30 text-center">
 <p className="text-sm text-app-warning font-bold">No client assigned</p>
 <p className="text-xs text-app-warning mt-1">Assign from the Overview tab</p>
 </div>
 )}
 {/* Balance Summary */}
 <div className="grid grid-cols-3 gap-2">
 <div className="p-3 bg-app-primary-light rounded-xl border border-app-success/30 text-center">
 <p className="text-[9px] text-app-primary font-bold uppercase tracking-wider">Total Paid</p>
 <p className="text-lg font-black text-app-success">${billing.balance.total_paid}</p>
 </div>
 <div className="p-3 bg-app-warning-bg rounded-xl border border-app-warning/30 text-center">
 <p className="text-[9px] text-app-warning font-bold uppercase tracking-wider">Credits</p>
 <p className="text-lg font-black text-app-warning">${billing.balance.total_credits}</p>
 </div>
 <div className="p-3 bg-app-background rounded-xl border border-app-border text-center">
 <p className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-wider">Net Balance</p>
 <p className="text-lg font-black text-app-foreground">${billing.balance.net_balance}</p>
 </div>
 </div>
 {/* CRM Profile Link */}
 {billing.client && (
 <Button
 variant="outline"
 className="w-full border-app-primary/30 text-app-primary hover:bg-app-primary/5 rounded-xl font-bold"
 onClick={() => {
 if (billing.client!.crm_contact_id) {
 router.push(`/crm/contacts/${billing.client!.crm_contact_id}`)
 } else {
 router.push(`/crm/contacts?search=${encodeURIComponent(billing.client!.email ?? '')}`)
 }
 }}
 >
 <Users size={14} className="mr-2" /> View CRM Profile
 </Button>
 )}
 </CardContent>
 </Card>
 </div>
 {/* Available Plans */}
 {Array.isArray(usageAny?.available_plans) && usageAny.available_plans.length > 0 && (
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <div className="flex justify-between items-center">
 <CardTitle className="font-bold">Available Plans</CardTitle>
 <Badge className="bg-app-surface-2 text-app-muted-foreground text-[10px]">{usageAny.available_plans.length} plans</Badge>
 </div>
 <CardDescription className="text-xs text-app-muted-foreground">Select a plan to assign to this organization. Plans are managed from the <a href="/subscription-plans" className="text-app-primary underline hover:text-app-success font-bold">Subscription Plans</a> page.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {usageAny.available_plans.map((p: Record<string, any>) => {
 const isCurrent = usageAny.plan?.id === p.id
 const isCustom = parseFloat(p.monthly_price) < 0
 const isFree = parseFloat(p.monthly_price) === 0
 const limits = p.limits || {}
 return (
 <div key={p.id} className={`p-5 rounded-2xl border-2 transition-all flex flex-col ${isCurrent
 ? 'border-app-success bg-app-primary-light/50 shadow-md'
 : 'border-app-border hover:border-app-border hover:shadow-sm bg-app-surface'}`}>
 <div className="flex items-start justify-between mb-3">
 <div>
 <p className="font-black text-app-foreground">{p.name}</p>
 {p.category && <span className="text-[10px] text-app-muted-foreground font-medium">{p.category}</span>}
 </div>
 <div className="flex flex-col items-end gap-1">
 {isCurrent && <Badge className="bg-app-primary-light text-app-success text-[9px]">Current</Badge>}
 {p.is_public && <Badge className="bg-app-info-bg text-app-info text-[9px]">🌐 Public</Badge>}
 {p.trial_days > 0 && <Badge className="bg-app-warning-bg text-app-warning text-[9px]">{p.trial_days}d Trial</Badge>}
 </div>
 </div>
 {/* Price */}
 <div className="mb-3">
 {isCustom ? (
 <span className="text-xl font-black text-purple-600">Custom</span>
 ) : isFree ? (
 <span className="text-xl font-black text-app-primary">Free</span>
 ) : (
 <>
 <span className="text-2xl font-black text-app-foreground">${parseFloat(p.monthly_price).toFixed(0)}</span>
 <span className="text-xs text-app-muted-foreground font-bold ml-1">/mo</span>
 </>
 )}
 </div>
 {p.description && <p className="text-[11px] text-app-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
 {p.modules?.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-3">
 {p.modules.slice(0, 4).map((m: string) => (
 <Badge key={m} className="bg-app-background text-app-muted-foreground text-[9px] border border-app-border uppercase">{m}</Badge>
 ))}
 {p.modules.length > 4 && (
 <Badge className="bg-app-background text-app-muted-foreground text-[9px] border border-app-border">+{p.modules.length - 4}</Badge>
 )}
 </div>
 )}
 {Object.keys(limits).length > 0 && (
 <div className="grid grid-cols-2 gap-1 mb-3 text-[10px] text-app-muted-foreground">
 {limits.max_users != null && <span>👥 {limits.max_users < 0 ? '∞' : limits.max_users} users</span>}
 {limits.max_sites != null && <span>🏢 {limits.max_sites < 0 ? '∞' : limits.max_sites} sites</span>}
 </div>
 )}
 <div className="flex-1" />
 {!isCurrent && (
 <Button size="sm"
 className="w-full mt-3 rounded-xl bg-app-primary hover:bg-app-primary text-app-foreground font-bold text-xs"
 onClick={() => onPlanSwitch(p as unknown as SaasPlan)}>
 Switch to This Plan
 </Button>
 )}
 {isCurrent && (
 <div className="text-center mt-3 text-[11px] text-app-primary font-black uppercase tracking-wider">
 ✓ Active Plan
 </div>
 )}
 </div>
 )
 })}
 </div>
 </CardContent>
 </Card>
 )}
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <div className="flex justify-between items-center">
 <CardTitle className="font-bold">Payment History</CardTitle>
 <Badge className="bg-app-surface-2 text-app-muted-foreground text-[9px]">Subscription Payments</Badge>
 </div>
 </CardHeader>
 <CardContent>
 {billing.history.length === 0 ? (
 <div className="text-center py-12 text-app-muted-foreground text-sm italic">No billing records found for this organization.</div>
 ) : (
 <div className="space-y-2">
 {billing.history.map((p: Record<string, any>) => (
 <div key={p.id} className="flex items-center justify-between p-4 bg-app-background rounded-xl border border-app-border hover:border-app-border transition-all">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <Badge className={{
 'PURCHASE': 'bg-app-primary-light text-app-primary border-app-success/30',
 'CREDIT_NOTE': 'bg-app-warning-bg text-app-warning border-app-warning/30',
 'RENEWAL': 'bg-app-info-bg text-app-info border-app-info/30',
 }[p.type as string] || 'bg-app-background text-app-muted-foreground'}
 >{p.type === 'CREDIT_NOTE' ? 'Credit Note' : p.type === 'PURCHASE' ? 'Purchase' : p.type || 'Invoice'}</Badge>
 <p className="font-bold text-app-foreground text-sm">{p.plan_name}</p>
 {p.previous_plan_name && (
 <span className="text-[10px] text-app-muted-foreground">← from {p.previous_plan_name}</span>
 )}
 </div>
 {p.notes && <p className="text-[11px] text-app-muted-foreground line-clamp-1">{p.notes}</p>}
 <p className="text-xs text-app-muted-foreground mt-0.5">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString()}</p>
 </div>
 <div className="flex items-center gap-3">
 <span className={`font-black ${p.type === 'CREDIT_NOTE' ? 'text-app-warning' : 'text-app-foreground'}`}>
 {p.type === 'CREDIT_NOTE' ? '-' : ''}${p.amount}
 </span>
 <Badge className={{
 'COMPLETED': 'bg-app-primary-light text-app-primary border-app-success/30',
 'PAID': 'bg-app-primary-light text-app-primary border-app-success/30',
 'PENDING': 'bg-app-warning-bg text-app-warning border-app-warning/30',
 }[p.status as string] || 'bg-app-error-bg text-app-error border-app-error/30'}
 >{p.status}</Badge>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
