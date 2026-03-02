"use client"

import { useEffect, useState } from "react"
import { SaasPlan } from "@/types/erp"
import { getPublicPlans } from "@/app/actions/onboarding"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2, Users, Building2, HardDrive, Package, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function PricingSection() {
 const [plans, setPlans] = useState<SaasPlan[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 async function load() {
 try {
 const data = await getPublicPlans()
 setPlans(data.filter((p: Record<string, any>) => p.is_active))
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
 <h2 className="text-4xl md:text-5xl font-black text-app-text tracking-tight">
 Power Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Empire</span>
 </h2>
 <p className="text-app-text-faint max-w-2xl mx-auto text-lg">
 Choose the plan that scales with your ambition.
 </p>
 </div>

 <div className={`grid grid-cols-1 gap-8 ${plans.length <= 3 ? 'md:grid-cols-3' : plans.length <= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
 {plans.map((plan) => {
 const isCustom = parseFloat(plan.monthly_price) < 0 || plan.limits?.custom
 const isFree = parseFloat(plan.monthly_price) === 0
 const limits = plan.limits || {}

 return (
 <Card key={plan.id} className={`backdrop-blur-xl rounded-[2rem] overflow-hidden flex flex-col transition-all hover:-translate-y-2 duration-300 group ${isCustom
 ? 'bg-gradient-to-br from-purple-900/40 via-indigo-900/40 to-pink-900/40 border-purple-500/20 hover:border-purple-400/40'
 : 'bg-[#0f172a]/40 border-app-text/5 hover:border-emerald-500/30'
 }`}>
 <CardHeader className="p-8 pb-0">
 <div className="flex items-center justify-between">
 <CardTitle className="text-2xl font-black text-app-text">{plan.name}</CardTitle>
 <div className="flex gap-1.5">
 {plan.trial_days > 0 && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">{plan.trial_days}d Free Trial</Badge>}
 {isCustom && <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">Enterprise</Badge>}
 </div>
 </div>
 <CardDescription className="text-app-text-faint mt-2 min-h-[40px]">
 {plan.description || "Enterprise-grade features for scaling businesses."}
 </CardDescription>
 <div className="mt-6">
 {isCustom ? (
 <span className="text-3xl font-black text-purple-300">Contact Us</span>
 ) : isFree ? (
 <span className="text-4xl font-black text-emerald-400">Free</span>
 ) : (
 <>
 <span className="text-4xl font-black text-app-text">${parseFloat(plan.monthly_price).toFixed(0)}</span>
 <span className="text-app-text-muted font-bold text-sm uppercase tracking-wider ml-2">/ month</span>
 </>
 )}
 </div>
 </CardHeader>
 <CardContent className="p-8 flex-1 flex flex-col">
 {/* Limits */}
 <div className="grid grid-cols-2 gap-3 mb-6">
 {limits.max_users != null && (
 <div className="flex items-center gap-2 text-xs text-app-text-faint">
 <Users size={12} className="text-emerald-400" />
 <span>{limits.max_users < 0 ? 'Unlimited' : limits.max_users} Users</span>
 </div>
 )}
 {limits.max_sites != null && (
 <div className="flex items-center gap-2 text-xs text-app-text-faint">
 <Building2 size={12} className="text-emerald-400" />
 <span>{limits.max_sites < 0 ? 'Unlimited' : limits.max_sites} Sites</span>
 </div>
 )}
 {limits.max_storage_gb != null && (
 <div className="flex items-center gap-2 text-xs text-app-text-faint">
 <HardDrive size={12} className="text-emerald-400" />
 <span>{limits.max_storage_gb < 0 ? 'Unlimited' : limits.max_storage_gb}GB Storage</span>
 </div>
 )}
 {limits.max_products != null && (
 <div className="flex items-center gap-2 text-xs text-app-text-faint">
 <Package size={12} className="text-emerald-400" />
 <span>{limits.max_products < 0 ? 'Unlimited' : limits.max_products >= 1000 ? `${(limits.max_products / 1000).toFixed(0)}K` : limits.max_products} Products</span>
 </div>
 )}
 </div>

 {/* Modules */}
 {plan.modules?.length > 0 && (
 <div className="flex flex-wrap gap-1.5 mb-6">
 {plan.modules.slice(0, 5).map((m: string) => (
 <Badge key={m} className="bg-app-text/5 text-app-text-faint text-[9px] border-app-text/10 uppercase tracking-wider">{m}</Badge>
 ))}
 {plan.modules.length > 5 && (
 <Badge className="bg-app-text/5 text-app-text-faint text-[9px] border-app-text/10">+{plan.modules.length - 5}</Badge>
 )}
 </div>
 )}

 <div className="flex-1" />

 {isCustom ? (
 <a href="mailto:sales@tsf-city.com">
 <Button className="w-full h-14 rounded-xl bg-purple-600/20 hover:bg-purple-600 hover:text-app-text text-purple-300 border border-purple-500/20 font-bold tracking-wide transition-all group-hover:bg-purple-600 group-hover:text-app-text gap-2">
 <Mail size={16} /> Contact Sales
 </Button>
 </a>
 ) : (
 <Button className="w-full h-14 rounded-xl bg-app-text/5 hover:bg-emerald-600 hover:text-app-text text-emerald-400 border border-emerald-500/20 font-bold tracking-wide transition-all group-hover:bg-emerald-600 group-hover:text-app-text">
 {isFree ? 'Start Free' : 'Select Strategy'}
 </Button>
 )}
 </CardContent>
 </Card>
 )
 })}
 </div>
 </div>
 )
}
