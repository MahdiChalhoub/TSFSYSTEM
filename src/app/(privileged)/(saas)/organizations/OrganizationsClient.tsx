'use client'
import { useState } from "react"
import { SaasOrganization, BusinessType, Currency, SaasModule } from "@/types/erp"
import { useRouter } from "next/navigation"
import { getOrganizations, toggleOrganizationStatus, createOrganization, deleteOrganization } from "./actions"
import { getOrgModules, toggleOrgModule, updateOrgModuleFeatures } from "@/app/actions/saas/modules"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDynamicBranding } from "@/lib/saas_config"
import {
    Building2, Plus, Globe, ShieldCheck, Activity, Trash2, Zap, Settings2, Power,
    Users, Layers, Mail, Phone, Search, X, Sparkles, MapPin, ArrowRight,
    Check, Store, Package
} from "lucide-react"

/* ─── STYLE HELPERS ──────────────────────────────────────────────────────── */
function gradBg(v: string) {
    return { background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 70%, black))` }
}
function softBg(v: string, pct = 12) {
    return { backgroundColor: `color-mix(in srgb, var(${v}) ${pct}%, transparent)` }
}

/* ─── MAIN CLIENT ─────────────────────────────────────────────────────────── */
interface Props {
    initialOrgs: SaasOrganization[]
    businessTypes: BusinessType[]
    currencies: Currency[]
}

export function OrganizationsClient({ initialOrgs, businessTypes, currencies }: Props) {
    const [orgs, setOrgs] = useState<SaasOrganization[]>(initialOrgs)
    const [pendingDeleteOrg, setPendingDeleteOrg] = useState<SaasOrganization | null>(null)
    const branding = useDynamicBranding()
    const router = useRouter()

    // ─── Filters
    const [search, setSearch] = useState('')
    const [filterPlan, setFilterPlan] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')

    const uniquePlans = [...new Set(orgs.map(o => o.current_plan_name || 'Free Tier'))].sort()

    const filteredOrgs = orgs.filter(o => {
        if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !(o.slug ?? '').toLowerCase().includes(search.toLowerCase())) return false
        if (filterPlan !== 'all' && (o.current_plan_name || 'Free Tier') !== filterPlan) return false
        if (filterStatus === 'active' && !o.is_active) return false
        if (filterStatus === 'suspended' && o.is_active) return false
        return true
    })
    const hasFilters = search || filterPlan !== 'all' || filterStatus !== 'all'

    async function reload() {
        try {
            const data = await getOrganizations()
            if (Array.isArray(data)) setOrgs(data)
        } catch { /* silently fail — data is stale but present */ }
    }

    async function handleToggle(id: string, currentActive: boolean, slug: string) {
        if (slug === 'saas') return toast.error("Cannot modify the master SaaS organization.")
        try {
            const result = await toggleOrganizationStatus(id, currentActive)
            if (result?.error) toast.error(result.error)
            else toast.success(currentActive ? "Organization suspended" : "Organization activated")
            reload()
        } catch (e: unknown) { toast.error(parseErr(e) || "Failed to update status") }
    }

    async function handleDelete(org: Record<string, any>) {
        if (org.slug === 'saas') return toast.error("Cannot delete the master SaaS organization.")
        try {
            const result = await deleteOrganization(org.id)
            if (result?.error) toast.error(result.error)
            else toast.success(result?.message || "Organization deleted")
            reload()
        } catch (e: unknown) { toast.error(parseErr(e) || "Failed to delete organization.") }
    }

    function parseErr(e: unknown): string {
        try { const m = e instanceof Error ? e.message : String(e); if (m) { const p = JSON.parse(m); return p?.error || m } } catch { }
        return e instanceof Error ? e.message : String(e ?? 'Unknown error')
    }

    // ─── Create Dialog State
    const [newOrg, setNewOrg] = useState({ name: '', slug: '', business_email: '', phone: '', country: '', business_type: '', base_currency: '' })
    const [isCreating, setIsCreating] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    async function handleCreate() {
        if (!newOrg.name || !newOrg.slug) return toast.error("Business name and URL slug are required")
        if (!/^[a-z0-9-]+$/.test(newOrg.slug)) return toast.error("Slug: lowercase letters, numbers, hyphens only")
        setIsCreating(true)
        try {
            const result = await createOrganization(newOrg)
            if (result?.error) toast.error(result.error)
            else {
                toast.success("Organization provisioned successfully")
                setCreateOpen(false)
                setNewOrg({ name: '', slug: '', business_email: '', phone: '', country: '', business_type: '', base_currency: '' })
                reload()
            }
        } catch (e: unknown) { toast.error(parseErr(e) || "Provisioning failed") }
        finally { setIsCreating(false) }
    }

    // ─── Modules Dialog State
    const [selectedOrg, setSelectedOrg] = useState<SaasOrganization | null>(null)
    const [orgModules, setOrgModules] = useState<SaasModule[]>([])
    const [loadingModules, setLoadingModules] = useState(false)
    const [modulesOpen, setModulesOpen] = useState(false)

    async function handleOpenModules(org: Record<string, any>) {
        setSelectedOrg(org as unknown as SaasOrganization)
        setModulesOpen(true)
        setLoadingModules(true)
        try {
            const data = await getOrgModules(org.id)
            setOrgModules(Array.isArray(data) ? data : [])
        } catch { toast.error("Failed to load modules") }
        finally { setLoadingModules(false) }
    }

    async function handleModuleToggle(moduleCode: string, currentStatus: string) {
        const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
        try {
            const result = await toggleOrgModule(String(selectedOrg!.id), moduleCode, action)
            if (result?.error) toast.error(result.error)
            else toast.success(`Module ${action}d`)
            const data = await getOrgModules(String(selectedOrg!.id))
            setOrgModules(data)
        } catch (e: unknown) { toast.error((e instanceof Error ? e.message : String(e)) || "Failed to toggle module") }
    }

    // ─── KPIs
    const totalOrgs = orgs.length
    const activeOrgs = orgs.filter(o => o.is_active).length
    const totalUsers = orgs.reduce((s, o) => s + (o.user_count ?? 0), 0)
    const totalSites = orgs.reduce((s, o) => s + (o.site_count ?? 0), 0)

    const kpis = [
        { label: 'Organizations', value: totalOrgs, icon: Building2, cssVar: '--app-primary' },
        { label: 'Active', value: activeOrgs, icon: Sparkles, cssVar: '--app-success' },
        { label: 'Users', value: totalUsers, icon: Users, cssVar: '--app-info' },
        { label: 'Sites', value: totalSites, icon: Store, cssVar: '--app-warning' },
    ]

    return (
        <div className="animate-in fade-in duration-500">

            {/* ═══════ HEADER ═══════════════════════════════════════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={gradBg('--app-primary')}>
                        <Building2 size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-app-foreground tracking-tight">Tenant Registry</h1>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                            {filteredOrgs.length} of {totalOrgs} entities
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="h-11 px-6 rounded-xl text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2.5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                    style={gradBg('--app-primary')}
                >
                    <Plus size={15} strokeWidth={3} /> Register Instance
                </button>
            </div>

            {/* ═══════ KPI STRIP ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {kpis.map(k => {
                    const Icon = k.icon
                    return (
                        <div key={k.label} className="flex items-center gap-3 p-3.5 rounded-xl bg-app-surface border border-app-border/50">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={softBg(k.cssVar, 15)}>
                                <Icon size={16} style={{ color: `var(${k.cssVar})` }} />
                            </div>
                            <div>
                                <div className="text-lg font-black text-app-foreground leading-none">{k.value}</div>
                                <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">{k.label}</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ═══════ FILTERS ═════════════════════════════════════════════ */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 text-[12px] font-semibold border border-app-border rounded-xl bg-app-background text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="h-10 px-4 text-[11px] font-bold border border-app-border rounded-xl bg-app-background text-app-foreground focus:ring-2 focus:ring-app-primary/20 cursor-pointer">
                    <option value="all">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
                    className="h-10 px-4 text-[11px] font-bold border border-app-border rounded-xl bg-app-background text-app-foreground focus:ring-2 focus:ring-app-primary/20 cursor-pointer">
                    <option value="all">All Plans</option>{uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {hasFilters && (
                    <button onClick={() => { setSearch(''); setFilterPlan('all'); setFilterStatus('all') }}
                        className="h-10 px-4 text-[10px] font-bold text-app-error uppercase tracking-widest flex items-center gap-1.5 rounded-xl border border-app-error/20 bg-app-error/5 hover:bg-app-error hover:text-white transition-all">
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {/* ═══════ ORG GRID ════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrgs.length === 0 ? (
                    <div className="col-span-full py-24 text-center bg-app-background/50 rounded-2xl border border-dashed border-app-border">
                        <Building2 size={36} className="mx-auto text-app-muted-foreground opacity-30" />
                        <p className="text-[11px] font-bold text-app-muted-foreground mt-3">
                            {hasFilters ? 'No organizations match filters' : 'No organizations registered'}
                        </p>
                    </div>
                ) : filteredOrgs.map(org => {
                    const isSaas = org.slug === 'saas'
                    return (
                        <div key={org.id}
                            className={`group relative bg-app-surface rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer ${isSaas ? 'border-app-warning/30' : 'border-app-border/50 hover:border-app-primary/30'}`}
                            onClick={() => router.push(`/organizations/${org.id}`)}>
                            {/* Top accent bar */}
                            <div className="h-1 w-full" style={isSaas
                                ? { background: 'linear-gradient(90deg, var(--app-warning), #d97706)' }
                                : { background: `linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, transparent))` }} />

                            <div className="p-5">
                                {/* Row 1: Icon + Name + Badges */}
                                <div className="flex items-start gap-3.5 mb-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 group-hover:rotate-[-3deg] transition-transform duration-300"
                                        style={isSaas ? { background: 'linear-gradient(135deg, var(--app-warning), #d97706)' } : gradBg('--app-primary')}>
                                        {isSaas ? <ShieldCheck size={20} className="text-white" /> : <Building2 size={18} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[15px] font-black text-app-foreground tracking-tight truncate group-hover:text-app-primary transition-colors">{org.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Globe size={10} className="text-app-muted-foreground" />
                                            <span className="text-[10px] font-bold text-app-muted-foreground truncate">{org.slug}{branding.suffix}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${org.is_active ? 'bg-app-primary/10 text-app-success' : 'bg-app-error/10 text-app-error'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${org.is_active ? 'bg-app-primary' : 'bg-app-error'}`} />
                                            {org.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                        <span className="text-[9px] font-bold text-app-muted-foreground bg-app-background px-2 py-0.5 rounded-md">{org.current_plan_name || 'Free'}</span>
                                    </div>
                                </div>

                                {/* Row 2: Stats */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {[
                                        { label: 'Sites', value: org.site_count ?? 0, icon: MapPin },
                                        { label: 'Users', value: org.user_count ?? 0, icon: Users },
                                        { label: 'Modules', value: org.module_count ?? 0, icon: Package },
                                    ].map(s => {
                                        const SIcon = s.icon
                                        return (
                                            <div key={s.label} className="text-center p-2.5 rounded-lg bg-app-background/60 border border-app-border/30">
                                                <div className="text-[15px] font-black text-app-foreground leading-none">{s.value}</div>
                                                <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1 flex items-center justify-center gap-1"><SIcon size={8} /> {s.label}</div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Row 3: Contact */}
                                {(org.business_email || org.client_name) && (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[10px] font-semibold text-app-muted-foreground">
                                        {org.business_email && <span className="flex items-center gap-1"><Mail size={10} />{org.business_email}</span>}
                                        {org.client_name && <span className="flex items-center gap-1"><Users size={10} />{org.client_name}</span>}
                                    </div>
                                )}

                                {/* Row 4: Actions */}
                                <div className="flex gap-2 pt-3 border-t border-app-border/30" onClick={e => e.stopPropagation()}>
                                    <button
                                        className={`flex-1 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${isSaas
                                            ? 'bg-app-background text-app-muted-foreground cursor-not-allowed border border-dashed border-app-border'
                                            : org.is_active
                                                ? 'bg-app-background border border-app-border text-app-muted-foreground hover:bg-app-error/10 hover:text-app-error hover:border-app-error/30'
                                                : 'bg-app-primary/10 border border-app-primary/20 text-app-success hover:bg-app-primary hover:text-white'}`}
                                        onClick={() => handleToggle(String(org.id), !!org.is_active, org.slug ?? '')}
                                        disabled={isSaas}>
                                        <Power size={12} />{org.is_active ? 'Suspend' : 'Activate'}
                                    </button>
                                    <button className="h-9 px-3 rounded-lg border border-app-border bg-app-background text-app-muted-foreground hover:text-app-primary hover:border-app-primary/30 transition-all"
                                        onClick={() => handleOpenModules(org)} title="Manage Modules"><Settings2 size={14} /></button>
                                    {!isSaas && (
                                        <button className="h-9 px-3 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-app-error/10 transition-all"
                                            onClick={() => setPendingDeleteOrg(org)} title="Delete"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ═══════ CREATE DIALOG ═══════════════════════════════════════ */}
            {createOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setCreateOpen(false) }}>
                    <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-app-border/50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-app-border/50 flex items-center gap-3 bg-app-background">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={gradBg('--app-primary')}><Plus size={18} className="text-white" /></div>
                            <div>
                                <h2 className="text-[15px] font-black text-app-foreground">Provision Instance</h2>
                                <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">Create Organization</p>
                            </div>
                            <button onClick={() => setCreateOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-colors"><X size={16} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Business Name <span className="text-app-error">*</span></label>
                                    <input placeholder="e.g. Acme Global Industries" className="w-full bg-app-background border border-app-border rounded-xl px-4 py-2.5 text-[13px] font-semibold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground"
                                        value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} autoFocus />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">URL Slug <span className="text-app-error">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input placeholder="acme-corp" className="flex-1 bg-app-background border border-app-border rounded-xl px-4 py-2.5 text-[13px] font-mono font-bold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground"
                                            value={newOrg.slug} onChange={e => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
                                        <span className="text-[10px] font-bold text-app-muted-foreground bg-app-background px-3 py-2.5 rounded-xl border border-app-border shrink-0">{branding.suffix}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-app-border/50">
                                <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest mb-3">Optional Details</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest flex items-center gap-1"><Mail size={9} /> Email</label>
                                        <input placeholder="billing@acme.com" type="email"
                                            className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[12px] text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground"
                                            value={newOrg.business_email} onChange={e => setNewOrg({ ...newOrg, business_email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest flex items-center gap-1"><Phone size={9} /> Phone</label>
                                        <input placeholder="+1 555-0123"
                                            className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[12px] text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground"
                                            value={newOrg.phone} onChange={e => setNewOrg({ ...newOrg, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest flex items-center gap-1"><Building2 size={9} /> Industry</label>
                                        <select className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[12px] text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 cursor-pointer"
                                            value={newOrg.business_type} onChange={e => setNewOrg({ ...newOrg, business_type: e.target.value })}>
                                            <option value="">Select...</option>{businessTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest flex items-center gap-1"><Globe size={9} /> Currency</label>
                                        <select className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[12px] text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 cursor-pointer"
                                            value={newOrg.base_currency} onChange={e => setNewOrg({ ...newOrg, base_currency: e.target.value })}>
                                            <option value="">Select...</option>{currencies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl border border-app-border/50 bg-app-background/50 flex items-start gap-3">
                                <Zap size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                <p className="text-[10px] text-app-muted-foreground leading-relaxed">Provisioning creates: Sites, Warehouses, Chart of Accounts, Posting Rules, and Financial Settings.</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-app-border/50 bg-app-background flex justify-end gap-3">
                            <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 rounded-xl border border-app-border text-[11px] font-bold text-app-muted-foreground hover:bg-app-surface hover:text-app-foreground transition-all">Cancel</button>
                            <button onClick={handleCreate} disabled={isCreating}
                                className="px-6 py-2.5 rounded-xl text-[11px] font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center gap-2"
                                style={gradBg('--app-primary')}>
                                {isCreating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {isCreating ? 'Deploying...' : <><ArrowRight size={13} /> Deploy Tenant</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ MODULES DIALOG ═════════════════════════════════════ */}
            {modulesOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModulesOpen(false) }}>
                    <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-app-border/50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-app-border/50 flex items-center gap-3 bg-app-background">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={gradBg('--app-info')}><Layers size={18} className="text-white" /></div>
                            <div>
                                <h2 className="text-[15px] font-black text-app-foreground">Module Management</h2>
                                <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">{selectedOrg?.name}</p>
                            </div>
                            <button onClick={() => setModulesOpen(false)} className="ml-auto p-2 rounded-xl hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-colors"><X size={16} /></button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                            {loadingModules ? (
                                <div className="py-16 text-center">
                                    <Activity size={24} className="mx-auto animate-spin opacity-30" style={{ color: 'var(--app-primary)' }} />
                                    <p className="text-[10px] font-bold text-app-muted-foreground mt-3 uppercase tracking-widest">Loading modules...</p>
                                </div>
                            ) : orgModules.length === 0 ? (
                                <div className="py-16 text-center bg-app-background/50 rounded-xl border border-dashed border-app-border">
                                    <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">No modules found</p>
                                </div>
                            ) : orgModules.map(m => (
                                <div key={m.code} className="p-4 bg-app-background rounded-xl border border-app-border/50 group/mod hover:border-app-primary/30 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                                style={m.status === 'INSTALLED' ? softBg('--app-success', 15) : softBg('--app-muted-foreground', 8)}>
                                                <Zap size={16} style={{ color: m.status === 'INSTALLED' ? 'var(--app-success)' : 'var(--app-muted-foreground)' }} />
                                            </div>
                                            <div>
                                                <h4 className="text-[13px] font-bold text-app-foreground">{m.name}</h4>
                                                <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">{m.code}</p>
                                            </div>
                                        </div>
                                        {m.is_core ? (
                                            <span className="px-3 py-1 rounded-md bg-app-primary/10 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>Core</span>
                                        ) : (
                                            <button
                                                className={`h-8 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${m.status === 'INSTALLED'
                                                    ? 'bg-app-error/10 text-app-error hover:bg-app-error hover:text-white'
                                                    : 'text-white shadow-sm hover:shadow-lg hover:scale-[1.02]'}`}
                                                style={m.status !== 'INSTALLED' ? gradBg('--app-success') : {}}
                                                onClick={() => handleModuleToggle(m.code, m.status ?? '')}>
                                                {m.status === 'INSTALLED' ? 'Disable' : 'Enable'}
                                            </button>
                                        )}
                                    </div>
                                    {m.status === 'INSTALLED' && Array.isArray(m.available_features) && m.available_features.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-app-border/30">
                                            <p className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"><Settings2 size={10} /> Features</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(m.available_features as Array<Record<string, any>>).map((f: Record<string, any>) => (
                                                    <label key={f.code} className="flex items-center gap-2 p-2 rounded-lg border border-app-border/30 hover:bg-app-surface cursor-pointer transition-all group/flag">
                                                        <div className="relative">
                                                            <input type="checkbox" className="sr-only peer" checked={m.active_features?.includes(f.code) || false}
                                                                onChange={async (e) => {
                                                                    const newFeatures = e.target.checked ? [...(m.active_features || []), f.code] : (m.active_features || []).filter((c: string) => c !== f.code)
                                                                    try {
                                                                        await updateOrgModuleFeatures(String(selectedOrg!.id), m.code, newFeatures)
                                                                        toast.success("Feature updated")
                                                                        const data = await getOrgModules(String(selectedOrg!.id))
                                                                        setOrgModules(data)
                                                                    } catch { toast.error("Update failed") }
                                                                }} />
                                                            <div className="w-4 h-4 border-2 border-app-border rounded peer-checked:border-app-primary peer-checked:bg-app-primary flex items-center justify-center transition-all">
                                                                <Check size={10} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-app-muted-foreground group-hover/flag:text-app-foreground transition-colors">{f.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-3 border-t border-app-border/50 bg-app-background flex justify-end">
                            <button onClick={() => setModulesOpen(false)} className="px-5 py-2 rounded-xl border border-app-border text-[11px] font-bold text-app-muted-foreground hover:bg-app-surface hover:text-app-foreground transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ DELETE CONFIRM ═════════════════════════════════════ */}
            <ConfirmDialog
                open={pendingDeleteOrg !== null}
                onOpenChange={(open) => { if (!open) setPendingDeleteOrg(null) }}
                onConfirm={() => { if (pendingDeleteOrg) handleDelete(pendingDeleteOrg); setPendingDeleteOrg(null) }}
                title="Delete Organization"
                description={`Are you sure you want to delete "${pendingDeleteOrg?.name || ''}"? This organization must be suspended and inactive for 24+ hours first. This action cannot be undone.`}
                confirmText="Delete Organization"
                variant="danger"
            />
        </div>
    )
}
