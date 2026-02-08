'use client'

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getOrganization, getOrgUsage, getOrgBilling, getOrgModules, toggleOrgModule, updateModuleFeatures, changeOrgPlan, getOrgUsers, createOrgUser, resetOrgUserPassword, getOrgSites, createOrgSite, toggleOrgSite } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    ArrowLeft, Users, MapPin, HardDrive, FileText,
    Package, ShieldCheck, AlertTriangle, Loader2,
    ToggleLeft, ToggleRight, Crown, Layers, Activity,
    CreditCard, TrendingUp, ChevronRight, Plus, KeyRound,
    UserCog, Eye, EyeOff, Check, Building2, Power
} from "lucide-react"

// ─── Usage Meter ─────────────────────────────────────────────────────────────
function UsageMeter({ label, icon: Icon, current, limit, percent, unit = '' }: {
    label: string; icon: any; current: number; limit: number; percent: number; unit?: string
}) {
    const isWarning = percent >= 80
    const isDanger = percent >= 95
    const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
    const bgColor = isDanger ? 'bg-red-50 border-red-100' : isWarning ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'

    return (
        <div className={`p-5 rounded-2xl border transition-all ${bgColor}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon size={16} className={isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-gray-400'} />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
                </div>
                <span className="text-sm font-black text-gray-900">
                    {current}{unit} <span className="text-gray-400 font-medium">/ {limit}{unit}</span>
                </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
            </div>
            {isDanger && (
                <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1">
                    <AlertTriangle size={10} /> Approaching limit — consider upgrading
                </p>
            )}
        </div>
    )
}

// ─── Module Card ─────────────────────────────────────────────────────────────
function ModuleCard({ module, onToggle, toggling, onFeatureToggle }: {
    module: any; onToggle: (code: string, status: string) => void; toggling: string | null
    onFeatureToggle: (code: string, featureCode: string, enabled: boolean) => void
}) {
    const isInstalled = module.status === 'INSTALLED'
    const isCore = module.is_core

    return (
        <div className={`p-5 rounded-2xl border transition-all group ${isInstalled
            ? 'bg-white border-emerald-100 hover:border-emerald-300 shadow-sm'
            : 'bg-gray-50 border-gray-100 hover:border-gray-200'
            }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCore
                        ? 'bg-indigo-50 text-indigo-500'
                        : isInstalled ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                        {isCore ? <Crown size={18} /> : <Package size={18} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">{module.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{module.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className={isInstalled
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px]"
                        : "bg-gray-100 text-gray-500 border-gray-200 text-[10px]"
                    }>
                        {isInstalled ? 'Active' : 'Inactive'}
                    </Badge>
                    {isCore ? (
                        <div className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">Core</div>
                    ) : (
                        <button
                            onClick={() => onToggle(module.code, module.status)}
                            disabled={toggling === module.code}
                            className="transition-transform hover:scale-110 disabled:opacity-50"
                        >
                            {toggling === module.code ? (
                                <Loader2 size={24} className="animate-spin text-gray-400" />
                            ) : isInstalled ? (
                                <ToggleRight size={28} className="text-emerald-500" />
                            ) : (
                                <ToggleLeft size={28} className="text-gray-300" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Feature flags */}
            {isInstalled && module.available_features?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-2">Capabilities</p>
                    <div className="flex flex-wrap gap-1.5">
                        {module.available_features.map((f: any) => {
                            const fCode = f.code || f
                            const fName = f.name || f
                            const isActive = module.active_features?.includes(fCode)
                            return (
                                <button
                                    key={fCode}
                                    onClick={() => onFeatureToggle(module.code, fCode, !isActive)}
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-all ${isActive
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                                        : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'
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

    const [org, setOrg] = useState<any>(null)
    const [usage, setUsage] = useState<any>(null)
    const [billing, setBilling] = useState<any[]>([])
    const [modules, setModules] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [sites, setSites] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'usage' | 'billing' | 'users' | 'sites'>('overview')
    const [toggling, setToggling] = useState<string | null>(null)

    // User creation dialog
    const [showCreateUser, setShowCreateUser] = useState(false)
    const [newUser, setNewUser] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', is_superuser: false })
    const [creating, setCreating] = useState(false)

    // Reset password dialog
    const [resetTarget, setResetTarget] = useState<any>(null)
    const [newPassword, setNewPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [resetting, setResetting] = useState(false)

    // Site creation dialog
    const [showCreateSite, setShowCreateSite] = useState(false)
    const [newSite, setNewSite] = useState({ name: '', code: '', address: '', city: '', phone: '', vat_number: '' })
    const [creatingSite, setCreatingSite] = useState(false)

    // Plan switch confirmation dialog
    const [planSwitchTarget, setPlanSwitchTarget] = useState<any>(null)
    const [switching, setSwitching] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const [orgData, usageData, billingData, modulesData, usersData, sitesData] = await Promise.all([
                    getOrganization(orgId),
                    getOrgUsage(orgId),
                    getOrgBilling(orgId),
                    getOrgModules(orgId),
                    getOrgUsers(orgId),
                    getOrgSites(orgId),
                ])
                setOrg(orgData)
                setUsage(usageData)
                setBilling(Array.isArray(billingData) ? billingData : [])
                setModules(Array.isArray(modulesData) ? modulesData : [])
                setUsers(Array.isArray(usersData) ? usersData : [])
                setSites(Array.isArray(sitesData) ? sitesData : [])
            } catch {
                toast.error("Failed to load organization details")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [orgId])

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
        const current: string[] = mod.active_features || []
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
        } catch (e: any) {
            const msg = e.message ? JSON.parse(e.message)?.error : 'Failed to create user'
            toast.error(msg)
        } finally { setCreating(false) }
    }

    async function handleResetPassword() {
        if (!newPassword || newPassword.length < 6) return toast.error("Password must be at least 6 characters")
        setResetting(true)
        try {
            const result = await resetOrgUserPassword(orgId, resetTarget.id, newPassword)
            toast.success(result.message || 'Password reset')
            setResetTarget(null)
            setNewPassword('')
        } catch (e: any) {
            const msg = e.message ? JSON.parse(e.message)?.error : 'Failed to reset password'
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
        } catch (e: any) {
            const msg = e.message ? JSON.parse(e.message)?.error : 'Failed to create site'
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
                <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto" />
                <p className="text-gray-400 font-medium text-sm">Loading organization...</p>
            </div>
        </div>
    )

    if (!org) return (
        <div className="p-12 text-center">
            <h2 className="text-xl font-bold text-gray-800">Organization Not Found</h2>
            <Button variant="ghost" onClick={() => router.push('/organizations')} className="mt-4">← Back to Organizations</Button>
        </div>
    )

    const tabs = [
        { key: 'overview', label: 'Overview', icon: Activity },
        { key: 'modules', label: 'Modules', icon: Layers },
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
                    <Button variant="ghost" size="sm" onClick={() => router.push('/organizations')} className="text-gray-400 hover:text-gray-900 rounded-xl">
                        <ArrowLeft size={18} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{org.name}</h1>
                            <Badge className={org.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}>
                                {org.is_active ? 'Active' : 'Suspended'}
                            </Badge>
                        </div>
                        <p className="text-emerald-600 font-mono text-xs tracking-widest uppercase mt-1">{org.slug}</p>
                    </div>
                </div>
                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-gray-200 text-gray-500">
                    {usage?.plan?.name || 'Free Tier'}
                </Badge>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key
                            ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <t.icon size={14} />{t.label}
                    </button>
                ))}
            </div>

            {/* ─── Overview Tab ─────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 border-gray-100 shadow-sm">
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
                                <div className="py-8 text-center text-gray-400 italic">Usage data unavailable</div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-emerald-100 bg-emerald-50/30 shadow-sm">
                            <CardHeader><CardTitle className="text-lg font-bold text-emerald-900">Current Plan</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center py-4">
                                    <div className="text-3xl font-black text-emerald-700">
                                        ${usage?.plan?.monthly_price || '0.00'}<span className="text-sm font-medium text-emerald-500">/mo</span>
                                    </div>
                                    <p className="text-emerald-600 font-bold mt-1">{usage?.plan?.name || 'Free Tier'}</p>
                                    {usage?.plan?.annual_price && usage.plan.annual_price !== '0.00' && (
                                        <p className="text-xs text-gray-500 mt-1">${usage.plan.annual_price}/yr</p>
                                    )}
                                    {usage?.plan?.expiry && (
                                        <p className="text-xs text-gray-500 mt-2">Renews: {new Date(usage.plan.expiry).toLocaleDateString()}</p>
                                    )}
                                </div>
                                <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold"
                                    onClick={() => setActiveTab('billing')}>
                                    Manage Plan <ChevronRight size={14} />
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-gray-100 shadow-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-lg font-bold">Modules</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-center py-4">
                                    <div className="text-3xl font-black text-gray-900">{activeModules}</div>
                                    <p className="text-xs text-gray-500">of {modules.length} active</p>
                                </div>
                                <Button variant="outline" className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold"
                                    onClick={() => setActiveTab('modules')}>
                                    Manage Modules <ChevronRight size={14} />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* ─── Modules Tab ──────────────────────────────────────────── */}
            {activeTab === 'modules' && (
                <div className="space-y-8">
                    {coreModules.length > 0 && (
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-4 flex items-center gap-2">
                                <Crown size={14} /> Core Infrastructure
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {coreModules.map(m => <ModuleCard key={m.code} module={m} onToggle={handleToggle} toggling={toggling} onFeatureToggle={handleFeatureToggle} />)}
                            </div>
                        </div>
                    )}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
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
                            <h3 className="text-lg font-bold text-gray-900">Organization Users</h3>
                            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} in this organization</p>
                        </div>
                        <Button onClick={() => setShowCreateUser(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md">
                            <Plus size={16} className="mr-2" /> Create User
                        </Button>
                    </div>

                    {users.length === 0 ? (
                        <Card className="border-gray-100 shadow-sm">
                            <CardContent className="py-12 text-center text-gray-400 italic">No users found for this organization.</CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {users.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${user.is_superuser
                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                            : 'bg-gray-50 text-gray-600 border border-gray-100'
                                            }`}>
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-sm">{user.username}</span>
                                                {user.is_superuser && (
                                                    <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-black">SUPER</Badge>
                                                )}
                                                {user.is_staff && !user.is_superuser && (
                                                    <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-black">STAFF</Badge>
                                                )}
                                                {!user.is_active && (
                                                    <Badge className="bg-red-50 text-red-500 border-red-100 text-[9px]">Inactive</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400">{user.email || 'No email'} {user.role ? `· ${user.role}` : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400">
                                            {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : ''}
                                        </span>
                                        <Button variant="outline" size="sm" onClick={() => { setResetTarget(user); setNewPassword('') }}
                                            className="rounded-xl border-gray-200 text-gray-500 hover:text-gray-900 text-xs font-bold">
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
                            <h3 className="text-lg font-bold text-gray-900">Organization Sites</h3>
                            <p className="text-sm text-gray-500">{sites.length} site{sites.length !== 1 ? 's' : ''} — branches, warehouses, locations</p>
                        </div>
                        <Button onClick={() => setShowCreateSite(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md">
                            <Plus size={16} className="mr-2" /> Add Site
                        </Button>
                    </div>

                    {sites.length === 0 ? (
                        <Card className="border-gray-100 shadow-sm">
                            <CardContent className="py-12 text-center text-gray-400 italic">No sites found. Create the first site for this organization.</CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sites.map(site => (
                                <div key={site.id} className={`p-5 rounded-2xl border transition-all ${site.is_active
                                    ? 'bg-white border-gray-100 hover:border-indigo-200 shadow-sm'
                                    : 'bg-gray-50 border-gray-100 opacity-60'
                                    }`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${site.is_active
                                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                }`}>
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900 text-sm">{site.name}</span>
                                                    {site.code && (
                                                        <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{site.code}</span>
                                                    )}
                                                    <Badge className={site.is_active
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px]"
                                                        : "bg-red-50 text-red-500 border-red-100 text-[9px]"
                                                    }>
                                                        {site.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {site.city && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{site.city}</span>}
                                                    {site.phone && <span className="text-xs text-gray-400">{site.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleToggleSite(site.id)} className="transition-transform hover:scale-110">
                                            <Power size={18} className={site.is_active ? 'text-emerald-500' : 'text-gray-300'} />
                                        </button>
                                    </div>
                                    {(site.address || site.vat_number) && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                                            {site.address && <span>{site.address}</span>}
                                            {site.vat_number && <span>VAT: {site.vat_number}</span>}
                                        </div>
                                    )}
                                    <div className="mt-2 text-[10px] text-gray-300">
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
                    <Card className="border-gray-100 shadow-sm">
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
                                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 mt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Modules</p>
                                                <p className="text-2xl font-black text-gray-900 mt-1">
                                                    {usage.modules.current} <span className="text-sm font-medium text-gray-400">/ {usage.modules.total_available} available</span>
                                                </p>
                                            </div>
                                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setActiveTab('modules')}>Manage</Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12 text-center text-gray-400 italic">Usage data unavailable</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── Billing Tab ──────────────────────────────────────────── */}
            {activeTab === 'billing' && (
                <div className="space-y-6">
                    <Card className="border-emerald-100 bg-emerald-50/30 shadow-sm">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl font-bold text-emerald-900">Subscription</CardTitle>
                                    <CardDescription className="text-emerald-700">Current active plan</CardDescription>
                                </div>
                                <Badge className="bg-emerald-600 text-white text-lg px-4 py-1">{usage?.plan?.name || 'Free Tier'}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="p-5 bg-white rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                    {org.is_active ? (
                                        <div className="flex items-center gap-2 text-emerald-600 font-black text-lg"><ShieldCheck size={20} /> ACTIVE</div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-600 font-black text-lg"><AlertTriangle size={20} /> SUSPENDED</div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Monthly</p>
                                    <p className="text-2xl font-black text-gray-900">${usage?.plan?.monthly_price || '0.00'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Available Plans */}
                    {usage?.available_plans?.length > 0 && (
                        <Card className="border-gray-100 shadow-sm">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className="font-bold">Available Plans</CardTitle>
                                    <Badge className="bg-gray-100 text-gray-500 text-[10px]">{usage.available_plans.length} plans</Badge>
                                </div>
                                <CardDescription className="text-xs text-gray-400">Select a plan to assign to this organization. Plans are managed from the <a href="/subscription-plans" className="text-emerald-600 underline hover:text-emerald-700 font-bold">Subscription Plans</a> page.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {usage.available_plans.map((p: any) => {
                                        const isCurrent = usage.plan?.id === p.id
                                        const isCustom = parseFloat(p.monthly_price) < 0
                                        const isFree = parseFloat(p.monthly_price) === 0
                                        const limits = p.limits || {}

                                        return (
                                            <div key={p.id} className={`p-5 rounded-2xl border-2 transition-all flex flex-col ${isCurrent
                                                ? 'border-emerald-300 bg-emerald-50/50 shadow-md'
                                                : 'border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white'}`}>
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="font-black text-gray-900">{p.name}</p>
                                                        {p.category && <span className="text-[10px] text-gray-400 font-medium">{p.category}</span>}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {isCurrent && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Current</Badge>}
                                                        {p.is_public && <Badge className="bg-blue-50 text-blue-500 text-[9px]">🌐 Public</Badge>}
                                                        {p.trial_days > 0 && <Badge className="bg-amber-50 text-amber-600 text-[9px]">{p.trial_days}d Trial</Badge>}
                                                    </div>
                                                </div>

                                                {/* Price */}
                                                <div className="mb-3">
                                                    {isCustom ? (
                                                        <span className="text-xl font-black text-purple-600">Custom</span>
                                                    ) : isFree ? (
                                                        <span className="text-xl font-black text-emerald-600">Free</span>
                                                    ) : (
                                                        <>
                                                            <span className="text-2xl font-black text-gray-900">${parseFloat(p.monthly_price).toFixed(0)}</span>
                                                            <span className="text-xs text-gray-400 font-bold ml-1">/mo</span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                {p.description && <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">{p.description}</p>}

                                                {/* Modules */}
                                                {p.modules?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-3">
                                                        {p.modules.slice(0, 4).map((m: string) => (
                                                            <Badge key={m} className="bg-gray-50 text-gray-500 text-[9px] border border-gray-100 uppercase">{m}</Badge>
                                                        ))}
                                                        {p.modules.length > 4 && (
                                                            <Badge className="bg-gray-50 text-gray-400 text-[9px] border border-gray-100">+{p.modules.length - 4}</Badge>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Limits */}
                                                {Object.keys(limits).length > 0 && (
                                                    <div className="grid grid-cols-2 gap-1 mb-3 text-[10px] text-gray-400">
                                                        {limits.max_users != null && <span>👥 {limits.max_users < 0 ? '∞' : limits.max_users} users</span>}
                                                        {limits.max_sites != null && <span>🏢 {limits.max_sites < 0 ? '∞' : limits.max_sites} sites</span>}
                                                    </div>
                                                )}

                                                <div className="flex-1" />

                                                {/* Switch Plan Button */}
                                                {!isCurrent && (
                                                    <Button size="sm"
                                                        className="w-full mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                                                        onClick={() => setPlanSwitchTarget(p)}>
                                                        Switch to This Plan
                                                    </Button>
                                                )}
                                                {isCurrent && (
                                                    <div className="text-center mt-3 text-[11px] text-emerald-600 font-black uppercase tracking-wider">
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

                    <Card className="border-gray-100 shadow-sm">
                        <CardHeader><CardTitle className="font-bold">Payment History</CardTitle></CardHeader>
                        <CardContent>
                            {billing.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-sm italic">No billing records found for this organization.</div>
                            ) : (
                                <div className="space-y-2">
                                    {billing.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge className={{
                                                        'PURCHASE': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                                        'CREDIT_NOTE': 'bg-amber-50 text-amber-600 border-amber-100',
                                                        'RENEWAL': 'bg-blue-50 text-blue-600 border-blue-100',
                                                    }[p.type as string] || 'bg-gray-50 text-gray-500'}
                                                    >{p.type === 'CREDIT_NOTE' ? 'Credit Note' : p.type === 'PURCHASE' ? 'Purchase' : p.type || 'Invoice'}</Badge>
                                                    <p className="font-bold text-gray-900 text-sm">{p.plan_name}</p>
                                                    {p.previous_plan_name && (
                                                        <span className="text-[10px] text-gray-400">← from {p.previous_plan_name}</span>
                                                    )}
                                                </div>
                                                {p.notes && <p className="text-[11px] text-gray-400 line-clamp-1">{p.notes}</p>}
                                                <p className="text-xs text-gray-400 mt-0.5">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString()}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black ${p.type === 'CREDIT_NOTE' ? 'text-amber-600' : 'text-gray-900'}`}>
                                                    {p.type === 'CREDIT_NOTE' ? '-' : ''}${p.amount}
                                                </span>
                                                <Badge className={{
                                                    'COMPLETED': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                                    'PAID': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                                    'PENDING': 'bg-amber-50 text-amber-600 border-amber-100',
                                                }[p.status as string] || 'bg-red-50 text-red-600 border-red-100'}
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

            {/* ─── Create User Dialog ───────────────────────────────────── */}
            <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="font-bold">Create New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">First Name</label>
                                <Input value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="John" className="rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Last Name</label>
                                <Input value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Doe" className="rounded-xl" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Username *</label>
                            <Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="johndoe" className="rounded-xl" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Email</label>
                            <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@company.com" className="rounded-xl" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Password *</label>
                            <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" className="rounded-xl" />
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                            <button onClick={() => setNewUser({ ...newUser, is_superuser: !newUser.is_superuser })}
                                className="transition-transform hover:scale-110">
                                {newUser.is_superuser ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} className="text-gray-300" />}
                            </button>
                            <div>
                                <p className="text-sm font-bold text-gray-900">Superuser Access</p>
                                <p className="text-[10px] text-gray-500">Full admin access to this organization</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreateUser(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateUser} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
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
                            <p className="text-sm text-gray-500">
                                Set a new password for <strong className="text-gray-900">{resetTarget.username}</strong>
                            </p>
                            <div className="relative">
                                <Input type={showPass ? 'text' : 'password'} value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="rounded-xl pr-10" />
                                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setResetTarget(null)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleResetPassword} disabled={resetting} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold">
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
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Site Name *</label>
                                <Input value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} placeholder="Main Branch" className="rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Code</label>
                                <Input value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value.toUpperCase() })} placeholder="BR001" className="rounded-xl font-mono" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Address</label>
                            <Input value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })} placeholder="123 Main Street" className="rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">City</label>
                                <Input value={newSite.city} onChange={e => setNewSite({ ...newSite, city: e.target.value })} placeholder="Beirut" className="rounded-xl" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Phone</label>
                                <Input value={newSite.phone} onChange={e => setNewSite({ ...newSite, phone: e.target.value })} placeholder="+961 1 234567" className="rounded-xl" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">VAT Number</label>
                            <Input value={newSite.vat_number} onChange={e => setNewSite({ ...newSite, vat_number: e.target.value })} placeholder="LB123456789" className="rounded-xl font-mono" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreateSite(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateSite} disabled={creatingSite} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
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
                        const currentPrice = parseFloat(usage?.plan?.monthly_price || '0')
                        const targetPrice = parseFloat(planSwitchTarget.monthly_price)
                        const isUpgrade = targetPrice > currentPrice
                        const isDowngrade = targetPrice < currentPrice
                        const diff = Math.abs(targetPrice - currentPrice)
                        return (
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400 font-bold uppercase">Current Plan</span>
                                        <span className="font-bold text-gray-900">{usage?.plan?.name || 'Free Tier'}</span>
                                    </div>
                                    <div className="border-t border-dashed border-gray-200" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400 font-bold uppercase">New Plan</span>
                                        <span className="font-black text-gray-900">{planSwitchTarget.name}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{
                                    borderColor: isUpgrade ? '#10b981' : isDowngrade ? '#f59e0b' : '#9ca3af',
                                    background: isUpgrade ? '#ecfdf5' : isDowngrade ? '#fffbeb' : '#f9fafb'
                                }}>
                                    <div>
                                        <Badge className={isUpgrade ? 'bg-emerald-100 text-emerald-700' : isDowngrade ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}>
                                            {isUpgrade ? '⬆ Upgrade' : isDowngrade ? '⬇ Downgrade' : '↔ Switch'}
                                        </Badge>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-400 font-bold">Price {isUpgrade ? 'Increase' : isDowngrade ? 'Decrease' : 'Change'}</p>
                                        <p className={`text-lg font-black ${isUpgrade ? 'text-emerald-600' : isDowngrade ? 'text-amber-600' : 'text-gray-600'}`}>
                                            {isUpgrade ? '+' : isDowngrade ? '-' : ''}${diff.toFixed(2)}/mo
                                        </p>
                                    </div>
                                </div>

                                {isUpgrade && (
                                    <p className="text-[11px] text-gray-400">A <strong>Purchase Invoice</strong> of ${diff.toFixed(2)}/mo will be generated for the price difference.</p>
                                )}
                                {isDowngrade && (
                                    <p className="text-[11px] text-gray-400">A <strong>Credit Note</strong> of ${diff.toFixed(2)}/mo will be issued, plus a new <strong>Purchase Invoice</strong> for ${targetPrice.toFixed(2)}/mo.</p>
                                )}

                                {planSwitchTarget.modules?.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Modules in new plan:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {planSwitchTarget.modules.map((m: string) => (
                                                <Badge key={m} className="bg-gray-50 text-gray-500 text-[9px] border border-gray-100 uppercase">{m}</Badge>
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
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                            onClick={async () => {
                                if (!planSwitchTarget) return
                                setSwitching(true)
                                try {
                                    const result = await changeOrgPlan(orgId, planSwitchTarget.id)
                                    toast.success(result.message || `Switched to ${planSwitchTarget.name}`)
                                    if (result.modules_disabled?.length > 0) {
                                        toast.info(`Disabled modules: ${result.modules_disabled.join(', ')}`)
                                    }
                                    // Refresh usage + billing data
                                    const [newUsage, newBilling] = await Promise.all([
                                        getOrgUsage(orgId),
                                        getOrgBilling(orgId),
                                    ])
                                    setUsage(newUsage)
                                    setBilling(Array.isArray(newBilling) ? newBilling : [])
                                    setPlanSwitchTarget(null)
                                } catch (err: any) {
                                    toast.error(err.message || 'Failed to change plan')
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
        </div>
    )
}
