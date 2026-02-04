"use client"

import { useEffect, useState } from "react"
import { getPublicPlans } from "@/app/actions/onboarding"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function PricingSection() {
    const [plans, setPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const data = await getPublicPlans()
                // Filter only Active and Public (if backend returns all)
                // Assuming backend only returns public or we filter here if category is present.
                // For now, list all active plans returned by public endpoint.
                setPlans(data.filter((p: any) => p.is_active))
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
    if (plans.length === 0) return null

    return (
        <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-10">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    Power Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Empire</span>
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                    Choose the architecture that scales with your ambition.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <Card key={plan.id} className="bg-[#0f172a]/40 border-white/5 backdrop-blur-xl rounded-[2rem] overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all hover:-translate-y-2 duration-300 group">
                        <CardHeader className="p-8 pb-0">
                            <CardTitle className="text-2xl font-black text-white">{plan.name}</CardTitle>
                            <CardDescription className="text-slate-400 mt-2 min-h-[40px]">
                                {plan.description || "Enterprise-grade features for scaling businesses."}
                            </CardDescription>
                            <div className="mt-6">
                                <span className="text-4xl font-black text-white">${parseFloat(plan.monthly_price).toFixed(0)}</span>
                                <span className="text-slate-500 font-bold text-sm uppercase tracking-wider ml-2">/ month</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 flex-1 flex flex-col">
                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features && Object.keys(plan.features).length > 0 ? (
                                    Object.entries(plan.features).slice(0, 5).map(([key, val]) => (
                                        <li key={key} className="flex items-start gap-3 text-sm text-slate-300">
                                            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                                            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="flex items-start gap-3 text-sm text-slate-300">
                                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                                        <span>Full Core Access</span>
                                    </li>
                                )}
                            </ul>
                            <Button className="w-full h-14 rounded-xl bg-white/5 hover:bg-emerald-600 hover:text-white text-emerald-400 border border-emerald-500/20 font-bold tracking-wide transition-all group-hover:bg-emerald-600 group-hover:text-white">
                                Select Strategy
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
