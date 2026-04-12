// @ts-nocheck
'use client'

import { Users, MapPin, FileText, HardDrive, AlertTriangle, Activity, ChevronRight, ShieldCheck, ShieldOff, UserCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UsageMeter } from './UsageMeter'
import type { SaasOrganization, SaasUsageData } from '@/types/erp'

export function OverviewTab({ org, usage, modules, activeModules, encryptionStatus, togglingEncryption,
 onManagePlan, onManageModules, onAssignClient, onToggleEncryption,
}: {
 org: SaasOrganization
 usage: SaasUsageData | null
 modules: any[]
 activeModules: number
 encryptionStatus: Record<string, any> | null
 togglingEncryption: boolean
 onManagePlan: () => void
 onManageModules: () => void
 onAssignClient: () => void
 onToggleEncryption: () => void
}) {
 return (
 <div className="space-y-6">
 {/* Integrity Warnings */}
 {Array.isArray(usage?.warnings) && usage!.warnings.length > 0 && (
 <div className="space-y-2">
 {usage!.warnings.map((w: Record<string, any>) => {
 const styles: Record<string, string> = {
 critical: 'bg-app-error-bg border-app-error text-app-error',
 warning: 'bg-app-warning-bg border-app-warning text-app-warning',
 info: 'bg-app-info-bg border-app-info text-app-info',
 }
 const icons: Record<string, any> = {
 critical: <AlertTriangle size={14} className="text-app-error shrink-0 mt-0.5" />,
 warning: <AlertTriangle size={14} className="text-app-warning shrink-0 mt-0.5" />,
 info: <Activity size={14} className="text-app-info shrink-0 mt-0.5" />,
 }
 return (
 <div key={w.code} className={`flex items-start gap-3 p-3 rounded-xl border ${styles[w.level as string] || styles.info}`}>
 {icons[w.level as string] || icons.info}
 <div className="min-w-0">
 <p className="font-bold text-sm">{w.message}</p>
 <p className="text-xs opacity-75 mt-0.5">{w.suggestion}</p>
 </div>
 </div>
 )
 })}
 </div>
 )}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Card className="lg:col-span-2 border-app-border shadow-sm">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg font-bold">Resource Overview</CardTitle>
 <CardDescription>Current consumption vs plan limits</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {usage ? (
 <>
 <UsageMeter label="Users" icon={Users} current={usage.users.current} limit={usage.users.limit} percent={usage.users.percent} />
 <UsageMeter label="Sites" icon={MapPin} current={usage.sites.current} limit={usage.sites.limit} percent={usage.sites.percent} />
 <UsageMeter label="Storage" icon={HardDrive} current={usage.storage.current_mb} limit={usage.storage.limit_mb} percent={usage.storage.percent} unit=" MB" />
 <UsageMeter label="Invoices / Month" icon={FileText} current={usage.invoices.current} limit={usage.invoices.limit} percent={usage.invoices.percent} />
 </>
 ) : (
 <div className="py-8 text-center text-app-muted-foreground italic">Usage data unavailable</div>
 )}
 </CardContent>
 </Card>
 <div className="space-y-6">
 <Card className="border-app-success/30 bg-app-primary-light/30 shadow-sm">
 <CardHeader><CardTitle className="text-lg font-bold text-app-success">Current Plan</CardTitle></CardHeader>
 <CardContent className="space-y-4">
 <div className="text-center py-4">
 <div className="text-3xl font-black text-app-success">
 ${usage?.plan?.monthly_price || '0.00'}<span className="text-sm font-medium text-app-primary">/mo</span>
 </div>
 <p className="text-app-primary font-bold mt-1">{usage?.plan?.name || 'Free Tier'}</p>
 {usage?.plan?.annual_price && usage.plan.annual_price !== '0.00' && (
 <p className="text-xs text-app-muted-foreground mt-1">${usage.plan.annual_price}/yr</p>
 )}
 {usage?.plan?.expiry && (
 <p className="text-xs text-app-muted-foreground mt-2">Renews: {new Date(usage.plan.expiry).toLocaleDateString()}</p>
 )}
 </div>
 <Button variant="outline" className="w-full border-app-success text-app-success hover:bg-app-primary-light rounded-xl font-bold"
 onClick={onManagePlan}>
 Manage Plan <ChevronRight size={14} />
 </Button>
 </CardContent>
 </Card>
 <Card className="border-app-border shadow-sm">
 <CardHeader className="pb-2"><CardTitle className="text-lg font-bold">Modules</CardTitle></CardHeader>
 <CardContent>
 <div className="text-center py-4">
 <div className="text-3xl font-black text-app-foreground">{activeModules}</div>
 <p className="text-xs text-app-muted-foreground">of {modules.length} active</p>
 </div>
 <Button variant="outline" className="w-full border-app-border text-app-muted-foreground hover:bg-app-background rounded-xl font-bold"
 onClick={onManageModules}>
 Manage Modules <ChevronRight size={14} />
 </Button>
 </CardContent>
 </Card>
 {/* Client / Account Owner Card */}
 <Card className="border-app-border shadow-sm">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg font-bold flex items-center gap-2">
 <UserCircle size={16} className="text-app-muted-foreground" /> Account Owner
 </CardTitle>
 </CardHeader>
 <CardContent>
 {usage?.client ? (
 <div className="space-y-2">
 <p className="font-black text-app-foreground">{usage.client.full_name}</p>
 {usage.client.company_name && (
 <p className="text-xs text-app-muted-foreground">{usage.client.company_name}</p>
 )}
 <p className="text-xs text-app-muted-foreground">{usage.client.email}</p>
 {usage.client.phone && (
 <p className="text-xs text-app-muted-foreground">{usage.client.phone}</p>
 )}
 <Button variant="outline" size="sm"
 className="w-full border-app-border text-app-muted-foreground hover:bg-app-background rounded-xl text-xs mt-2"
 onClick={onAssignClient}>
 Change Client
 </Button>
 </div>
 ) : (
 <div className="text-center py-3">
 <p className="text-xs text-app-muted-foreground italic mb-3">No client assigned</p>
 <Button size="sm"
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold text-xs"
 onClick={onAssignClient}>
 Assign Client
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 {/* Encryption Card */}
 <Card className={`border-app-border shadow-sm ${encryptionStatus?.encryption_enabled ? 'border-app-success bg-app-primary-light/20' : ''}`}>
 <CardHeader className="pb-2">
 <CardTitle className="text-lg font-bold flex items-center gap-2">
 {encryptionStatus?.encryption_enabled
 ? <ShieldCheck size={16} className="text-app-primary" />
 : <ShieldOff size={16} className="text-app-muted-foreground" />}
 AES-256 Encryption
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-center py-2">
 <div className={`text-sm font-bold ${encryptionStatus?.encryption_enabled ? 'text-app-success' : 'text-app-muted-foreground'}`}>
 {encryptionStatus === null ? 'Loading...' : encryptionStatus?.encryption_enabled ? 'Active' : 'Disabled'}
 </div>
 {encryptionStatus?.activated_at && (
 <p className="text-[10px] text-app-muted-foreground mt-1">Since {new Date(encryptionStatus.activated_at).toLocaleDateString()}</p>
 )}
 </div>
 <Button
 variant="outline"
 size="sm"
 disabled={togglingEncryption}
 className={`w-full rounded-xl font-bold text-xs mt-2 ${encryptionStatus?.encryption_enabled
 ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
 : 'border-app-success text-app-success hover:bg-app-primary-light'}`}
 onClick={onToggleEncryption}>
 {togglingEncryption ? 'Processing...' : encryptionStatus?.encryption_enabled ? 'Deactivate' : 'Activate'}
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 )
}
