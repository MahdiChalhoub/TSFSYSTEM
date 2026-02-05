'use client'

import { useEffect, useState } from "react"
import { getPlans, getPlanCategories, createPlan, createPlanCategory } from "./actions"
import { getSaaSModules } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Tag, Layers, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export default function SubscriptionPlansPage() {
    const [plans, setPlans] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [availableModules, setAvailableModules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

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

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [plansData, categoriesData, modulesData] = await Promise.all([
                getPlans(),
                getPlanCategories(),
                getSaaSModules()
            ])
            setPlans(Array.isArray(plansData) ? plansData : [])
            setCategories(Array.isArray(categoriesData) ? categoriesData : [])
            setAvailableModules(Array.isArray(modulesData) ? modulesData : [])
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
        } catch (e: any) {
            toast.error(e.message || "Failed to create plan")
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
        } catch (e: any) {
            toast.error(e.message || "Failed to create category")
        } finally {
            setCatSaving(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Subscription Plans</h2>
                    <p className="text-gray-500 mt-2 font-medium">Manage pricing tiers and feature entitlements</p>
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
                                    <Label className="text-sm font-bold text-gray-700 mb-3 block">Usage Limits</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-500">Max Users</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_users}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_users: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-500">Max Products</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_products}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_products: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-500">Max Sites</Label>
                                            <Input
                                                type="number"
                                                value={planForm.limits.max_sites}
                                                onChange={e => setPlanForm(f => ({ ...f, limits: { ...f.limits, max_sites: e.target.value } }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-500">Storage (GB)</Label>
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
                                    <Label className="text-sm font-bold text-gray-700 mb-3 block">Enabled Modules</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableModules.map((m: any) => (
                                            <div key={m.code} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={m.code}
                                                    checked={planForm.modules.includes(m.code)}
                                                    onCheckedChange={() => toggleModule(m.code)}
                                                />
                                                <label htmlFor={m.code} className="text-sm text-gray-700 cursor-pointer">{m.name}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Features Section */}
                                <div className="border-t pt-4">
                                    <Label className="text-sm font-bold text-gray-700 mb-2 block">Feature Descriptions</Label>
                                    <p className="text-xs text-gray-400 mb-2">One feature per line. Displayed on pricing pages.</p>
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
                <div className="py-20 text-center text-gray-500">Loading plans...</div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {/* Categories Section */}
                    {categories.map(cat => (
                        <div key={cat.id} className="space-y-4">
                            <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-gray-800">{cat.name}</h3>
                                <Badge variant="secondary" className="text-xs font-mono">{cat.type}</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {plans.filter(p => p.category?.id === cat.id).map(plan => (
                                    <Card key={plan.id} className="bg-white hover:border-emerald-500/30 transition-all shadow-sm hover:shadow-md group">
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                                                <Badge className={plan.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}>
                                                    {plan.is_active ? 'Active' : 'Draft'}
                                                </Badge>
                                            </div>
                                            <CardDescription className="line-clamp-2 min-h-[40px]">
                                                {plan.description || "No description provided."}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-sm text-gray-500 uppercase font-bold text-[10px] tracking-wider">Monthly</p>
                                                    <p className="text-2xl font-black text-emerald-600">
                                                        ${parseFloat(plan.monthly_price).toFixed(2)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500 uppercase font-bold text-[10px] tracking-wider">Annual</p>
                                                    <p className="text-xl font-bold text-gray-700">
                                                        ${parseFloat(plan.annual_price).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {plans.filter(p => p.category?.id === cat.id).length === 0 && (
                                    <div className="col-span-full py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                                        No plans in this category yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {categories.length === 0 && (
                        <div className="py-20 text-center text-gray-500">
                            No categories found. Start by creating a plan category.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
