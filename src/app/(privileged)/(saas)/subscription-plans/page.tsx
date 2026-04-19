'use client'

import { useEffect, useState } from "react"
import { SaasPlan, PlanCategory, SaasModule, SaasAddon } from "@/types/erp"
import { useRouter } from "next/navigation"
import { getPlans, getPlanCategories, createPlan, createPlanCategory } from "./actions"
import { getAddons, createAddon, deleteAddon } from "./[id]/actions"
import { getSaaSModules } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Tag, Layers, Loader2, Check, Globe, Lock, Trash2, Users, Building2, HardDrive, Package, FileText, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const ADDON_TYPE_ICONS: Record<string, any> = { users: Users, sites: Building2, storage: HardDrive, products: Package, invoices: FileText, customers: UserCheck }
const ADDON_TYPE_LABELS: Record<string, string> = { users: 'Extra Users', sites: 'Extra Sites', storage: 'Extra Storage (GB)', products: 'Extra Products', invoices: 'Extra Invoices/Month', customers: 'Extra Customers' }

export default function SubscriptionPlansPage() {
    const router = useRouter()
    const [plans, setPlans] = useState<SaasPlan[]>([])
    const [categories, setCategories] = useState<PlanCategory[]>([])
    const [availableModules, setAvailableModules] = useState<SaasModule[]>([])
    const [addons, setAddons] = useState<SaasAddon[]>([])
    const [loading, setLoading] = useState(true)

    // Add-on modal
    const [addonOpen, setAddonOpen] = useState(false)
    const [addonForm, setAddonForm] = useState({ name: '', addon_type: 'users', quantity: '10', monthly_price: '5', annual_price: '50', plan_ids: [] as string[] })
    const [addonSaving, setAddonSaving] = useState(false)

    // New Plan Modal
    const [planOpen, setPlanOpen] = useState(false)
    const [planForm, setPlanForm] = useState({
        name: '', slug: '', monthly_price: '0', annual_price: '0', category: '',
        limits: { max_users: '5', max_products: '1000', max_sites: '1', storage_gb: '5' },
        modules: ['inventory'] as string[],
        features: ''
    })
    const [planSaving, setPlanSaving] = useState(false)

    // New Category Modal
    const [catOpen, setCatOpen] = useState(false)
    const [catForm, setCatForm] = useState({ name: '', slug: '', type: 'PUBLIC' })
    const [catSaving, setCatSaving] = useState(false)
    const [pendingDeleteAddon, setPendingDeleteAddon] = useState<Record<string, unknown> | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [plansData, categoriesData, modulesData, addonsData] = await Promise.all([
                getPlans(),
                getPlanCategories(),
                getSaaSModules(),
                getAddons(),
            ])
            setPlans(Array.isArray(plansData) ? plansData : [])
            setCategories(Array.isArray(categoriesData) ? categoriesData : [])
            setAvailableModules(Array.isArray(modulesData) ? modulesData : [])
            setAddons(Array.isArray(addonsData) ? addonsData : [])
        } catch {
            toast.error("Failed to load subscription data")
        } finally {
            setLoading(false)
        }
    }

    async function handleCreatePlan() {
        if (!planForm.name || !planForm.slug || !planForm.category) {
            return toast.error("Please fill all required fields")
        }
        setPlanSaving(true)
        try {
            const featuresList = planForm.features.split('\n').filter(f => f.trim())
            await createPlan({
                name: planForm.name,
                slug: planForm.slug,
                monthly_price: parseFloat(planForm.monthly_price) || 0,
                annual_price: parseFloat(planForm.annual_price) || 0,
                category: parseInt(planForm.category),
                is_active: true,
                limits: {
                    max_users: parseInt(planForm.limits.max_users) || 5,
                    max_products: parseInt(planForm.limits.max_products) || 1000,
                    max_sites: parseInt(planForm.limits.max_sites) || 1,
                    storage_gb: parseInt(planForm.limits.storage_gb) || 5
                },
                modules: planForm.modules,
                features: featuresList
            })
            toast.success("Plan created")
            setPlanOpen(false)
            setPlanForm({
                name: '', slug: '', monthly_price: '0', annual_price: '0', category: '',
                limits: { max_users: '5', max_products: '1000', max_sites: '1', storage_gb: '5' },
                modules: ['inventory'],
                features: ''
            })
            loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)) || "Failed to create plan")
        } finally {
            setPlanSaving(false)
        }
    }

    function toggleModule(code: string) {
        setPlanForm(f => ({
            ...f,
            modules: f.modules.includes(code)
                ? f.modules.filter(m => m !== code)
                : [...f.modules, code]
        }))
    }

    async function handleCreateCategory() {
        if (!catForm.name || !catForm.slug) {
            return toast.error("Please fill all required fields")
        }
        setCatSaving(true)
        try {
            await createPlanCategory(catForm)
            toast.success("Category created")
            setCatOpen(false)
            setCatForm({ name: '', slug: '', type: 'PUBLIC' })
            loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)) || "Failed to create category")
        } finally {
            setCatSaving(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-app-foreground tracking-tight">Subscription Plans</h2>
                    <p className="text-app-muted-foreground mt-2 font-medium">Manage pricing tiers and feature entitlements</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={catOpen} onOpenChange={setCatOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Tag size={16} />
                                New Category
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Plan Category</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={catForm.name}
                                        onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Standard Plans"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Slug</Label>
                                    <Input
                                        value={catForm.slug}
                                        onChange={e => setCatForm(f => ({ ...f, slug: e.target.value }))}
                                        placeholder="e.g. standard"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={catForm.type} onValueChange={v => setCatForm(f => ({ ...f, type: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PUBLIC">Public</SelectItem>
                                            <SelectItem value="ORGANIZATION">Organization-Specific</SelectItem>
                                            <SelectItem value="INTERNAL">Internal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateCategory} disabled={catSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {catSaving ? <Loader2 className="animate-spin" size={16} /> : "Create Category"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={planOpen} onOpenChange={setPlanOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2 text-white">
                                <Plus size={18} />
                                New Plan
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Subscription Plan</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Plan Name</Label>
                                    <Input
                                        value={planForm.name}
                                        onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Pro Plan"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Slug</Label>
                                    <Input
                                        value={planForm.slug}
                                        onChange={e => setPlanForm(f => ({ ...f, slug: e.target.value }))}
                                        placeholder="e.g. pro"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Monthly Price ($)</Label>
                                        <Input
                                            type="number"
                                            value={planForm.monthly_price}
                                            onChange={e => setPlanForm(f => ({ ...f, monthly_price: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Annual Price ($)</Label>
                                        <Input
                                            type="number"
                                            value={planForm.annual_price}
                                            onChange={e => setPlanForm(f => ({ ...f, annual_price: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={planForm.category} onValueChange={v => setPlanForm(f => ({ ...f, category: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                        <SelectContent>
                                            {categories.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Limits Section */}
                                <div className="border-t pt-4 mt-4">
                                    <Label className="text-sm font-bold text-app-foreground mb-3 block">Usage Limits</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-app-muted-foreground">Max Users</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_users}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_users: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-app-muted-foreground">Max Products</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_products}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_products: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-app-muted-foreground">Max Sites</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_sites}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_sites: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-app-muted-foreground">Storage (GB)</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.storage_gb}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, storage_gb: e.target.value } }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Modules Section */}
                                <div className="border-t pt-4">
                                    <Label className="text-sm font-bold text-app-foreground mb-3 block">Enabled Modules</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableModules.map((m: Record<string, any>) => (
                                            <div key={m.code} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={m.code}
                                                    checked={planForm.modules.includes(m.code)}
                                                    onCheckedChange={() => toggleModule(m.code)}
                                                />
                                                <label htmlFor={m.code} className="text-sm text-app-foreground cursor-pointer">{m.name}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Features Section */}
                                <div className="border-t pt-4">
                                    <Label className="text-sm font-bold text-app-foreground mb-2 block">Feature Descriptions</Label>
                                    <p className="text-xs text-app-muted-foreground mb-2">One feature per line. Displayed on pricing pages.</p>
                                    <Textarea
                                        value={planForm.features}
                                        onChange={e => setPlanForm(f => ({ ...f, features: e.target.value }))}
                                        placeholder={"Up to 10 team members\n5,000 product SKUs\nPriority support"}
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreatePlan} disabled={planSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {planSaving ? <Loader2 className="animate-spin" size={16} /> : "Create Plan"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-app-muted-foreground">Loading plans...</div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {/* Categories Section */}
                    {categories.map(cat => (
                        <div key={cat.id} className="space-y-4">
                            <div className="flex items-center gap-3 pb-2 border-b border-app-border">
                                <h3 className="text-xl font-bold text-app-foreground">{cat.name}</h3>
                                <Badge variant="secondary" className="text-xs font-mono">{cat.type}</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {plans.filter(p => p.category?.id === cat.id).map(plan => {
                                    const isCustom = parseFloat(plan.monthly_price) < 0 || plan.limits?.custom
                                    const limits = plan.limits || {}

                                    return (
                                        <Card key={plan.id} className={`transition-all shadow-sm hover:shadow-lg group overflow-hidden cursor-pointer ${isCustom
                                            ? 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-purple-200 hover:border-purple-400'
                                            : 'bg-app-surface hover:border-emerald-500/30'
                                            }`}
                                            onClick={() => router.push(`/subscription-plans/${plan.id}`)}>
                                            <CardHeader className="pb-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className={`text-lg font-bold ${isCustom ? 'text-purple-900' : ''}`}>{plan.name}</CardTitle>
                                                        {plan.is_public === false && <Lock size={12} className="text-amber-500" />}
                                                    </div>
                                                    <Badge className={plan.is_active ? "bg-emerald-50 text-emerald-600" : "bg-app-surface-2 text-app-muted-foreground"}>
                                                        {plan.is_active ? 'Active' : 'Draft'}
                                                    </Badge>
                                                </div>
                                                <CardDescription className={`line-clamp-2 min-h-[40px] ${isCustom ? 'text-purple-600' : ''}`}>
                                                    {plan.description || "No description provided."}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {isCustom ? (
                                                        <>
                                                            <div className="text-center py-4">
                                                                <p className="text-3xl font-black text-purple-700">Custom</p>
                                                                <p className="text-sm text-purple-500 mt-1">Tailored to your needs</p>
                                                            </div>
                                                            <a href="mailto:sales@tsf-city.com?subject=Custom%20Plan%20Inquiry"
                                                                className="block w-full text-center py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg hover:scale-[1.02]">
                                                                Contact Us →
                                                            </a>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                <Badge className="bg-purple-100 text-purple-700 text-[10px]">Dedicated Support</Badge>
                                                                <Badge className="bg-purple-100 text-purple-700 text-[10px]">SLA</Badge>
                                                                <Badge className="bg-purple-100 text-purple-700 text-[10px]">White-label</Badge>
                                                                <Badge className="bg-purple-100 text-purple-700 text-[10px]">All Modules</Badge>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-end gap-3">
                                                                <div>
                                                                    <p className="text-[10px] text-app-muted-foreground uppercase font-bold tracking-wider">Monthly</p>
                                                                    <p className="text-2xl font-black text-emerald-600">
                                                                        {parseFloat(plan.monthly_price) === 0 ? 'Free' : `$${parseFloat(plan.monthly_price).toFixed(0)}`}
                                                                    </p>
                                                                </div>
                                                                {parseFloat(plan.annual_price) > 0 && (
                                                                    <div className="pb-0.5">
                                                                        <p className="text-[10px] text-app-muted-foreground uppercase font-bold tracking-wider">Annual</p>
                                                                        <p className="text-lg font-bold text-app-muted-foreground">
                                                                            ${parseFloat(plan.annual_price).toFixed(0)}<span className="text-xs font-normal">/yr</span>
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Limits */}
                                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                                {limits.max_users != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Users</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_users}</div>
                                                                    </div>
                                                                )}
                                                                {limits.max_sites != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Sites</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_sites}</div>
                                                                    </div>
                                                                )}
                                                                {limits.max_storage_gb != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Storage</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_storage_gb} GB</div>
                                                                    </div>
                                                                )}
                                                                {limits.max_products != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Products</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_products >= 100000 ? `${(limits.max_products / 1000).toFixed(0)}K` : limits.max_products.toLocaleString()}</div>
                                                                    </div>
                                                                )}
                                                                {limits.max_invoices_per_month != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Invoices</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_invoices_per_month >= 10000 ? `${(limits.max_invoices_per_month / 1000).toFixed(0)}K` : limits.max_invoices_per_month.toLocaleString()}<span className="text-[8px] text-app-muted-foreground">/mo</span></div>
                                                                    </div>
                                                                )}
                                                                {limits.max_customers != null && (
                                                                    <div className="p-2 bg-app-surface rounded-xl">
                                                                        <div className="text-[9px] text-app-muted-foreground font-bold uppercase">Customers</div>
                                                                        <div className="text-sm font-bold text-app-foreground">{limits.max_customers >= 10000 ? `${(limits.max_customers / 1000).toFixed(0)}K` : limits.max_customers.toLocaleString()}</div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Modules */}
                                                            {Array.isArray(plan.modules) && plan.modules.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {plan.modules.map((m: string) => (
                                                                        <Badge key={m} className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold capitalize">{m}</Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                                {plans.filter(p => p.category?.id === cat.id).length === 0 && (
                                    <div className="col-span-full py-8 text-center bg-app-surface rounded-2xl border border-dashed border-app-border text-app-muted-foreground text-sm">
                                        No plans in this category yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {categories.length === 0 && (
                        <div className="py-20 text-center text-app-muted-foreground">
                            No categories found. Start by creating a plan category.
                        </div>
                    )}

                    {/* ─── Add-ons Section ─── */}
                    <div className="space-y-4 mt-8">
                        <div className="flex items-center justify-between pb-2 border-b border-app-border">
                            <div>
                                <h3 className="text-xl font-bold text-app-foreground">Plan Add-ons</h3>
                                <p className="text-xs text-app-muted-foreground mt-1">Per-item upgrades clients can purchase (monthly recurring)</p>
                            </div>
                            <Dialog open={addonOpen} onOpenChange={setAddonOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-indigo-600 hover:bg-indigo-500 gap-2 text-white">
                                        <Plus size={16} /> New Add-on
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create Plan Add-on</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Name</Label>
                                            <Input value={addonForm.name} onChange={e => setAddonForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Extra 10 Users" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <Select value={addonForm.addon_type} onValueChange={v => setAddonForm(f => ({ ...f, addon_type: v }))}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(ADDON_TYPE_LABELS).map(([k, v]) => (
                                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Quantity</Label>
                                                <Input type="number" value={addonForm.quantity} onChange={e => setAddonForm(f => ({ ...f, quantity: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Monthly Price ($)</Label>
                                                <Input type="number" value={addonForm.monthly_price} onChange={e => setAddonForm(f => ({ ...f, monthly_price: e.target.value }))} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Annual Price ($)</Label>
                                                <Input type="number" value={addonForm.annual_price} onChange={e => setAddonForm(f => ({ ...f, annual_price: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="border-t pt-4">
                                            <Label className="text-sm font-bold text-app-foreground mb-3 block">Available for Plans</Label>
                                            <p className="text-xs text-app-muted-foreground mb-2">Leave all unchecked = available to all plans</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {plans.map((p: Record<string, any>) => (
                                                    <div key={p.id} className="flex items-center gap-2">
                                                        <Checkbox id={`addon-plan-${p.id}`}
                                                            checked={addonForm.plan_ids.includes(p.id)}
                                                            onCheckedChange={() => setAddonForm(f => ({
                                                                ...f,
                                                                plan_ids: f.plan_ids.includes(p.id) ? f.plan_ids.filter(x => x !== p.id) : [...f.plan_ids, p.id]
                                                            }))} />
                                                        <label htmlFor={`addon-plan-${p.id}`} className="text-sm text-app-foreground cursor-pointer">{p.name}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={async () => {
                                            if (!addonForm.name.trim()) return toast.error('Name is required')
                                            setAddonSaving(true)
                                            try {
                                                await createAddon({
                                                    name: addonForm.name,
                                                    addon_type: addonForm.addon_type,
                                                    quantity: parseInt(addonForm.quantity) || 1,
                                                    monthly_price: parseFloat(addonForm.monthly_price) || 0,
                                                    annual_price: parseFloat(addonForm.annual_price) || 0,
                                                    plan_ids: addonForm.plan_ids,
                                                })
                                                toast.success('Add-on created')
                                                setAddonOpen(false)
                                                setAddonForm({ name: '', addon_type: 'users', quantity: '10', monthly_price: '5', annual_price: '50', plan_ids: [] })
                                                loadData()
                                            } catch { toast.error('Failed to create add-on') }
                                            finally { setAddonSaving(false) }
                                        }} disabled={addonSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                                            {addonSaving ? <Loader2 className="animate-spin" size={16} /> : 'Create Add-on'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {addons.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {addons.map((addon: Record<string, any>) => {
                                    const Icon = ADDON_TYPE_ICONS[addon.addon_type] || Package
                                    return (
                                        <Card key={addon.id} className="bg-app-surface shadow-sm hover:shadow-md transition-all border-indigo-100 hover:border-indigo-300">
                                            <CardContent className="pt-5 pb-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                            <Icon size={18} className="text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-app-foreground text-sm">{addon.name}</p>
                                                            <p className="text-[10px] text-app-muted-foreground uppercase font-bold">{ADDON_TYPE_LABELS[addon.addon_type] || addon.addon_type}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setPendingDeleteAddon(addon)} className="text-app-faint hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="mt-3 flex items-end gap-2">
                                                    <span className="text-lg font-black text-indigo-600">${parseFloat(addon.monthly_price).toFixed(0)}</span>
                                                    <span className="text-xs text-app-muted-foreground font-bold">/mo</span>
                                                    <span className="text-xs text-app-faint mx-1">|</span>
                                                    <span className="text-sm font-bold text-app-muted-foreground">${parseFloat(addon.annual_price).toFixed(0)}/yr</span>
                                                </div>
                                                <div className="mt-2">
                                                    <Badge className="bg-indigo-50 text-indigo-700 text-[10px]">+{addon.quantity} {addon.addon_type}</Badge>
                                                    {addon.plan_ids?.length > 0 && (
                                                        <span className="text-[10px] text-app-muted-foreground ml-2">
                                                            {addon.plan_ids.length} plan(s)
                                                        </span>
                                                    )}
                                                    {(!addon.plan_ids || addon.plan_ids.length === 0) && (
                                                        <span className="text-[10px] text-app-muted-foreground ml-2">All plans</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-app-surface rounded-2xl border border-dashed border-app-border text-app-muted-foreground text-sm">
                                No add-ons created yet. Add-ons let clients upgrade specific limits.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingDeleteAddon !== null}
                onOpenChange={(open) => { if (!open) setPendingDeleteAddon(null) }}
                onConfirm={async () => {
                    if (pendingDeleteAddon) {
                        await deleteAddon(pendingDeleteAddon.id)
                        toast.success('Add-on deleted')
                        loadData()
                    }
                    setPendingDeleteAddon(null)
                }}
                title="Delete Add-on"
                description={`Are you sure you want to delete the add-on "${pendingDeleteAddon?.name || ''}"? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
