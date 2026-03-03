'use client'
import { useEffect, useState, useCallback } from "react"
import { SaasOrganization, SaasUsageData, SaasBillingData, SaasAddonData, SaasPlan, SaasModule, SaasUser, SaasSite } from "@/types/erp"
import { useParams, useRouter } from "next/navigation"
import { getOrganization, getOrgUsage, getOrgBilling, getOrgModules, toggleOrgModule, updateModuleFeatures, changeOrgPlan, getOrgUsers, createOrgUser, resetOrgUserPassword, getOrgSites, createOrgSite, toggleOrgSite, listClients, createClient, setOrgClient, getOrgAddons, purchaseAddon, cancelAddon, getOrgEncryptionStatus, toggleOrgEncryption } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
 ArrowLeft, Users, MapPin, FileText, HardDrive, Package, Settings, Shield,
 AlertTriangle, Loader2, ToggleLeft, ToggleRight, Crown, Layers, Activity,
 CreditCard, TrendingUp, ChevronRight, Plus, KeyRound,
 UserCog, Eye, EyeOff, Check, Building2, Power, UserCircle, Mail,
 Puzzle, ShoppingCart, XCircle, ShieldCheck, ShieldOff
} from "lucide-react"
// ─── Usage Meter ─────────────────────────────────────────────────────────────
function UsageMeter({ label, icon: Icon, current, limit, percent, unit = '' }: {
 label: string; icon: React.ElementType; current: number; limit: number; percent: number; unit?: string
}) {
 const isWarning = percent >= 80
 const isDanger = percent >= 95
 const barColor = isDanger ? 'bg-app-error' : isWarning ? 'bg-app-warning' : 'bg-app-primary'
 const bgColor = isDanger ? 'bg-app-error-bg border-app-error/30' : isWarning ? 'bg-app-warning-bg border-app-warning/30' : 'bg-app-surface border-app-border'
 return (
 <div className={`p-5 rounded-2xl border transition-all ${bgColor}`}>
 <div className="app-page flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Icon size={16} className={isDanger ? 'text-app-error' : isWarning ? 'text-app-warning' : 'text-app-muted-foreground'} />
 <span className="text-xs font-bold uppercase tracking-wider text-app-muted-foreground">{label}</span>
 </div>
 <span className="text-sm font-black text-app-foreground">
 {current}{unit} <span className="text-app-muted-foreground font-medium">/ {limit}{unit}</span>
 </span>
 </div>
 <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
 </div>
 {isDanger && (
 <p className="text-[10px] text-app-error font-bold mt-2 flex items-center gap-1">
 <AlertTriangle size={10} /> Approaching limit — consider upgrading
 </p>
 )}
 </div>
 )
}
// ─── Module Card ─────────────────────────────────────────────────────────────
function ModuleCard({ module, onToggle, toggling, onFeatureToggle }: {
 module: Record<string, any>; onToggle: (code: string, status: string) => void; toggling: string | null
 onFeatureToggle: (code: string, featureCode: string, enabled: boolean) => void
}) {
 const isInstalled = module.status === 'INSTALLED'
 const isCore = module.is_core
 return (
 <div className={`p-5 rounded-2xl border transition-all group ${isInstalled
 ? 'bg-app-surface border-app-success/30 hover:border-app-success shadow-sm'
 : 'bg-app-background border-app-border hover:border-app-border'
 }`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCore
 ? 'bg-app-primary/5 text-app-primary'
 : isInstalled ? 'bg-app-primary-light text-app-primary' : 'bg-app-surface-2 text-app-muted-foreground'
 }`}>
 {isCore ? <Crown size={18} /> : <Package size={18} />}
 </div>
 <div>
 <h4 className="font-bold text-app-foreground text-sm">{module.name}</h4>
 <p className="text-[10px] text-app-muted-foreground font-mono uppercase tracking-widest">{module.code}</p>
 {module.description && (
 <p className="text-[10px] text-app-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Badge className={isInstalled
 ? "bg-app-primary-light text-app-primary border-app-success/30 text-[10px]"
 : "bg-app-surface-2 text-app-muted-foreground border-app-border text-[10px]"
 }>
 {isInstalled ? 'Active' : 'Inactive'}
 </Badge>
 {isCore ? (
 <div className="text-[9px] text-app-primary font-black uppercase bg-app-primary/5 px-3 py-1.5 rounded-lg border border-app-primary/30">Core</div>
 ) : (
 <button
 onClick={() => onToggle(module.code, module.status)}
 disabled={toggling === module.code}
 className="transition-transform hover:scale-110 disabled:opacity-50"
 >
 {toggling === module.code ? (
 <Loader2 size={24} className="animate-spin text-app-muted-foreground" />
 ) : isInstalled ? (
 <ToggleRight size={28} className="text-app-primary" />
 ) : (
 <ToggleLeft size={28} className="text-app-muted-foreground" />
 )}
 </button>
 )}
 </div>
 </div>
 {/* Feature flags */}
 {isInstalled && module.available_features?.length > 0 && (
 <div className="mt-4 pt-3 border-t border-app-border">
 <p className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-widest mb-2">Capabilities</p>
 <div className="flex flex-wrap gap-1.5">
 {module.available_features.map((f: Record<string, any>) => {
 const fCode = f.code || f
 const fName = f.name || f
 const isActive = module.active_features?.includes(fCode)
 return (
 <button
 key={fCode}
 onClick={() => onFeatureToggle(module.code, fCode, !isActive)}
 className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-all ${isActive
 ? 'bg-app-primary-light text-app-primary border border-app-success/30 hover:bg-app-primary-light'
 : 'bg-app-background text-app-muted-foreground border border-app-border hover:bg-app-surface-2'
 }`}
 >
 {isActive && <Check size={8} className="inline mr-0.5" />}
 {fName}
 </button>
 )
 })}
 </div>
 </div>
 )}
 </div>
 )
}
// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OrganizationDetailPage() {
 const params = useParams()
 const router = useRouter()
 const orgId = params.id as string
 const [org, setOrg] = useState<SaasOrganization | null>(null)
 const [usage, setUsage] = useState<SaasUsageData | null>(null)
 const [billing, setBilling] = useState<SaasBillingData>({ history: [], balance: { total_paid: '0.00', total_credits: '0.00', net_balance: '0.00' }, client: null })
 const [modules, setModules] = useState<SaasModule[]>([])
 const [users, setUsers] = useState<SaasUser[]>([])
 const [sites, setSites] = useState<SaasSite[]>([])
 const [loading, setLoading] = useState(true)
 const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'usage' | 'billing' | 'users' | 'sites' | 'addons'>('overview')
 const [addons, setAddons] = useState<SaasAddonData>({ purchased: [], available: [] })
 const [purchasingAddon, setPurchasingAddon] = useState<string | null>(null)
 const [cancellingAddon, setCancellingAddon] = useState<string | null>(null)
 const [toggling, setToggling] = useState<string | null>(null)
 const [encryptionStatus, setEncryptionStatus] = useState<Record<string, any> | null>(null)
 const [togglingEncryption, setTogglingEncryption] = useState(false)
 // User creation dialog
 const [showCreateUser, setShowCreateUser] = useState(false)
 const [newUser, setNewUser] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', is_superuser: false })
 const [creating, setCreating] = useState(false)
 // Reset password dialog
 const [resetTarget, setResetTarget] = useState<Record<string, unknown> | null>(null)
 const [newPassword, setNewPassword] = useState('')
 const [showPass, setShowPass] = useState(false)
 const [resetting, setResetting] = useState(false)
 // Site creation dialog
 const [showCreateSite, setShowCreateSite] = useState(false)
 const [newSite, setNewSite] = useState({ name: '', code: '', address: '', city: '', phone: '', vat_number: '' })
 const [creatingSite, setCreatingSite] = useState(false)
 // Plan switch confirmation dialog
 const [planSwitchTarget, setPlanSwitchTarget] = useState<SaasPlan | null>(null)
 const [switching, setSwitching] = useState(false)
 // Client assignment
 const [showClientDialog, setShowClientDialog] = useState(false)
 const [allClients, setAllClients] = useState<Record<string, unknown>[]>([])
 const [clientSearch, setClientSearch] = useState('')
 const [showNewClient, setShowNewClient] = useState(false)
 const [newClient, setNewClient] = useState({ first_name: '', last_name: '', email: '', phone: '', company_name: '' })
 const [savingClient, setSavingClient] = useState(false)
 const reloadData = useCallback(async (forceLoading = false) => {
 if (forceLoading) setLoading(true)
 try {
 const [orgData, usageData, billingData, modulesData, usersData, sitesData, addonsData] = await Promise.all([
 getOrganization(orgId),
 getOrgUsage(orgId),
 getOrgBilling(orgId),
 getOrgModules(orgId),
 getOrgUsers(orgId),
 getOrgSites(orgId),
 getOrgAddons(orgId),
 ])
 setOrg(orgData)
 setUsage(usageData)
 setBilling(billingData?.history ? billingData : { history: Array.isArray(billingData) ? billingData : [], balance: { total_paid: '0.00', total_credits: '0.00', net_balance: '0.00' }, client: null })
 setModules(Array.isArray(modulesData) ? modulesData : [])
 setUsers(Array.isArray(usersData) ? usersData : [])
 setSites(Array.isArray(sitesData) ? sitesData : [])
 setAddons(addonsData || { purchased: [], available: [] })
 // Load encryption status separately
 getOrgEncryptionStatus(orgId).then(s => setEncryptionStatus(s)).catch(() => { })
 } catch {
 toast.error("Data synchronization failed")
 } finally {
 if (forceLoading) setLoading(false)
 }
 }, [orgId])

 useEffect(() => {
 reloadData(true)
 }, [reloadData])
 async function handleToggle(code: string, currentStatus: string) {
 setToggling(code)
 try {
 const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
 await toggleOrgModule(orgId, code, action)
 toast.success(`Module ${code} ${action}d`)
 const [modulesData, usageData] = await Promise.all([getOrgModules(orgId), getOrgUsage(orgId)])
 setModules(Array.isArray(modulesData) ? modulesData : [])
 setUsage(usageData)
 } catch { toast.error("Failed to toggle module") }
 finally { setToggling(null) }
 }
 async function handleFeatureToggle(moduleCode: string, featureCode: string, enabled: boolean) {
 const mod = modules.find(m => m.code === moduleCode)
 if (!mod) return
 const current: string[] = (mod.active_features as string[]) || []
 const updated = enabled ? [...current, featureCode] : current.filter((f: string) => f !== featureCode)
 try {
 await updateModuleFeatures(orgId, moduleCode, updated)
 const modulesData = await getOrgModules(orgId)
 setModules(Array.isArray(modulesData) ? modulesData : [])
 toast.success(`Feature ${featureCode} ${enabled ? 'enabled' : 'disabled'}`)
 } catch { toast.error("Failed to update feature") }
 }
 async function handleCreateUser() {
 if (!newUser.username || !newUser.password) return toast.error("Username and password required")
 setCreating(true)
 try {
 const result = await createOrgUser(orgId, newUser)
 toast.success(result.message || 'User created')
 setShowCreateUser(false)
 setNewUser({ username: '', email: '', password: '', first_name: '', last_name: '', is_superuser: false })
 const usersData = await getOrgUsers(orgId)
 setUsers(Array.isArray(usersData) ? usersData : [])
 } catch (e: unknown) {
 let msg = 'Failed to create user'
 try {
 const errText = e instanceof Error ? e.message : String(e)
 const parsed = JSON.parse(errText)
 msg = parsed.error || parsed.detail || errText
 } catch {
 msg = e instanceof Error ? e.message : String(e)
 }
 toast.error(msg)
 } finally { setCreating(false) }
 }
 async function handleResetPassword() {
 if (!newPassword || newPassword.length < 6) return toast.error("Password must be at least 6 characters")
 setResetting(true)
 try {
 const result = await resetOrgUserPassword(orgId, String(resetTarget!.id), newPassword)

 toast.success(result.message || 'Password reset')
 setResetTarget(null)
 setNewPassword('')
 } catch (e: unknown) {
 let msg = 'Failed to reset password'
 try {
 const errText = e instanceof Error ? e.message : String(e)
 const parsed = JSON.parse(errText)
 msg = parsed.error || parsed.detail || errText
 } catch {
 msg = e instanceof Error ? e.message : String(e)
 }
 toast.error(msg)
 } finally { setResetting(false) }
 }
 async function handleCreateSite() {
 if (!newSite.name) return toast.error("Site name is required")
 setCreatingSite(true)
 try {
 const result = await createOrgSite(orgId, newSite)
 toast.success(result.message || 'Site created')
 setShowCreateSite(false)
 setNewSite({ name: '', code: '', address: '', city: '', phone: '', vat_number: '' })
 const sitesData = await getOrgSites(orgId)
 setSites(Array.isArray(sitesData) ? sitesData : [])
 } catch (e: unknown) {
 let msg = 'Failed to create site'
 try {
 const errText = e instanceof Error ? e.message : String(e)
 const parsed = JSON.parse(errText)
 msg = parsed.error || parsed.detail || errText
 } catch {
 msg = e instanceof Error ? e.message : String(e)
 }
 toast.error(msg)
 } finally { setCreatingSite(false) }
 }
 async function handleToggleSite(siteId: string) {
 try {
 const result = await toggleOrgSite(orgId, siteId)
 toast.success(result.message)
 const sitesData = await getOrgSites(orgId)
 setSites(Array.isArray(sitesData) ? sitesData : [])
 } catch { toast.error("Failed to toggle site") }
 }
 if (loading) return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center space-y-4">
 <Loader2 size={40} className="animate-spin text-app-primary mx-auto" />
 <p className="text-app-muted-foreground font-medium text-sm">Loading organization...</p>
 </div>
 </div>
 )
 if (!org) return (
 <div className="p-12 text-center">
 <h2 className="text-xl font-bold text-app-foreground">Organization Not Found</h2>
 <Button variant="ghost" onClick={() => router.push('/organizations')} className="mt-4">← Back to Organizations</Button>
 </div>
 )
 const tabs = [
 { key: 'overview', label: 'Overview', icon: Activity },
 { key: 'modules', label: 'Modules', icon: Layers },
 { key: 'addons', label: `Add-ons (${addons.purchased?.filter((a: Record<string, any>) => a.status === 'active').length || 0})`, icon: Puzzle },
 { key: 'users', label: `Users (${users.length})`, icon: Users },
 { key: 'sites', label: `Sites (${sites.length})`, icon: Building2 },
 { key: 'usage', label: 'Usage', icon: TrendingUp },
 { key: 'billing', label: 'Billing', icon: CreditCard },
 ]
 const coreModules = modules.filter(m => m.is_core)
 const businessModules = modules.filter(m => !m.is_core)
 const activeModules = modules.filter(m => m.status === 'INSTALLED').length
 return (
 <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto py-6 px-4">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="sm" onClick={() => router.push('/organizations')} className="text-app-muted-foreground hover:text-app-foreground rounded-xl">
 <ArrowLeft size={18} />
 </Button>
 <div>
 <div className="flex items-center gap-3">
 <h1 className="page-header-title tracking-tight">{org.name}</h1>
 <Badge className={org.is_active ? "bg-app-primary-light text-app-primary border-app-success/30" : "bg-app-error-bg text-app-error border-app-error/30"}>
 {org.is_active ? 'Active' : 'Suspended'}
 </Badge>
 </div>
 <p className="text-app-primary font-mono text-xs tracking-widest uppercase mt-1">{org.slug}</p>
 </div>
 </div>
 <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-app-border text-app-muted-foreground">
 {(usage?.plan as any)?.name || 'Free Tier'}
 </Badge>
 </div>
 {/* Tab Bar */}
 <div className="flex gap-1 p-1 bg-app-surface-2 rounded-2xl w-fit">
 {tabs.map(t => (
 <button key={t.key} onClick={() => setActiveTab(t.key as any)}
 className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key
 ? 'bg-app-surface text-app-foreground shadow-sm' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 <t.icon size={14} />{t.label}
 </button>
 ))}
 </div>
 {/* ─── Overview Tab ─────────────────────────────────────────── */}
 {activeTab === 'overview' && (
 <div className="space-y-6">
 {/* Integrity Warnings */}
 {Array.isArray(usage?.warnings) && usage!.warnings.length > 0 && (

 <div className="space-y-2">
 {usage.warnings.map((w: Record<string, any>) => {
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
 onClick={() => setActiveTab('billing')}>
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
 onClick={() => setActiveTab('modules')}>
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
 onClick={async () => {
 const data = await listClients()
 setAllClients(Array.isArray(data) ? data : [])
 setShowClientDialog(true)
 }}>
 Change Client
 </Button>
 </div>
 ) : (
 <div className="text-center py-3">
 <p className="text-xs text-app-muted-foreground italic mb-3">No client assigned</p>
 <Button size="sm"
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold text-xs"
 onClick={async () => {
 const data = await listClients()
 setAllClients(Array.isArray(data) ? data : [])
 setShowClientDialog(true)
 }}>
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
 onClick={async () => {
 setTogglingEncryption(true)
 try {
 const action = encryptionStatus?.encryption_enabled ? 'deactivate' : 'activate'
 await toggleOrgEncryption(orgId, action)
 const updated = await getOrgEncryptionStatus(orgId)
 setEncryptionStatus(updated)
 toast.success(`Encryption ${action}d successfully`)
 } catch { toast.error('Failed to toggle encryption') }
 finally { setTogglingEncryption(false) }
 }}>
 {togglingEncryption ? 'Processing...' : encryptionStatus?.encryption_enabled ? 'Deactivate' : 'Activate'}
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 )}
 {/* ─── Modules Tab ──────────────────────────────────────────── */}
 {activeTab === 'modules' && (
 <div className="space-y-8">
 {coreModules.length > 0 && (
 <div>
 <h3 className="text-xs font-black uppercase tracking-widest text-app-primary mb-4 flex items-center gap-2">
 <Crown size={14} /> Core Infrastructure
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {coreModules.map(m => <ModuleCard key={m.code} module={m} onToggle={handleToggle} toggling={toggling} onFeatureToggle={handleFeatureToggle} />)}
 </div>
 </div>
 )}
 <div>
 <h3 className="text-xs font-black uppercase tracking-widest text-app-primary mb-4 flex items-center gap-2">
 <Package size={14} /> Business Modules
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {businessModules.map(m => <ModuleCard key={m.code} module={m} onToggle={handleToggle} toggling={toggling} onFeatureToggle={handleFeatureToggle} />)}
 </div>
 </div>
 </div>
 )}
 {/* ─── Users Tab ────────────────────────────────────────────── */}
 {activeTab === 'users' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-bold text-app-foreground">Organization Users</h3>
 <p className="text-sm text-app-muted-foreground">{users.length} user{users.length !== 1 ? 's' : ''} in this organization</p>
 </div>
 <Button onClick={() => setShowCreateUser(true)} className="bg-app-primary hover:bg-app-success text-app-foreground rounded-xl font-bold shadow-md">
 <Plus size={16} className="mr-2" /> Create User
 </Button>
 </div>
 {users.length === 0 ? (
 <Card className="border-app-border shadow-sm">
 <CardContent className="py-12 text-center text-app-muted-foreground italic">No users found for this organization.</CardContent>
 </Card>
 ) : (
 <div className="space-y-2">
 {users.map(user => (
 <div key={user.id} className="flex items-center justify-between p-4 bg-app-surface rounded-2xl border border-app-border hover:border-app-border shadow-sm transition-all">
 <div className="flex items-center gap-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${user.is_superuser
 ? 'bg-app-primary/5 text-app-primary border border-app-primary/30'
 : 'bg-app-background text-app-muted-foreground border border-app-border'
 }`}>
 {user.username.charAt(0).toUpperCase()}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-bold text-app-foreground text-sm">{user.username}</span>
 {user.is_superuser && (
 <Badge className="bg-app-primary/5 text-app-primary border-app-primary/30 text-[9px] font-black">SUPER</Badge>
 )}
 {user.is_staff && !user.is_superuser && (
 <Badge className="bg-app-info-bg text-app-info border-app-info/30 text-[9px] font-black">STAFF</Badge>
 )}
 {!user.is_active && (
 <Badge className="bg-app-error-bg text-app-error border-app-error/30 text-[9px]">Inactive</Badge>
 )}
 </div>
 <p className="text-xs text-app-muted-foreground">{user.email || 'No email'} {user.role ? `· ${user.role}` : ''}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-app-muted-foreground">
 {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : ''}
 </span>
 <Button variant="outline" size="sm" onClick={() => { setResetTarget(user); setNewPassword('') }}
 className="rounded-xl border-app-border text-app-muted-foreground hover:text-app-foreground text-xs font-bold">
 <KeyRound size={12} className="mr-1" /> Reset
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 {/* ─── Sites Tab ────────────────────────────────────────────── */}
 {activeTab === 'sites' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-bold text-app-foreground">Organization Sites</h3>
 <p className="text-sm text-app-muted-foreground">{sites.length} site{sites.length !== 1 ? 's' : ''} — branches, warehouses, locations</p>
 </div>
 <Button onClick={() => setShowCreateSite(true)} className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold shadow-md">
 <Plus size={16} className="mr-2" /> Add Site
 </Button>
 </div>
 {sites.length === 0 ? (
 <Card className="border-app-border shadow-sm">
 <CardContent className="py-12 text-center text-app-muted-foreground italic">No sites found. Create the first site for this organization.</CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {sites.map(site => (
 <div key={site.id} className={`p-5 rounded-2xl border transition-all ${site.is_active
 ? 'bg-app-surface border-app-border hover:border-app-primary/30 shadow-sm'
 : 'bg-app-background border-app-border opacity-60'
 }`}>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${site.is_active
 ? 'bg-app-primary/5 text-app-primary border border-app-primary/30'
 : 'bg-app-surface-2 text-app-muted-foreground border border-app-border'
 }`}>
 <Building2 size={18} />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-bold text-app-foreground text-sm">{site.name}</span>
 {site.code && (
 <span className="text-[9px] font-mono text-app-primary bg-app-primary/5 px-2 py-0.5 rounded-md border border-app-primary/30">{site.code}</span>
 )}
 <Badge className={site.is_active
 ? "bg-app-primary-light text-app-primary border-app-success/30 text-[9px]"
 : "bg-app-error-bg text-app-error border-app-error/30 text-[9px]"
 }>
 {site.is_active ? 'Active' : 'Inactive'}
 </Badge>
 </div>
 <div className="flex items-center gap-3 mt-1">
 {site.city && <span className="text-xs text-app-muted-foreground flex items-center gap-1"><MapPin size={10} />{site.city}</span>}
 {site.phone && <span className="text-xs text-app-muted-foreground">{site.phone}</span>}
 </div>
 </div>
 </div>
 <button onClick={() => handleToggleSite(String(site.id))} className="transition-transform hover:scale-110">
 <Power size={18} className={site.is_active ? 'text-app-primary' : 'text-app-muted-foreground'} />
 </button>
 </div>
 {(site.address || site.vat_number) && (
 <div className="mt-3 pt-3 border-t border-app-border flex justify-between text-xs text-app-muted-foreground">
 {site.address && <span>{site.address}</span>}
 {site.vat_number && <span>VAT: {site.vat_number}</span>}
 </div>
 )}
 <div className="mt-2 text-[10px] text-app-muted-foreground">
 Created: {site.created_at ? new Date(site.created_at).toLocaleDateString() : 'N/A'}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 {/* ─── Usage Tab ────────────────────────────────────────────── */}
 {activeTab === 'usage' && (
 <div className="space-y-6">
 <Card className="border-app-border shadow-sm">
 <CardHeader>
 <CardTitle className="text-lg font-bold">Detailed Usage Metrics</CardTitle>
 <CardDescription>Real-time resource consumption for this organization</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {usage ? (
 <>
 <UsageMeter label="Users" icon={Users} current={usage.users.current} limit={usage.users.limit} percent={usage.users.percent} />
 <UsageMeter label="Sites / Locations" icon={MapPin} current={usage.sites.current} limit={usage.sites.limit} percent={usage.sites.percent} />
 <UsageMeter label="Data Storage" icon={HardDrive} current={usage.storage.current_mb} limit={usage.storage.limit_mb} percent={usage.storage.percent} unit=" MB" />
 <UsageMeter label="Invoices This Month" icon={FileText} current={usage.invoices.current} limit={usage.invoices.limit} percent={usage.invoices.percent} />
 <div className="p-5 bg-app-background rounded-2xl border border-app-border mt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Active Modules</p>
 <p className="text-2xl font-black text-app-foreground mt-1">
 {usage.modules.current} <span className="text-sm font-medium text-app-muted-foreground">/ {usage.modules.total_available} available</span>
 </p>
 </div>
 <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setActiveTab('modules')}>Manage</Button>
 </div>
 </div>
 </>
 ) : (
 <div className="py-12 text-center text-app-muted-foreground italic">Usage data unavailable</div>
 )}
 </CardContent>
 </Card>
 </div>
 )}
 {/* ─── Billing Tab ──────────────────────────────────────────── */}
 {activeTab === 'billing' && (
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
 {Array.isArray((usage as any)?.available_plans) && (usage as any).available_plans.length > 0 && (() => {
 const usageAny = usage as any
 return (
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
 onClick={() => setPlanSwitchTarget(p as unknown as SaasPlan)}>
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
 )
 })()}
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
 )}
 {/* ─── Add-ons Tab ──────────────────────────────────────────── */}

 {activeTab === 'addons' && (

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
 onClick={async () => {
 setCancellingAddon(p.id)
 try {
 await cancelAddon(orgId, p.id)
 toast.success(`Add-on "${p.addon_name}" cancelled`)
 const updated = await getOrgAddons(orgId)
 setAddons(updated || { purchased: [], available: [] })
 } catch { toast.error('Failed to cancel add-on') }
 finally { setCancellingAddon(null) }
 }}
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
 onClick={async () => {
 setPurchasingAddon(a.id)
 try {
 const result = await purchaseAddon(orgId, a.id)
 toast.success(result.message || `Add-on "${a.name}" purchased`)
 const updated = await getOrgAddons(orgId)
 setAddons(updated || { purchased: [], available: [] })
 } catch { toast.error('Failed to purchase add-on') }
 finally { setPurchasingAddon(null) }
 }}
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
 {/* ─── Create User Dialog ───────────────────────────────────── */}
 <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
 <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
 <DialogHeader>
 <DialogTitle className="font-bold">Create New User</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">First Name</label>
 <Input value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="John" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Last Name</label>
 <Input value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Doe" className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Username *</label>
 <Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="johndoe" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Email</label>
 <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@company.com" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Password *</label>
 <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" className="rounded-xl" />
 </div>
 <div className="flex items-center gap-3 p-3 bg-app-primary/5 rounded-xl border border-app-primary/30">
 <button onClick={() => setNewUser({ ...newUser, is_superuser: !newUser.is_superuser })}
 className="transition-transform hover:scale-110">
 {newUser.is_superuser ? <ToggleRight size={28} className="text-app-primary" /> : <ToggleLeft size={28} className="text-app-muted-foreground" />}
 </button>
 <div>
 <p className="text-sm font-bold text-app-foreground">Superuser Access</p>
 <p className="text-[10px] text-app-muted-foreground">Full admin access to this organization</p>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setShowCreateUser(false)} className="rounded-xl">Cancel</Button>
 <Button onClick={handleCreateUser} disabled={creating} className="bg-app-primary hover:bg-app-success text-app-foreground rounded-xl font-bold">
 {creating ? <Loader2 size={16} className="animate-spin mr-2" /> : <UserCog size={16} className="mr-2" />}
 Create User
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 {/* ─── Reset Password Dialog ────────────────────────────────── */}
 <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) setResetTarget(null) }}>
 <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
 <DialogHeader>
 <DialogTitle className="font-bold">Reset Password</DialogTitle>
 </DialogHeader>
 {resetTarget && (
 <div className="space-y-4 py-4">
 <p className="text-sm text-app-muted-foreground">
 Set a new password for <strong className="text-app-foreground">{String(resetTarget.username ?? '')}</strong>
 </p>
 <div className="relative">
 <Input type={showPass ? 'text' : 'password'} value={newPassword}
 onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="rounded-xl pr-10" />
 <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground">
 {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 )}
 <DialogFooter>
 <Button variant="ghost" onClick={() => setResetTarget(null)} className="rounded-xl">Cancel</Button>
 <Button onClick={handleResetPassword} disabled={resetting} className="bg-app-warning hover:bg-app-warning text-app-foreground rounded-xl font-bold">
 {resetting ? <Loader2 size={16} className="animate-spin mr-2" /> : <KeyRound size={16} className="mr-2" />}
 Reset Password
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 {/* ─── Create Site Dialog ───────────────────────────────────── */}
 <Dialog open={showCreateSite} onOpenChange={setShowCreateSite}>
 <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
 <DialogHeader>
 <DialogTitle className="font-bold">Add New Site</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Site Name *</label>
 <Input value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} placeholder="Main Branch" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Code</label>
 <Input value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value.toUpperCase() })} placeholder="BR001" className="rounded-xl font-mono" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Address</label>
 <Input value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })} placeholder="123 Main Street" className="rounded-xl" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">City</label>
 <Input value={newSite.city} onChange={e => setNewSite({ ...newSite, city: e.target.value })} placeholder="Beirut" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Phone</label>
 <Input value={newSite.phone} onChange={e => setNewSite({ ...newSite, phone: e.target.value })} placeholder="+961 1 234567" className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">VAT Number</label>
 <Input value={newSite.vat_number} onChange={e => setNewSite({ ...newSite, vat_number: e.target.value })} placeholder="LB123456789" className="rounded-xl font-mono" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setShowCreateSite(false)} className="rounded-xl">Cancel</Button>
 <Button onClick={handleCreateSite} disabled={creatingSite} className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold">
 {creatingSite ? <Loader2 size={16} className="animate-spin mr-2" /> : <Building2 size={16} className="mr-2" />}
 Create Site
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 {/* ─── Plan Switch Confirmation Dialog ─────────────────────── */}
 <Dialog open={!!planSwitchTarget} onOpenChange={(open) => !open && setPlanSwitchTarget(null)}>
 <DialogContent className="rounded-2xl max-w-md">
 <DialogHeader>
 <DialogTitle className="font-black text-lg">Confirm Plan Switch</DialogTitle>
 </DialogHeader>
 {planSwitchTarget && (() => {
 const currentPrice = parseFloat(String(usage?.plan?.monthly_price ?? '0'))
 const targetPrice = parseFloat(String(planSwitchTarget.price ?? planSwitchTarget.monthly_price ?? '0'))
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
 <span className="font-black text-app-foreground">{planSwitchTarget.name}</span>
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
 {Array.isArray((planSwitchTarget as any).modules) && (planSwitchTarget as any).modules.length > 0 && (
 <div>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mb-1">Modules in new plan:</p>
 <div className="flex flex-wrap gap-1">
 {(planSwitchTarget as any).modules.map((m: string) => (
 <Badge key={m} className="bg-app-background text-app-muted-foreground text-[9px] border border-app-border uppercase">{m}</Badge>
 ))}
 </div>
 </div>
 )}
 </div>
 )
 })()}
 <DialogFooter>
 <Button variant="ghost" onClick={() => setPlanSwitchTarget(null)} className="rounded-xl">Cancel</Button>
 <Button
 disabled={switching}
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold"
 onClick={async () => {
 if (!planSwitchTarget) return
 setSwitching(true)
 try {
 const result = await changeOrgPlan(orgId, String(planSwitchTarget.id))
 toast.success(result.message || `Switched to ${planSwitchTarget.name}`)
 if (result.modules_disabled?.length > 0) {
 toast.info(`Disabled modules: ${result.modules_disabled.join(', ')}`)
 }
 // Refresh all data + global router state
 await reloadData()
 router.refresh()
 setPlanSwitchTarget(null)
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to change plan')
 } finally {
 setSwitching(false)
 }
 }}>
 {switching ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
 Confirm Switch
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 {/* ─── Client Assignment Dialog ────────────────────────────── */}
 <Dialog open={showClientDialog} onOpenChange={(open) => { if (!open) { setShowClientDialog(false); setShowNewClient(false) } }}>
 <DialogContent className="rounded-2xl max-w-md">
 <DialogHeader>
 <DialogTitle className="font-black text-lg">Assign Account Owner</DialogTitle>
 </DialogHeader>
 {!showNewClient ? (
 <div className="space-y-4">
 <Input
 placeholder="Search clients by name or email..."
 value={clientSearch}
 onChange={async (e) => {
 setClientSearch(e.target.value)
 const data = await listClients(e.target.value)
 setAllClients(Array.isArray(data) ? data : [])
 }}
 className="rounded-xl"
 />
 <div className="max-h-[300px] overflow-y-auto space-y-1">
 {allClients.map((c: Record<string, any>) => (
 <button key={c.id}
 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left hover:border-app-success hover:bg-app-primary-light/30 ${usage?.client?.id === c.id ? 'border-app-success bg-app-primary-light' : 'border-app-border'}`}
 onClick={async () => {
 setSavingClient(true)
 try {
 await setOrgClient(orgId, c.id)
 toast.success(`Client "${c.full_name}" assigned`)
 const newUsage = await getOrgUsage(orgId)
 setUsage(newUsage)
 setShowClientDialog(false)
 } catch { toast.error('Failed to assign client') }
 finally { setSavingClient(false) }
 }}>
 <div>
 <p className="font-bold text-sm text-app-foreground">{c.full_name}</p>
 <p className="text-[10px] text-app-muted-foreground">{c.email}{c.company_name ? ` · ${c.company_name}` : ''}</p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-app-background text-app-muted-foreground border-app-border text-[9px]">{c.org_count} orgs</Badge>
 {usage?.client?.id === c.id && <Check size={14} className="text-app-primary" />}
 </div>
 </button>
 ))}
 {allClients.length === 0 && (
 <p className="text-center text-xs text-app-muted-foreground italic py-6">No clients found</p>
 )}
 </div>
 <div className="border-t border-app-border pt-3 flex gap-2">
 <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => setShowNewClient(true)}>
 <Plus size={12} className="mr-1" /> Create New Client
 </Button>
 {usage?.client && (
 <Button variant="ghost" className="rounded-xl text-xs text-app-error hover:text-app-error hover:bg-app-error-bg"
 onClick={async () => {
 setSavingClient(true)
 try {
 await setOrgClient(orgId, null)
 toast.success('Client unassigned')
 const newUsage = await getOrgUsage(orgId)
 setUsage(newUsage)
 setShowClientDialog(false)
 } catch { toast.error('Failed to unassign') }
 finally { setSavingClient(false) }
 }}>
 Unassign
 </Button>
 )}
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">First Name *</label>
 <Input value={newClient.first_name} onChange={e => setNewClient({ ...newClient, first_name: e.target.value })} className="rounded-xl" />
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Last Name *</label>
 <Input value={newClient.last_name} onChange={e => setNewClient({ ...newClient, last_name: e.target.value })} className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Email *</label>
 <Input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} className="rounded-xl" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Phone</label>
 <Input value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} className="rounded-xl" />
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Company Name</label>
 <Input value={newClient.company_name} onChange={e => setNewClient({ ...newClient, company_name: e.target.value })} className="rounded-xl" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setShowNewClient(false)} className="rounded-xl">Back</Button>
 <Button
 disabled={savingClient || !newClient.first_name || !newClient.last_name || !newClient.email}
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold"
 onClick={async () => {
 setSavingClient(true)
 try {
 const result = await createClient(newClient)
 if (result.id) {
 await setOrgClient(orgId, result.id)
 toast.success(`Client "${result.full_name}" created and assigned`)
 const newUsage = await getOrgUsage(orgId)
 setUsage(newUsage)
 setShowClientDialog(false)
 setShowNewClient(false)
 setNewClient({ first_name: '', last_name: '', email: '', phone: '', company_name: '' })
 } else {
 toast.error(result.error || 'Failed to create client')
 }
 } catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to create client') }
 finally { setSavingClient(false) }
 }}>
 {savingClient ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
 Create & Assign
 </Button>
 </DialogFooter>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div >
 )
}
