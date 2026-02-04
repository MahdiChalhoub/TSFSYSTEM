'use client'

import { useEffect, useState } from "react"
import { getPlans, getPlanCategories } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Tag, Layers } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function SubscriptionPlansPage() {
    const [plans, setPlans] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [plansData, categoriesData] = await Promise.all([
                getPlans(),
                getPlanCategories()
            ])
            setPlans(Array.isArray(plansData) ? plansData : [])
            setCategories(Array.isArray(categoriesData) ? categoriesData : [])
        } catch {
            toast.error("Failed to load subscription data")
        } finally {
            setLoading(false)
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
                    <Button variant="outline" className="gap-2">
                        <Tag size={16} />
                        Categories
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2 text-white">
                        <Plus size={18} />
                        New Plan
                    </Button>
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
