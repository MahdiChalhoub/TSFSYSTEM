// @ts-nocheck
'use client'

import { useEffect, useState } from "react"
import { SaasOrganization, SaasUsageData, SaasBillingData, SaasAddonData, SaasPlan, SaasModule, SaasUser, SaasSite } from "@/types/erp"
import { useParams, useRouter } from "next/navigation"
import { getOrganization, getOrgUsage, getOrgBilling, getOrgModules, toggleOrgModule, updateModuleFeatures, changeOrgPlan, getOrgUsers, createOrgUser, resetOrgUserPassword, getOrgSites, createOrgSite, toggleOrgSite, listClients, createClient, setOrgClient, getOrgAddons, purchaseAddon, cancelAddon, getOrgEncryptionStatus, toggleOrgEncryption, updateOrgSettings } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    ArrowLeft, Users, Loader2, Layers, Activity,
    CreditCard, TrendingUp, Paintbrush, Building2, Puzzle,
} from "lucide-react"
import { BrandingTab } from "./_components/BrandingTab"
import { BillingTab } from "./_components/BillingTab"
import { AddonsTab } from "./_components/AddonsTab"
import { OverviewTab } from "./_components/OverviewTab"
import { ModulesTab } from "./_components/ModulesTab"
import { UsersTab } from "./_components/UsersTab"
import { SitesTab } from "./_components/SitesTab"
import { UsageTab } from "./_components/UsageTab"
import { CreateUserDialog, ResetPasswordDialog, CreateSiteDialog, PlanSwitchDialog, ClientAssignDialog } from "./_components/OrgDialogs"

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
    const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'usage' | 'billing' | 'users' | 'sites' | 'addons' | 'branding'>('overview')
    const [addons, setAddons] = useState<SaasAddonData>({ purchased: [], available: [] })
    const [purchasingAddon, setPurchasingAddon] = useState<string | null>(null)
    const [cancellingAddon, setCancellingAddon] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const [encryptionStatus, setEncryptionStatus] = useState<Record<string, any> | null>(null)
    const [togglingEncryption, setTogglingEncryption] = useState(false)

    // Dialog visibility — form state lives inside each dialog component.
    const [showCreateUser, setShowCreateUser] = useState(false)
    const [resetTarget, setResetTarget] = useState<Record<string, unknown> | null>(null)
    const [showCreateSite, setShowCreateSite] = useState(false)
    const [planSwitchTarget, setPlanSwitchTarget] = useState<SaasPlan | null>(null)
    const [switching, setSwitching] = useState(false)
    const [showClientDialog, setShowClientDialog] = useState(false)
    const [allClients, setAllClients] = useState<Record<string, unknown>[]>([])
    const [savingClient, setSavingClient] = useState(false)

    useEffect(() => {
        async function load() {
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

                // Load encryption status
                getOrgEncryptionStatus(orgId).then(s => setEncryptionStatus(s)).catch(() => { })
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
        { key: 'branding', label: 'Branding', icon: Paintbrush },
    ]

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
                            <h1 className="text-3xl font-black text-app-foreground tracking-tight">{org.name}</h1>
                            <Badge className={org.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}>
                                {org.is_active ? 'Active' : 'Suspended'}
                            </Badge>
                        </div>
                        <p className="text-emerald-600 font-mono text-xs tracking-widest uppercase mt-1">{org.slug}</p>
                    </div>
                </div>
                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-app-border text-app-muted-foreground">
                    {usage?.plan?.name || 'Free Tier'}
                </Badge>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 bg-app-surface-2 rounded-2xl w-fit">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key
                            ? 'bg-app-surface text-app-foreground shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                    >
                        <t.icon size={14} />{t.label}
                    </button>
                ))}
            </div>

            {/* ─── Overview Tab ─────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <OverviewTab
                    org={org}
                    usage={usage}
                    modules={modules}
                    activeModules={activeModules}
                    encryptionStatus={encryptionStatus}
                    togglingEncryption={togglingEncryption}
                    onManagePlan={() => setActiveTab('billing')}
                    onManageModules={() => setActiveTab('modules')}
                    onAssignClient={() => setShowClientDialog(true)}
                    onToggleEncryption={async () => {
                        setTogglingEncryption(true)
                        try {
                            const result = await toggleOrgEncryption(orgId)
                            toast.success(result.message || 'Encryption toggled')
                            const s = await getOrgEncryptionStatus(orgId)
                            setEncryptionStatus(s)
                        } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : 'Failed to toggle encryption')
                        } finally { setTogglingEncryption(false) }
                    }}
                />
            )}

            {/* ─── Modules Tab ──────────────────────────────────────────── */}
            {activeTab === 'modules' && (
                <ModulesTab
                    modules={modules}
                    toggling={toggling}
                    onToggle={handleToggle}
                    onFeatureToggle={handleFeatureToggle}
                />
            )}

            {/* ─── Users Tab ────────────────────────────────────────────── */}
            {activeTab === 'users' && (
                <UsersTab
                    users={users}
                    onCreateUser={() => setShowCreateUser(true)}
                    onResetPassword={(user) => setResetTarget(user)}
                />
            )}

            {/* ─── Sites Tab ────────────────────────────────────────────── */}
            {activeTab === 'sites' && (
                <SitesTab
                    sites={sites}
                    onCreateSite={() => setShowCreateSite(true)}
                    onToggleSite={handleToggleSite}
                />
            )}

            {/* ─── Usage Tab ────────────────────────────────────────────── */}
            {activeTab === 'usage' && (
                <UsageTab usage={usage} onManageModules={() => setActiveTab('modules')} />
            )}

            {/* ─── Billing Tab ──────────────────────────────────────────── */}
            {activeTab === 'billing' && (
                <BillingTab org={org} usage={usage} billing={billing} onPlanSwitch={setPlanSwitchTarget} />
            )}

            {/* ─── Add-ons Tab ────────────────────────────────────────── */}
            {activeTab === 'addons' && (
                <AddonsTab
                    addons={addons}
                    orgId={orgId}
                    purchasingAddon={purchasingAddon}
                    cancellingAddon={cancellingAddon}
                    onPurchase={async (addonId, addonName) => {
                        setPurchasingAddon(addonId)
                        try {
                            const result = await purchaseAddon(orgId, addonId)
                            toast.success(result.message || `${addonName} purchased`)
                            const addonsData = await getOrgAddons(orgId)
                            setAddons(addonsData || { purchased: [], available: [] })
                        } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : 'Failed to purchase add-on')
                        } finally { setPurchasingAddon(null) }
                    }}
                    onCancel={async (purchaseId, addonName) => {
                        setCancellingAddon(purchaseId)
                        try {
                            const result = await cancelAddon(orgId, purchaseId)
                            toast.success(result.message || `${addonName} cancelled`)
                            const addonsData = await getOrgAddons(orgId)
                            setAddons(addonsData || { purchased: [], available: [] })
                        } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : 'Failed to cancel add-on')
                        } finally { setCancellingAddon(null) }
                    }}
                />
            )}

            {/* ─── Branding Tab ──────────────────────────────────────────── */}
            {activeTab === 'branding' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-app-foreground">Login Page Branding</h3>
                        <p className="text-sm text-app-muted-foreground">Customize how {org.name}'s login page appears to users.</p>
                    </div>
                    <BrandingTab
                        orgId={orgId}
                        orgSettings={org.settings || {}}
                        onSave={async (updatedSettings) => {
                            await updateOrgSettings(orgId, updatedSettings);
                            const refreshed = await getOrganization(orgId);
                            setOrg(refreshed);
                        }}
                    />
                </div>
            )}

            {/* ─── Create User Dialog ───────────────────────────────────── */}
            <CreateUserDialog
                open={showCreateUser}
                onOpenChange={setShowCreateUser}
                onCreate={async (user) => {
                    try {
                        await createOrgUser(orgId, user)
                        toast.success("User created")
                        setShowCreateUser(false)
                        const data = await getOrgUsers(orgId)
                        setUsers(Array.isArray(data) ? data : [])
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create user") }
                }}
            />

            {/* ─── Reset Password Dialog ────────────────────────────────── */}
            <ResetPasswordDialog
                user={resetTarget}
                onClose={() => setResetTarget(null)}
                onReset={async (userId, password) => {
                    try {
                        await resetOrgUserPassword(orgId, userId, password)
                        toast.success("Password reset")
                        setResetTarget(null)
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to reset password") }
                }}
            />

            {/* ─── Create Site Dialog ───────────────────────────────────── */}
            <CreateSiteDialog
                open={showCreateSite}
                onOpenChange={setShowCreateSite}
                onCreate={async (site) => {
                    try {
                        await createOrgSite(orgId, site)
                        toast.success("Site created")
                        setShowCreateSite(false)
                        const data = await getOrgSites(orgId)
                        setSites(Array.isArray(data) ? data : [])
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create site") }
                }}
            />

            {/* ─── Plan Switch Confirmation Dialog ─────────────────────── */}
            <PlanSwitchDialog
                plan={planSwitchTarget}
                usage={usage}
                switching={switching}
                onCancel={() => setPlanSwitchTarget(null)}
                onConfirm={async () => {
                    if (!planSwitchTarget) return
                    setSwitching(true)
                    const prevHistoryLen = billing?.history?.length ?? 0
                    try {
                        const result = await changeOrgPlan(orgId, planSwitchTarget.id)
                        toast.success(result.message || `Switched to ${planSwitchTarget.name}`)
                        if (result.modules_disabled?.length > 0) {
                            toast.info(`Disabled modules: ${result.modules_disabled.join(", ")}`)
                        }
                        const newUsage = await getOrgUsage(orgId)
                        setUsage(newUsage)
                        const normalizeBilling = (b: unknown) =>
                            (b as SaasBillingData)?.history
                                ? (b as SaasBillingData)
                                : { history: Array.isArray(b) ? (b as unknown[]) : [], balance: { total_paid: "0.00", total_credits: "0.00", net_balance: "0.00" }, client: null }
                        let newBilling = normalizeBilling(await getOrgBilling(orgId))
                        if (newBilling.history.length <= prevHistoryLen) {
                            await new Promise(r => setTimeout(r, 600))
                            newBilling = normalizeBilling(await getOrgBilling(orgId))
                        }
                        setBilling(newBilling)
                        setPlanSwitchTarget(null)
                        router.refresh()
                    } catch (err: unknown) {
                        toast.error((err instanceof Error ? err.message : String(err)) || "Failed to change plan")
                    } finally {
                        setSwitching(false)
                    }
                }}
            />

            {/* ─── Client Assignment Dialog ────────────────────────────── */}
            <ClientAssignDialog
                open={showClientDialog}
                onOpenChange={setShowClientDialog}
                allClients={allClients}
                usage={usage}
                savingClient={savingClient}
                onSearchClients={async (q) => {
                    const data = await listClients(q)
                    setAllClients(Array.isArray(data) ? data : [])
                }}
                onAssign={async (clientId) => {
                    try {
                        await setOrgClient(orgId, clientId)
                        toast.success("Client assigned")
                        setShowClientDialog(false)
                        const [u, b] = await Promise.all([getOrgUsage(orgId), getOrgBilling(orgId)])
                        setUsage(u)
                        setBilling(b?.history ? b : { history: Array.isArray(b) ? b : [], balance: { total_paid: "0.00", total_credits: "0.00", net_balance: "0.00" }, client: null })
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to assign client") }
                }}
                onUnassign={async () => {
                    try {
                        await setOrgClient(orgId, null)
                        toast.success("Client unassigned")
                        setShowClientDialog(false)
                        const [u, b] = await Promise.all([getOrgUsage(orgId), getOrgBilling(orgId)])
                        setUsage(u)
                        setBilling(b?.history ? b : { history: Array.isArray(b) ? b : [], balance: { total_paid: "0.00", total_credits: "0.00", net_balance: "0.00" }, client: null })
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to unassign client") }
                }}
                onCreateAndAssign={async (client) => {
                    setSavingClient(true)
                    try {
                        const result = await createClient(client)
                        if (result?.id) {
                            await setOrgClient(orgId, result.id)
                            toast.success("Client created and assigned")
                            setShowClientDialog(false)
                            const [u, b] = await Promise.all([getOrgUsage(orgId), getOrgBilling(orgId)])
                            setUsage(u)
                            setBilling(b?.history ? b : { history: Array.isArray(b) ? b : [], balance: { total_paid: "0.00", total_credits: "0.00", net_balance: "0.00" }, client: null })
                        }
                    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create client") }
                    finally { setSavingClient(false) }
                }}
            />
        </div>
    )
}
