'use client'

import { useEffect, useState } from "react"
import { SaasOrganization, BusinessType, Currency, SaasModule } from "@/types/erp"
import { useRouter } from "next/navigation"
import { getOrganizations, toggleOrganizationStatus, createOrganization, deleteOrganization, getBusinessTypes, getCurrencies } from "./actions"
import { getOrgModules, toggleOrgModule, updateOrgModuleFeatures } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, Plus, Globe, ShieldCheck, Activity, Trash2, Zap, Settings2, Power, Lock, Users, Layers, Clock, Mail, Phone, MapPin, Search, Filter, X } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLATFORM_CONFIG, useDynamicBranding } from "@/lib/saas_config"

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState<SaasOrganization[]>([])
    const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [pendingDeleteOrg, setPendingDeleteOrg] = useState<SaasOrganization | null>(null)
    const branding = useDynamicBranding();
    const router = useRouter();

    // ─── Filters ─────────────────────────────────────────────
    const [search, setSearch] = useState('')
    const [filterPlan, setFilterPlan] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [filterCountry, setFilterCountry] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')

    // Derive unique filter options from data
    const uniquePlans = [...new Set(orgs.map(o => o.current_plan_name || 'Free Tier'))].sort()
    const uniqueTypes = [...new Set(orgs.map(o => o.business_type_name || '').filter(Boolean))].sort()
    const uniqueCountries = [...new Set(orgs.map(o => o.country || '').filter(Boolean))].sort()

    // Apply filters
    const filteredOrgs = orgs.filter(o => {
        if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !(o.slug || '').toLowerCase().includes(search.toLowerCase())) return false
        if (filterPlan !== 'all' && (o.current_plan_name || 'Free Tier') !== filterPlan) return false
        if (filterType !== 'all' && (o.business_type_name || '') !== filterType) return false
        if (filterCountry !== 'all' && !(o.country || '').toLowerCase().includes(filterCountry.toLowerCase())) return false
        if (filterStatus === 'active' && !o.is_active) return false
        if (filterStatus === 'suspended' && o.is_active) return false
        return true
    })
    const hasFilters = search || filterPlan !== 'all' || filterType !== 'all' || filterCountry !== 'all' || filterStatus !== 'all'

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    async function loadData() {
        try {
            const [data, btData, cData] = await Promise.all([
                getOrganizations(),
                getBusinessTypes(),
                getCurrencies(),
            ])
            if (Array.isArray(data)) {
                setOrgs(data)
            } else {
                setOrgs([])
                toast.error("Invalid data format received")
            }
            if (Array.isArray(btData)) setBusinessTypes(btData)
            if (Array.isArray(cData)) setCurrencies(cData)
        } catch {
            toast.error("Failed to load organizations")
        } finally {
            setLoading(false)
        }
    }

    async function handleToggle(id: string, currentActive: boolean, slug: string) {
        if (slug === 'saas') {
            return toast.error("Cannot modify the master SaaS organization.")
        }
        try {
            const result = await toggleOrganizationStatus(id, currentActive)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success(currentActive ? "Organization suspended" : "Organization activated")
            }
            loadData()
        } catch (e: unknown) {
            const msg = tryParseError(e)
            toast.error(msg || "Failed to update status")
        }
    }

    async function handleDelete(org: any) {
        if (org.slug === 'saas') {
            return toast.error("Cannot delete the master SaaS organization.")
        }
        try {
            const result = await deleteOrganization(org.id)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success(result?.message || "Organization deleted")
            }
            loadData()
        } catch (e: unknown) {
            const msg = tryParseError(e)
            toast.error(msg || "Failed to delete organization.")
        }
    }

    // Parse error messages from backend JSON responses
    function tryParseError(e: any): string {
        try {
            if (e?.message) {
                const parsed = JSON.parse((e instanceof Error ? e.message : String(e)))
                return parsed?.error || (e instanceof Error ? e.message : String(e))
            }
        } catch { }
        return e?.message || "Unknown error"
    }

    const [newOrg, setNewOrg] = useState({ name: '', slug: '', business_email: '', phone: '', country: '', business_type: '', base_currency: '' })
    const [isCreating, setIsCreating] = useState(false)
    const [open, setOpen] = useState(false)

    async function handleCreate() {
        if (!newOrg.name || !newOrg.slug) return toast.error("Business name and URL slug are required")
        if (!/^[a-z0-9-]+$/.test(newOrg.slug)) return toast.error("Slug must contain only lowercase letters, numbers, and hyphens")
        setIsCreating(true)
        try {
            const result = await createOrganization(newOrg)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Organization provisioned successfully")
                setOpen(false)
                setNewOrg({ name: '', slug: '', business_email: '', phone: '', country: '', business_type: '', base_currency: '' })
                loadData()
            }
        } catch (e: unknown) {
            const msg = tryParseError(e)
            toast.error(msg || "Provisioning failed")
        } finally {
            setIsCreating(false)
        }
    }

    const [selectedOrg, setSelectedOrg] = useState<SaasOrganization | null>(null)
    const [orgModules, setOrgModules] = useState<SaasModule[]>([])
    const [loadingModules, setLoadingModules] = useState(false)
    const [modulesOpen, setModulesOpen] = useState(false)

    async function handleOpenModules(org: any) {
        setSelectedOrg(org)
        setModulesOpen(true)
        setLoadingModules(true)
        try {
            const data = await getOrgModules(org.id)
            if (Array.isArray(data)) {
                setOrgModules(data)
            } else {
                setOrgModules([])
                toast.error(data?.error || "Failed to load modules")
            }
        } catch {
            toast.error("Failed to load organization modules")
        } finally {
            setLoadingModules(false)
        }
    }

    async function handleModuleToggle(moduleCode: string, currentStatus: string) {
        if (!selectedOrg) return;
        const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
        try {
            const result = await toggleOrgModule(String(selectedOrg.id), moduleCode, action)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success(`Module ${action}d`)
            }
            const data = await getOrgModules(String(selectedOrg.id))
            setOrgModules(data)
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)) || "Failed to toggle module")
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 md:gap-4">
                <div>
                    <div className="flex items-center gap-2 text-app-success font-bold text-xs uppercase tracking-[0.2em] mb-2">
                        <Building size={14} /> Tenant Registry
                    </div>
                    <h2>Organizations</h2>
                    <p className="text-app-muted-foreground mt-1 md:mt-2 font-medium text-sm md:text-base">Provision and manage multi-tenant business instances</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto bg-app-primary-dark hover:bg-app-primary text-white px-4 md:px-6 py-4 md:py-6 rounded-2xl flex gap-2 font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] text-xs md:text-sm">
                            <Plus size={18} />
                            Register Instance
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-app-surface border-app-border text-app-foreground rounded-[2rem] max-w-lg shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Provision Instance</DialogTitle>
                            <CardDescription className="text-app-muted-foreground">Configure the new business identity and initial settings</CardDescription>
                        </DialogHeader>
                        <div className="space-y-5 pt-4">
                            {/* Required Fields */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest">Business Legal Name *</Label>
                                <Input
                                    placeholder="e.g. Acme Global Industries"
                                    className="bg-app-surface border-app-border rounded-xl py-6 focus:ring-app-primary"
                                    value={newOrg.name}
                                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest">Unique URL Slug *</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="acme-corp"
                                        className="bg-app-surface border-app-border rounded-xl py-6 focus:ring-app-primary font-mono text-app-success"
                                        value={newOrg.slug}
                                        onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                    />
                                    <span className="text-app-muted-foreground font-mono text-xs shrink-0">{branding.suffix}</span>
                                </div>
                            </div>

                            {/* Optional Fields */}
                            <div className="border-t border-app-border pt-4">
                                <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest mb-4">Optional Details</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider flex items-center gap-1"><Mail size={10} /> Email</Label>
                                        <Input
                                            placeholder="billing@acme.com"
                                            type="email"
                                            className="bg-app-surface border-app-border rounded-xl py-5 text-sm"
                                            value={newOrg.business_email}
                                            onChange={(e) => setNewOrg({ ...newOrg, business_email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider flex items-center gap-1"><Phone size={10} /> Phone</Label>
                                        <Input
                                            placeholder="+1 555-0123"
                                            className="bg-app-surface border-app-border rounded-xl py-5 text-sm"
                                            value={newOrg.phone}
                                            onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider flex items-center gap-1"><Building size={10} /> Industry Vector</Label>
                                        <select
                                            className="w-full bg-app-surface border border-app-border rounded-xl py-2.5 px-3 text-sm text-app-foreground focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                                            value={newOrg.business_type}
                                            onChange={(e) => setNewOrg({ ...newOrg, business_type: e.target.value })}
                                        >
                                            <option value="">Select industry...</option>
                                            {businessTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider flex items-center gap-1">Base Currency</Label>
                                        <select
                                            className="w-full bg-app-surface border border-app-border rounded-xl py-2.5 px-3 text-sm text-app-foreground focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                                            value={newOrg.base_currency}
                                            onChange={(e) => setNewOrg({ ...newOrg, base_currency: e.target.value })}
                                        >
                                            <option value="">Select currency...</option>
                                            {currencies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin size={10} /> Country</Label>
                                        <Input
                                            placeholder="e.g. Lebanon"
                                            className="bg-app-surface border-app-border rounded-xl py-5 text-sm"
                                            value={newOrg.country}
                                            onChange={(e) => setNewOrg({ ...newOrg, country: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-app-success-bg rounded-2xl border border-app-success">
                                <div className="flex gap-3">
                                    <Zap className="text-app-success shrink-0" size={18} />
                                    <p className="text-[10px] leading-relaxed text-app-success font-medium">
                                        Provisioning creates: default branch, warehouse, fiscal year with monthly periods, chart of accounts, cash drawer, posting rules, and financial settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-6">
                            <Button
                                className="w-full bg-app-primary-dark hover:bg-app-primary text-white rounded-2xl py-6 font-black shadow-xl shadow-emerald-900/40"
                                onClick={handleCreate}
                                disabled={isCreating}
                            >
                                {isCreating ? "Initializing Engine..." : "Provision Now"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ─── Filter Bar ────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by name or slug..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-app-border rounded-xl bg-app-surface focus:outline-none focus:ring-2 focus:ring-app-primary/30 focus:border-app-success" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs font-bold border border-app-border rounded-xl px-3 py-2.5 bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/30">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
                    className="text-xs font-bold border border-app-border rounded-xl px-3 py-2.5 bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/30">
                    <option value="all">All Plans</option>
                    {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {businessTypes.length > 0 && (
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="text-xs font-bold border border-app-border rounded-xl px-3 py-2.5 bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/30">
                        <option value="all">All Types</option>
                        {businessTypes.map(bt => <option key={bt.id} value={bt.name}>{bt.name}</option>)}
                    </select>
                )}
                <input type="text" placeholder="Filter by country..." value={filterCountry === 'all' ? '' : filterCountry}
                    onChange={e => setFilterCountry(e.target.value || 'all')}
                    className="text-xs font-bold border border-app-border rounded-xl px-3 py-2.5 bg-app-surface text-app-foreground focus:ring-2 focus:ring-app-primary/30 w-[140px]" />
                {hasFilters && (
                    <button onClick={() => { setSearch(''); setFilterPlan('all'); setFilterType('all'); setFilterCountry('all'); setFilterStatus('all') }}
                        className="text-xs font-bold text-app-error hover:text-app-error flex items-center gap-1 px-3 py-2.5 rounded-xl border border-app-error hover:bg-app-error-bg transition-all">
                        <X size={12} /> Clear
                    </button>
                )}
                <span className="text-[10px] text-app-muted-foreground font-bold">{filteredOrgs.length} of {orgs.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-app-muted-foreground font-medium">Loading platform data...</div>
                ) : filteredOrgs.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-app-muted-foreground font-medium">
                        {hasFilters ? 'No organizations match the current filters.' : 'No organizations found.'}
                    </div>
                ) : filteredOrgs.map((org) => {
                    const isSaasOrg = org.slug === 'saas'

                    return (
                        <Card key={org.id}
                            className="bg-app-surface border-app-border hover:border-app-primary/30 transition-all rounded-3xl overflow-hidden group shadow-xl hover:shadow-2xl cursor-pointer"
                            onClick={() => router.push(`/organizations/${org.id}`)}
                        >
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className={`p-3 rounded-2xl shadow-sm border ${isSaasOrg ? 'bg-app-accent-bg text-app-accent border-app-accent' : 'bg-app-success-bg text-app-success border-app-success'}`}>
                                        {isSaasOrg ? <ShieldCheck size={24} /> : <Building size={24} />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isSaasOrg && (
                                            <Badge className="bg-app-accent-bg text-app-accent border-app-accent text-[9px] font-black uppercase tracking-widest">
                                                <Lock size={10} className="mr-1" /> Protected
                                            </Badge>
                                        )}
                                        <Badge className={org.is_active ? "bg-app-success-bg text-app-success border-app-success" : "bg-app-error-bg text-app-error border-app-error"}>
                                            {org.is_active ? 'Active' : 'Suspended'}
                                        </Badge>
                                        <Badge className="bg-app-accent-bg text-app-accent border-app-accent text-[9px] font-black">
                                            {org.current_plan_name || 'Free Tier'}
                                        </Badge>
                                    </div>
                                </div>
                                <CardTitle className="text-2xl font-bold text-app-foreground mt-4">{org.name}</CardTitle>
                                <CardDescription className="text-app-success font-mono text-[10px] tracking-widest uppercase mt-1">
                                    {org.slug}{branding.suffix}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-3 bg-app-surface rounded-2xl border border-app-border text-center">
                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-wider mb-1">Sites</div>
                                        <div className="text-lg font-bold text-app-foreground">{org.site_count ?? 0}</div>
                                    </div>
                                    <div className="p-3 bg-app-surface rounded-2xl border border-app-border text-center">
                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-wider mb-1">Users</div>
                                        <div className="text-lg font-bold text-app-foreground">{org.user_count ?? 0}</div>
                                    </div>
                                    <div className="p-3 bg-app-surface rounded-2xl border border-app-border text-center">
                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase tracking-wider mb-1">Modules</div>
                                        <div className="text-lg font-bold text-app-foreground">{org.module_count ?? 0}</div>
                                    </div>
                                </div>

                                {org.business_email && (
                                    <div className="text-xs text-app-muted-foreground flex items-center gap-2 px-1">
                                        <Mail size={12} /> {org.business_email}
                                    </div>
                                )}
                                {org.client_name && (
                                    <div className="text-xs text-app-muted-foreground flex items-center gap-2 px-1">
                                        <Users size={12} /> <span className="font-semibold text-app-muted-foreground">{org.client_name}</span>
                                    </div>
                                )}

                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    {/* Suspend / Activate */}
                                    <Button
                                        variant="outline"
                                        className={`flex-1 py-5 rounded-2xl border-app-border font-bold text-sm transition-all ${isSaasOrg
                                            ? 'bg-app-surface text-app-faint cursor-not-allowed'
                                            : org.is_active
                                                ? 'bg-app-surface hover:bg-app-warning-bg text-app-muted-foreground hover:text-app-warning hover:border-app-warning'
                                                : 'bg-app-success-bg hover:bg-app-success-bg text-app-success hover:border-app-success'
                                            }`}
                                        onClick={() => handleToggle(String(org.id), Boolean(org.is_active), org.slug || '')}
                                        disabled={isSaasOrg}
                                    >
                                        <Power size={16} className="mr-2" />
                                        {org.is_active ? 'Suspend' : 'Activate'}
                                    </Button>

                                    {/* Features / Modules */}
                                    <Button
                                        variant="outline"
                                        className="px-5 py-5 rounded-2xl border-app-success bg-app-success-bg text-app-success hover:bg-app-success-bg transition-all font-bold shadow-sm"
                                        onClick={() => handleOpenModules(org)}
                                    >
                                        <Settings2 size={18} />
                                    </Button>

                                    {/* Delete */}
                                    <Button
                                        variant="ghost"
                                        className={`px-5 py-5 rounded-2xl transition-all ${isSaasOrg
                                            ? 'text-app-faint cursor-not-allowed'
                                            : 'text-app-muted-foreground hover:text-app-error hover:bg-app-error-bg'
                                            }`}
                                        onClick={() => setPendingDeleteOrg(org)}
                                        disabled={isSaasOrg}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Feature Activation Dialog */}
            <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
                <DialogContent className="bg-app-surface border-app-border text-app-foreground rounded-[2rem] max-w-2xl overflow-hidden p-0 shadow-2xl">
                    <div className="p-8 bg-gradient-to-r from-emerald-50 to-white border-b border-app-border">
                        <DialogTitle className="text-2xl font-black flex items-center gap-3">
                            <Layers size={24} className="text-app-success" /> Feature Activation
                        </DialogTitle>
                        <CardDescription className="text-app-muted-foreground mt-1">
                            Managing modules for <span className="text-app-success font-bold">{selectedOrg?.name}</span>
                        </CardDescription>
                    </div>

                    <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                        {loadingModules ? (
                            <div className="py-12 text-center text-app-muted-foreground italic font-medium">Scanning organizational entitlements...</div>
                        ) : orgModules.length === 0 ? (
                            <div className="py-12 text-center text-app-muted-foreground">No available features found for this instance.</div>
                        ) : orgModules.map((m) => (
                            <div key={m.code} className="p-5 bg-app-surface border border-app-border rounded-2xl group hover:border-app-primary/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-app-foreground group-hover:text-app-success transition-colors">{m.name}</h4>
                                        <p className="text-[10px] text-app-muted-foreground uppercase tracking-widest font-mono">{m.code}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className={m.status === 'INSTALLED'
                                            ? "bg-app-success-bg text-app-success border-app-success"
                                            : "bg-app-surface-2 text-app-muted-foreground border-app-border"
                                        }>
                                            {m.status === 'INSTALLED' ? 'Active' : 'Inactive'}
                                        </Badge>
                                        {!m.is_core ? (
                                            <Button
                                                size="sm"
                                                className={m.status === 'INSTALLED'
                                                    ? "bg-app-error-bg text-app-error hover:bg-app-error-bg border border-app-error rounded-xl px-4"
                                                    : "bg-app-primary-dark text-white hover:bg-app-primary rounded-xl px-4"
                                                }
                                                onClick={() => handleModuleToggle(m.code, m.status ?? '')}
                                            >
                                                {m.status === 'INSTALLED' ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        ) : (
                                            <div className="text-[10px] text-app-accent font-bold uppercase tracking-tighter bg-app-accent-bg px-3 py-1.5 rounded-lg border border-app-accent">
                                                Core
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Feature Flags UI */}
                                {m.status === 'INSTALLED' && m.available_features && m.available_features.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-app-border pl-2">
                                        <p className="text-[10px] text-app-muted-foreground font-bold uppercase mb-3">Extended Capabilities</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {m.available_features.map((f) => (
                                                <label key={f.code} className="flex items-center gap-2 text-sm text-app-muted-foreground hover:text-app-foreground cursor-pointer select-none p-2 rounded-lg hover:bg-app-surface transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-app-border text-app-success focus:ring-app-primary/20"
                                                        checked={m.active_features?.includes(f.code) || false}
                                                        onChange={async (e) => {
                                                            const newFeatures = e.target.checked
                                                                ? [...(m.active_features || []), f.code]
                                                                : (m.active_features || []).filter((c: string) => c !== f.code)

                                                            try {
                                                                await updateOrgModuleFeatures(String(selectedOrg!.id), m.code, newFeatures)
                                                                toast.success("Feature updated")
                                                                const data = await getOrgModules(String(selectedOrg!.id))
                                                                setOrgModules(data)
                                                            } catch {
                                                                toast.error("Failed to update feature")
                                                            }
                                                        }}
                                                    />
                                                    <span className={m.active_features?.includes(f.code) ? "text-app-success font-medium" : ""}>
                                                        {f.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-app-surface border-t border-app-border flex justify-end">
                        <Button variant="ghost" className="text-app-muted-foreground hover:text-app-foreground rounded-xl px-8 font-bold" onClick={() => setModulesOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={pendingDeleteOrg !== null}
                onOpenChange={(open) => { if (!open) setPendingDeleteOrg(null) }}
                onConfirm={() => {
                    if (pendingDeleteOrg) handleDelete(pendingDeleteOrg)
                    setPendingDeleteOrg(null)
                }}
                title="Delete Organization"
                description={`Are you sure you want to delete "${pendingDeleteOrg?.name || ''}"? This organization must be suspended first, inactive for 24+ hours, and have no business data. This action cannot be undone.`}
                confirmText="Delete Organization"
                variant="danger"
            />
        </div >
    )
}
