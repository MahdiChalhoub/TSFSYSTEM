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
 if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !(o.slug ?? '').toLowerCase().includes(search.toLowerCase())) return false
 if (filterPlan !== 'all' && (o.current_plan_name || 'Free Tier') !== filterPlan) return false
 if (filterType !== 'all' && (o.business_type_name || '') !== filterType) return false
 if (filterCountry !== 'all' && !(String(o.country ?? '')).toLowerCase().includes(filterCountry.toLowerCase())) return false
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
 async function handleDelete(org: Record<string, any>) {
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
 function tryParseError(e: unknown): string {
 try {
 const errMsg = e instanceof Error ? e.message : String(e)
 if (errMsg) {
 const parsed = JSON.parse(errMsg)
 return parsed?.error || errMsg
 }
 } catch { }
 return e instanceof Error ? e.message : String(e ?? 'Unknown error')
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
 async function handleOpenModules(org: Record<string, any>) {
 setSelectedOrg(org as unknown as SaasOrganization)
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
 const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
 try {
 const result = await toggleOrgModule(String(selectedOrg!.id), moduleCode, action)
 if (result?.error) {
 toast.error(result.error)
 } else {
 toast.success(`Module ${action}d`)
 }
 const data = await getOrgModules(String(selectedOrg!.id))
 setOrgModules(data)
 } catch (e: unknown) {
 toast.error((e instanceof Error ? e.message : String(e)) || "Failed to toggle module")
 }
 }
 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Header Section: Platform Control Panel */}
 <header className="app-page flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-app-success flex items-center justify-center shadow-2xl shadow-app-primary/20 group hover:rotate-12 transition-transform duration-500">
 <Building size={40} className="text-app-foreground fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-app-primary-light text-app-primary border-app-success/30 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 Organization Directory
 </Badge>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
 <Activity size={14} className="text-app-primary" /> Infrastructure Sync: Real-time
 </span>
 </div>
 <h1 className="page-header-title">
 Tenant <span className="text-app-success">Registry</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Create and manage business accounts on the platform.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <button className="h-14 px-8 rounded-2xl bg-app-surface text-app-foreground font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-app-background transition-all shadow-xl shadow-app-border/20 active:scale-95 border-b-4 border-b-slate-950">
 Register Instance <Plus size={18} className="text-app-primary" />
 </button>
 </DialogTrigger>
 <DialogContent className="bg-app-foreground/80 backdrop-blur-2xl border-app-text/20 text-app-foreground rounded-[3rem] max-w-lg shadow-[0_30px_100px_var(--app-border)] p-0 overflow-hidden">
 <div className="p-10 bg-app-success text-app-foreground relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-app-foreground/10 rounded-full -mr-32 -mt-32 blur-3xl" />
 <DialogTitle className="text-3xl font-black tracking-tighter mb-2">Provision Instance</DialogTitle>
 <p className="text-app-success text-xs font-black uppercase tracking-widest opacity-80">Create Organization</p>
 </div>
 <div className="p-10 space-y-8">
 {/* Required Fields */}
 <div className="space-y-3">
 <Label className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Business Legal Name *</Label>
 <Input
 placeholder="e.g. Acme Global Industries"
 className="bg-app-background border-app-border rounded-2xl h-14 px-6 focus:ring-app-primary focus:bg-app-surface transition-all text-[15px] font-black placeholder:text-app-muted-foreground placeholder:font-bold"
 value={newOrg.name}
 onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
 />
 </div>
 <div className="space-y-3">
 <Label className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Unique URL Slug *</Label>
 <div className="flex items-center gap-3">
 <Input
 placeholder="acme-corp"
 className="bg-app-background border-app-border rounded-2xl h-14 px-6 focus:ring-app-primary focus:bg-app-surface transition-all font-black text-app-primary tracking-tight text-[15px] placeholder:text-app-muted-foreground"
 value={newOrg.slug}
 onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
 />
 <div className="h-14 px-4 rounded-2xl bg-app-surface-2 flex items-center justify-center font-black text-app-muted-foreground text-xs border border-app-border">
 {branding.suffix}
 </div>
 </div>
 </div>
 {/* Optional Fields */}
 <div className="pt-6 border-t border-app-border">
 <p className="text-[10px] text-app-muted-foreground font-black uppercase tracking-[0.2em] mb-6">Structural Parameters (Optional)</p>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2"><Mail size={12} className="text-app-primary" /> Admin Email</Label>
 <Input
 placeholder="billing@acme.com"
 type="email"
 className="bg-app-background border-app-border rounded-xl h-12 px-4 text-sm font-bold placeholder:font-medium placeholder:text-app-muted-foreground"
 value={newOrg.business_email}
 onChange={(e) => setNewOrg({ ...newOrg, business_email: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2"><Phone size={12} className="text-app-primary" /> Dial Vector</Label>
 <Input
 placeholder="+1 555-0123"
 className="bg-app-background border-app-border rounded-xl h-12 px-4 text-sm font-bold"
 value={newOrg.phone}
 onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 mt-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2"><Building size={12} className="text-app-primary" /> Industry Vector</Label>
 <select
 className="w-full bg-app-background border border-app-border rounded-xl h-12 px-4 text-sm font-bold text-app-muted-foreground focus:outline-none focus:ring-2 focus:ring-app-primary/30"
 value={newOrg.business_type}
 onChange={(e) => setNewOrg({ ...newOrg, business_type: e.target.value })}
 >
 <option value="">Select industry...</option>
 {businessTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
 </select>
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2"><Globe size={12} className="text-app-primary" /> Base Currency</Label>
 <select
 className="w-full bg-app-background border border-app-border rounded-xl h-12 px-4 text-sm font-bold text-app-muted-foreground focus:outline-none focus:ring-2 focus:ring-app-primary/30"
 value={newOrg.base_currency}
 onChange={(e) => setNewOrg({ ...newOrg, base_currency: e.target.value })}
 >
 <option value="">Select currency...</option>
 {currencies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}
 </select>
 </div>
 </div>
 </div>
 <div className="p-6 bg-app-background rounded-[1.8rem] border border-app-border relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-4 opacity-5 text-app-primary group-hover:rotate-12 transition-transform">
 <Zap size={60} />
 </div>
 <div className="flex gap-4 relative z-10">
 <div className="w-10 h-10 rounded-xl bg-app-primary-light flex items-center justify-center text-app-primary shrink-0">
 <Zap size={20} className="fill-emerald-600" />
 </div>
 <p className="text-[11px] leading-relaxed text-app-muted-foreground font-bold uppercase tracking-tight">
 Provisioning initializes: Sites, Warehouses, Fiscal Setup, Chart of Accounts, Posting Rules, and Financial Settings.
 </p>
 </div>
 </div>
 </div>
 <div className="p-10 pt-0">
 <Button
 className="w-full h-16 bg-app-surface hover:bg-app-background text-app-foreground rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-app-border/20 active:scale-95 transition-all text-xs border-b-4 border-b-black"
 onClick={handleCreate}
 disabled={isCreating}
 >
 {isCreating ? (
 <span className="flex items-center gap-3">
 <Activity size={18} className="animate-spin" /> Deploying...
 </span>
 ) : "Deploy Tenant"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 </div>
 {/* ─── Filters ────────────────────────── */}
 <div className="flex flex-wrap items-center gap-4 p-6 bg-app-foreground/70 backdrop-blur-xl rounded-[2rem] border border-app-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
 <div className="relative flex-1 min-w-[280px]">
 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input type="text" placeholder="Search by name or domain..." value={search} onChange={e => setSearch(e.target.value)}
 className="w-full pl-11 pr-4 h-12 text-[13px] font-black border border-app-border rounded-xl bg-app-surface-2/50 focus:outline-none focus:ring-2 focus:ring-app-primary/10 focus:bg-app-surface transition-all placeholder:text-app-muted-foreground placeholder:font-bold" />
 </div>
 <div className="flex flex-wrap items-center gap-3">
 <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
 className="h-12 px-5 text-[11px] font-black uppercase tracking-widest border border-app-border rounded-xl bg-app-surface-2/50 text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 focus:bg-app-surface cursor-pointer transition-all">
 <option value="all">Status: All</option>
 <option value="active">Active Nodes</option>
 <option value="suspended">Suspended Nodes</option>
 </select>
 <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
 className="h-12 px-5 text-[11px] font-black uppercase tracking-widest border border-app-border rounded-xl bg-app-surface-2/50 text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 focus:bg-app-surface cursor-pointer transition-all">
 <option value="all">Plan: All Tiers</option>
 {uniquePlans.map(p => <option key={p} value={p}>{p}</option>)}
 </select>
 {businessTypes.length > 0 && (
 <select value={filterType} onChange={e => setFilterType(e.target.value)}
 className="h-12 px-5 text-[11px] font-black uppercase tracking-widest border border-app-border rounded-xl bg-app-surface-2/50 text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 focus:bg-app-surface cursor-pointer transition-all">
 <option value="all">Sector: All</option>
 {businessTypes.map(bt => <option key={bt.id} value={bt.name}>{bt.name}</option>)}
 </select>
 )}
 {hasFilters && (
 <button onClick={() => { setSearch(''); setFilterPlan('all'); setFilterType('all'); setFilterCountry('all'); setFilterStatus('all') }}
 className="h-12 px-5 text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 rounded-xl border border-rose-50 bg-rose-50/30 hover:bg-app-error hover:text-app-foreground transition-all">
 <X size={14} /> Clear Filters
 </button>
 )}
 </div>
 <div className="ml-auto flex items-center gap-3 bg-app-background px-4 h-10 rounded-lg border border-app-border">
 <Activity size={12} className="text-app-primary animate-pulse" />
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mt-0.5">{filteredOrgs.length} / {orgs.length} Entity Nodes</span>
 </div>
 </div>
 </header>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {loading ? (
 <div className="col-span-full py-20 text-center space-y-4">
 <Activity size={40} className="mx-auto text-app-primary animate-spin opacity-20" />
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">Synchronizing Entity Metadata...</p>
 </div>
 ) : filteredOrgs.length === 0 ? (
 <div className="col-span-full py-20 text-center space-y-4 bg-app-surface-2/50 rounded-[3rem] border border-dashed border-app-border">
 <Search size={40} className="mx-auto text-app-foreground" />
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">
 {hasFilters ? 'No entity nodes match current filter vector.' : 'No organizational entities discovered in registry.'}
 </p>
 </div>
 ) : filteredOrgs.map((org) => {
 const isSaasOrg = org.slug === 'saas'
 return (
 <Card key={org.id}
 className={`card-premium overflow-hidden group/card hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 cursor-pointer relative ${isSaasOrg ? 'border-app-warning bg-app-warning-bg/5' : ''}`}
 onClick={() => router.push(`/organizations/${org.id}`)}
 >
 {isSaasOrg && (
 <div className="absolute top-0 right-0 p-6">
 <div className="w-10 h-10 rounded-full bg-app-warning-bg text-app-warning flex items-center justify-center shadow-lg shadow-amber-200 animate-pulse">
 <ShieldCheck size={20} />
 </div>
 </div>
 )}
 <CardHeader className="pb-6 p-8">
 <div className="flex justify-between items-start mb-6">
 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner group-hover/card:rotate-6 transition-transform duration-500 ${isSaasOrg ? 'bg-app-warning-bg text-app-warning shadow-amber-200' : 'bg-app-success text-app-foreground shadow-app-primary/20'}`}>
 {isSaasOrg ? <ShieldCheck size={32} /> : <Building size={32} />}
 </div>
 <div className="flex flex-col items-end gap-2">
 <Badge variant="outline" className={`px-3 py-1 font-black text-[9px] uppercase tracking-widest rounded-full border-0 ${org.is_active ? 'bg-app-primary-light text-app-primary' : 'bg-rose-50 text-rose-600'}`}>
 {org.is_active ? 'NOMINAL' : 'SUSPENDED'}
 </Badge>
 <Badge variant="outline" className="px-3 py-1 bg-app-background text-app-muted-foreground border-0 font-black text-[9px] uppercase tracking-widest rounded-full">
 {org.current_plan_name || 'FREE TIER'}
 </Badge>
 </div>
 </div>
 <CardTitle className="text-2xl font-black text-app-foreground tracking-tight group-hover/card:text-app-success transition-colors uppercase">{org.name}</CardTitle>
 <CardDescription className="text-app-primary font-black text-[10px] tracking-widest uppercase mt-1 flex items-center gap-2">
 <Globe size={12} className="opacity-40" /> {org.slug}{branding.suffix}
 </CardDescription>
 </CardHeader>
 <CardContent className="px-8 pb-8 space-y-8">
 <div className="grid grid-cols-3 gap-3">
 <div className="p-4 bg-app-background rounded-2xl border border-app-border text-center group-hover/card:bg-app-surface transition-colors">
 <div className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest mb-1">Nodes</div>
 <div className="text-2xl font-black text-app-foreground tracking-tighter">{org.site_count ?? 0}</div>
 </div>
 <div className="p-4 bg-app-background rounded-2xl border border-app-border text-center group-hover/card:bg-app-surface transition-colors">
 <div className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest mb-1">Agents</div>
 <div className="text-2xl font-black text-app-foreground tracking-tighter">{org.user_count ?? 0}</div>
 </div>
 <div className="p-4 bg-app-background rounded-2xl border border-app-border text-center group-hover/card:bg-app-surface transition-colors">
 <div className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest mb-1">Apps</div>
 <div className="text-2xl font-black text-app-foreground tracking-tighter">{org.module_count ?? 0}</div>
 </div>
 </div>

 <div className="space-y-3 px-1">
 {org.business_email && (
 <div className="text-[11px] font-bold text-app-muted-foreground flex items-center gap-3 uppercase tracking-tight">
 <Mail size={14} className="text-app-primary" /> {org.business_email}
 </div>
 )}
 {org.client_name && (
 <div className="text-[11px] font-bold text-app-muted-foreground flex items-center gap-3 uppercase tracking-tight">
 <Users size={14} className="text-app-primary" /> <span className="font-black text-app-muted-foreground">{org.client_name}</span>
 </div>
 )}
 </div>

 <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
 {/* Suspend / Activate */}
 <Button
 variant="outline"
 className={`flex-1 h-14 rounded-2xl border-app-border font-black text-[11px] uppercase tracking-widest shadow-sm transition-all ${isSaasOrg
 ? 'bg-app-background text-app-foreground cursor-not-allowed border-dashed'
 : org.is_active
 ? 'bg-app-background hover:bg-app-error hover:text-app-foreground hover:border-rose-500'
 : 'bg-app-primary-light hover:bg-app-primary hover:text-app-foreground hover:border-app-primary'
 }`}
 onClick={() => handleToggle(String(org.id), !!org.is_active, org.slug ?? '')}
 disabled={isSaasOrg}
 >
 <Power size={16} className="mr-2" />
 {org.is_active ? 'SUSPEND' : 'ACTIVATE'}
 </Button>
 {/* Features / Modules */}
 <Button
 variant="outline"
 className="w-14 h-14 rounded-2xl border-app-success/30 bg-app-primary-light text-app-primary hover:bg-app-primary hover:text-app-foreground transition-all shadow-sm"
 onClick={() => handleOpenModules(org)}
 >
 <Settings2 size={20} />
 </Button>
 {/* Delete */}
 {!isSaasOrg && (
 <Button
 variant="ghost"
 className="w-14 h-14 rounded-2xl transition-all text-app-muted-foreground hover:text-rose-600 hover:bg-rose-50"
 onClick={() => setPendingDeleteOrg(org)}
 >
 <Trash2 size={20} />
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 )
 })}
 </div>
 {/* Feature Activation Dialog */}
 <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
 <DialogContent className="bg-app-foreground/80 backdrop-blur-2xl border-app-text/20 text-app-foreground rounded-[3rem] max-w-2xl overflow-hidden p-0 shadow-[0_30px_100px_var(--app-border)]">
 <div className="p-10 bg-app-success text-app-foreground relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-app-foreground/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
 <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 relative z-10">
 <Layers size={32} className="text-app-success" /> Features
 </DialogTitle>
 <p className="text-app-success text-[11px] font-black uppercase tracking-[0.2em] opacity-80 mt-2 relative z-10">
 Managing Entitlements for: <span className="underline underline-offset-4">{selectedOrg?.name}</span>
 </p>
 </div>
 <div className="p-10 max-h-[50vh] overflow-y-auto space-y-4">
 {loadingModules ? (
 <div className="py-20 text-center space-y-4">
 <Activity size={40} className="mx-auto text-app-primary animate-spin opacity-20" />
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">Scanning Organizational Entitlements...</p>
 </div>
 ) : orgModules.length === 0 ? (
 <div className="py-20 text-center bg-app-surface-2/50 rounded-3xl border border-dashed border-app-border">
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">No structural features discovered.</p>
 </div>
 ) : orgModules.map((m) => (
 <div key={m.code} className="p-6 bg-app-surface border border-app-border rounded-[2rem] group/mod hover:shadow-xl hover:shadow-app-border/20 transition-all">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-5">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${m.status === 'INSTALLED' ? 'bg-app-primary-light text-app-primary shadow-inner' : 'bg-app-background text-app-muted-foreground'}`}>
 <Zap size={20} className={m.status === 'INSTALLED' ? 'fill-emerald-600' : ''} />
 </div>
 <div>
 <h4 className="text-[15px] font-black text-app-foreground uppercase tracking-tight group-hover/mod:text-app-success transition-colors">{m.name}</h4>
 <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mt-0.5">{m.code}</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 {m.is_core ? (
 <div className="px-4 py-1.5 rounded-full bg-app-surface text-app-foreground text-[9px] font-black uppercase tracking-widest border-b-2 border-b-black">
 Core Infrastructure
 </div>
 ) : (
 <Button
 className={`h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${m.status === 'INSTALLED'
 ? "bg-rose-50 text-rose-500 hover:bg-app-error hover:text-app-foreground border-0"
 : "bg-app-primary text-app-foreground hover:bg-app-background border-0 shadow-lg shadow-app-primary/20"
 }`}
 onClick={() => handleModuleToggle(m.code, m.status ?? '')}
 >
 {m.status === 'INSTALLED' ? 'Deactivate' : 'Initialize'}
 </Button>
 )}
 </div>
 </div>
 {/* Feature Flags UI */}
 {m.status === 'INSTALLED' && Array.isArray(m.available_features) && m.available_features.length > 0 && (
 <div className="mt-6 pt-5 border-t border-app-border pl-2">
 <p className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest mb-4 flex items-center gap-2">
 <Settings2 size={12} className="text-app-primary" /> Extended Features
 </p>
 <div className="grid grid-cols-2 gap-3">
 {(m.available_features as Array<Record<string, any>>).map((f: Record<string, any>) => (
 <label key={f.code} className="flex items-center gap-3 p-3 rounded-xl border border-app-border hover:bg-app-primary-light hover:border-app-success/30 cursor-pointer transition-all group/flag">
 <div className="relative flex items-center justify-center">
 <input
 type="checkbox"
 className="peer sr-only"
 checked={m.active_features?.includes(f.code) || false}
 onChange={async (e) => {
 const newFeatures = e.target.checked
 ? [...(m.active_features || []), f.code]
 : (m.active_features || []).filter((c: string) => c !== f.code)
 try {
 await updateOrgModuleFeatures(String(selectedOrg!.id), m.code, newFeatures)
 toast.success("Structural feature updated")
 const data = await getOrgModules(String(selectedOrg!.id))
 setOrgModules(data)
 } catch {
 toast.error("Connection failed")
 }
 }}
 />
 <div className="w-5 h-5 border-2 border-app-border rounded-lg group-hover/flag:border-app-success peer-checked:bg-app-primary peer-checked:border-app-primary transition-all flex items-center justify-center">
 <Plus size={12} className="text-app-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
 </div>
 </div>
 <span className={`text-[11px] font-bold uppercase tracking-tight text-app-muted-foreground group-hover/flag:text-app-success transition-colors ${m.active_features?.includes(f.code) ? "text-app-primary" : ""}`}>
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
 <div className="p-8 bg-app-background border-t border-app-border flex justify-end">
 <button className="h-12 px-8 rounded-2xl bg-app-surface border border-app-border font-black text-[11px] uppercase tracking-widest text-app-muted-foreground hover:bg-app-surface hover:text-app-foreground hover:border-app-border transition-all active:scale-95" onClick={() => setModulesOpen(false)}>
 Close
 </button>
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
 </div>
 )
}
