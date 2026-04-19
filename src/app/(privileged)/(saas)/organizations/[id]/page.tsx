'use client'

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft, Users, Loader2, Layers, Activity,
    CreditCard, TrendingUp, Paintbrush, Building2, Puzzle,
} from "lucide-react"

import type { SaasPlan } from "@/types/erp"
import { BrandingTab } from "./_components/BrandingTab"
import { BillingTab } from "./_components/BillingTab"
import { AddonsTab } from "./_components/AddonsTab"
import { OverviewTab } from "./_components/OverviewTab"
import { ModulesTab } from "./_components/ModulesTab"
import { UsersTab } from "./_components/UsersTab"
import { SitesTab } from "./_components/SitesTab"
import { UsageTab } from "./_components/UsageTab"
import { CreateUserDialog, ResetPasswordDialog, CreateSiteDialog, PlanSwitchDialog, ClientAssignDialog } from "./_components/OrgDialogs"
import { useOrganizationDetail } from "./_hooks/useOrganizationDetail"

type TabKey = 'overview' | 'modules' | 'usage' | 'billing' | 'users' | 'sites' | 'addons' | 'branding'

export default function OrganizationDetailPage() {
    const params = useParams()
    const router = useRouter()
    const orgId = params.id as string

    const d = useOrganizationDetail(orgId)

    const [activeTab, setActiveTab] = useState<TabKey>('overview')
    const [showCreateUser, setShowCreateUser] = useState(false)
    const [resetTarget, setResetTarget] = useState<Record<string, unknown> | null>(null)
    const [showCreateSite, setShowCreateSite] = useState(false)
    const [planSwitchTarget, setPlanSwitchTarget] = useState<SaasPlan | null>(null)
    const [showClientDialog, setShowClientDialog] = useState(false)

    if (d.loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
                <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto" />
                <p className="text-app-muted-foreground font-medium text-sm">Loading organization...</p>
            </div>
        </div>
    )

    if (!d.org) return (
        <div className="p-12 text-center">
            <h2 className="text-xl font-bold text-app-foreground">Organization Not Found</h2>
            <Button variant="ghost" onClick={() => router.push('/organizations')} className="mt-4">← Back to Organizations</Button>
        </div>
    )

    const tabs: { key: TabKey; label: string; icon: any }[] = [
        { key: 'overview', label: 'Overview', icon: Activity },
        { key: 'modules', label: 'Modules', icon: Layers },
        { key: 'addons', label: `Add-ons (${d.addons.purchased?.filter((a: Record<string, any>) => a.status === 'active').length || 0})`, icon: Puzzle },
        { key: 'users', label: `Users (${d.users.length})`, icon: Users },
        { key: 'sites', label: `Sites (${d.sites.length})`, icon: Building2 },
        { key: 'usage', label: 'Usage', icon: TrendingUp },
        { key: 'billing', label: 'Billing', icon: CreditCard },
        { key: 'branding', label: 'Branding', icon: Paintbrush },
    ]

    const activeModules = d.modules.filter(m => m.status === 'INSTALLED').length

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
                            <h1 className="text-3xl font-black text-app-foreground tracking-tight">{d.org.name}</h1>
                            <Badge className={d.org.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}>
                                {d.org.is_active ? 'Active' : 'Suspended'}
                            </Badge>
                        </div>
                        <p className="text-emerald-600 font-mono text-xs tracking-widest uppercase mt-1">{d.org.slug}</p>
                    </div>
                </div>
                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-app-border text-app-muted-foreground">
                    {d.usage?.plan?.name || 'Free Tier'}
                </Badge>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 bg-app-surface-2 rounded-2xl w-fit">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key
                            ? 'bg-app-surface text-app-foreground shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                    >
                        <t.icon size={14} />{t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <OverviewTab
                    org={d.org}
                    usage={d.usage}
                    modules={d.modules}
                    activeModules={activeModules}
                    encryptionStatus={d.encryptionStatus}
                    togglingEncryption={d.togglingEncryption}
                    onManagePlan={() => setActiveTab('billing')}
                    onManageModules={() => setActiveTab('modules')}
                    onAssignClient={() => setShowClientDialog(true)}
                    onToggleEncryption={d.toggleEncryption}
                />
            )}

            {activeTab === 'modules' && (
                <ModulesTab
                    modules={d.modules}
                    toggling={d.toggling}
                    onToggle={d.toggleModule}
                    onFeatureToggle={d.toggleFeature}
                />
            )}

            {activeTab === 'users' && (
                <UsersTab
                    users={d.users}
                    onCreateUser={() => setShowCreateUser(true)}
                    onResetPassword={(user) => setResetTarget(user)}
                />
            )}

            {activeTab === 'sites' && (
                <SitesTab
                    sites={d.sites}
                    onCreateSite={() => setShowCreateSite(true)}
                    onToggleSite={d.toggleSite}
                />
            )}

            {activeTab === 'usage' && (
                <UsageTab usage={d.usage} onManageModules={() => setActiveTab('modules')} />
            )}

            {activeTab === 'billing' && (
                <BillingTab org={d.org} usage={d.usage} billing={d.billing} onPlanSwitch={setPlanSwitchTarget} />
            )}

            {activeTab === 'addons' && (
                <AddonsTab
                    addons={d.addons}
                    orgId={orgId}
                    purchasingAddon={d.purchasingAddon}
                    cancellingAddon={d.cancellingAddon}
                    onPurchase={d.purchase}
                    onCancel={d.cancel}
                />
            )}

            {activeTab === 'branding' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-app-foreground">Login Page Branding</h3>
                        <p className="text-sm text-app-muted-foreground">Customize how {d.org.name}'s login page appears to users.</p>
                    </div>
                    <BrandingTab
                        orgId={orgId}
                        orgSettings={d.org.settings || {}}
                        onSave={d.updateSettings}
                    />
                </div>
            )}

            <CreateUserDialog
                open={showCreateUser}
                onOpenChange={setShowCreateUser}
                onCreate={async (user) => {
                    await d.createUser(user)
                    setShowCreateUser(false)
                }}
            />

            <ResetPasswordDialog
                user={resetTarget}
                onClose={() => setResetTarget(null)}
                onReset={async (userId, password) => {
                    await d.resetPassword(userId, password)
                    setResetTarget(null)
                }}
            />

            <CreateSiteDialog
                open={showCreateSite}
                onOpenChange={setShowCreateSite}
                onCreate={async (site) => {
                    await d.createSite(site)
                    setShowCreateSite(false)
                }}
            />

            <PlanSwitchDialog
                plan={planSwitchTarget}
                usage={d.usage}
                switching={d.switching}
                onCancel={() => setPlanSwitchTarget(null)}
                onConfirm={async () => {
                    if (!planSwitchTarget) return
                    await d.switchPlan(planSwitchTarget)
                    setPlanSwitchTarget(null)
                }}
            />

            <ClientAssignDialog
                open={showClientDialog}
                onOpenChange={setShowClientDialog}
                allClients={d.allClients}
                usage={d.usage}
                savingClient={d.savingClient}
                onSearchClients={d.searchClients}
                onAssign={async (clientId) => {
                    await d.assignClient(clientId)
                    setShowClientDialog(false)
                }}
                onUnassign={async () => {
                    await d.unassignClient()
                    setShowClientDialog(false)
                }}
                onCreateAndAssign={async (client) => {
                    await d.createAndAssignClient(client)
                    setShowClientDialog(false)
                }}
            />
        </div>
    )
}
