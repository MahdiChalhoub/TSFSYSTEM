'use client'

import { useEffect, useState } from "react"
import { getOrganizations } from "@/app/(privileged)/(saas)/organizations/actions"
import { getSubscriptionPlans, subscribeToPlan } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, AlertTriangle, CreditCard, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"

export default function SubscriptionPage() {
    const [org, setOrg] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState<any[]>([])
    const [upgradeOpen, setUpgradeOpen] = useState(false)
    const [upgrading, setUpgrading] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const [orgData, plansData] = await Promise.all([
                    getOrganizations(),
                    getSubscriptionPlans()
                ])
                if (orgData && orgData.length > 0) {
                    setOrg(orgData[0])
                }
                setPlans(Array.isArray(plansData) ? plansData : [])
            } catch {
                toast.error("Failed to load subscription details")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    async function handleUpgrade(planId: string) {
        setUpgrading(true)
        try {
            await subscribeToPlan(planId)
            toast.success("Subscription updated successfully")
            setUpgradeOpen(false)
            // Refresh
            const orgData = await getOrganizations()
            if (orgData && orgData.length > 0) setOrg(orgData[0])
        } catch (e: any) {
            toast.error(e.message || "Upgrade failed")
        } finally {
            setUpgrading(false)
        }
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>

    if (!org) return (
        <div className="p-12 text-center">
            <h2 className="text-xl font-bold text-gray-800">No Organization Found</h2>
            <p className="text-gray-500">You do not appear to be managing any active organization instance.</p>
        </div>
    )

    const plan = org.current_plan_details || (org.current_plan ? { name: "Legacy Plan" } : null)
    const expiryDate = org.plan_expiry_at ? new Date(org.plan_expiry_at) : null
    const isExpired = expiryDate ? new Date() > expiryDate : false
    const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Subscription & Billing</h2>
                    <p className="text-gray-500 mt-2">Manage your plan, payment methods, and billing history.</p>
                </div>
                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-gray-200 text-gray-500">
                    {org.name}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Current Plan Card */}
                <Card className="md:col-span-2 border-emerald-100 bg-emerald-50/50 shadow-lg shadow-emerald-900/5">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl font-bold text-emerald-900">Current Plan</CardTitle>
                                <CardDescription className="text-emerald-700">Your active subscription tier</CardDescription>
                            </div>
                            {plan ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-4 py-1">
                                    {plan.name || "Custom Plan"}
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-gray-200 text-gray-600">Free Tier</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="p-6 bg-white rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                {isExpired ? (
                                    <div className="flex items-center gap-2 text-red-600 font-black text-xl">
                                        <AlertTriangle size={24} />
                                        EXPIRED
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-emerald-600 font-black text-xl">
                                        <ShieldCheck size={24} />
                                        ACTIVE
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Renewal Date</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}
                                </p>
                                {!isExpired && daysLeft < 30 && (
                                    <p className="text-xs text-amber-600 font-bold mt-1">{daysLeft} days remaining</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                                <DialogTrigger asChild>
                                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-900/20">
                                        Change Plan
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl bg-gray-50 border-gray-200">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-black">Select Subscription Plan</DialogTitle>
                                        <CardDescription>Upgrade to unlock more features and capacity.</CardDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                        {plans.filter(p => p.is_active).map(p => (
                                            <Card key={p.id} className={`cursor-pointer transition-all hover:border-emerald-500 ${plan?.id === p.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}`}>
                                                <CardHeader>
                                                    <CardTitle className="text-lg">{p.name}</CardTitle>
                                                    <div className="mt-2">
                                                        <span className="text-2xl font-black">${parseFloat(p.monthly_price).toFixed(0)}</span>
                                                        <span className="text-xs text-gray-500 font-bold uppercase ml-1">/mo</span>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <Button
                                                        className="w-full"
                                                        variant={plan?.id === p.id ? "outline" : "default"}
                                                        disabled={plan?.id === p.id || upgrading}
                                                        onClick={() => handleUpgrade(p.id)}
                                                    >
                                                        {upgrading ? "Processing..." : plan?.id === p.id ? "Current Plan" : "Select"}
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12 rounded-xl font-bold bg-white" onClick={() => toast.info("Payment integration coming soon. Please contact support.")}>
                                Manage Billing
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Usage</CardTitle>
                        <CardDescription>Resource consumption</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2 font-bold text-gray-700">
                                <span>Storage</span>
                                <span>{Math.round((org.data_usage_bytes || 0) / 1024 / 1024)} MB</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[5%]" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2 font-bold text-gray-700">
                                <span>Users</span>
                                <span>{org._count?.users || 1} / 5</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[20%]" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payment History Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-bold">Billing History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-gray-400 text-sm italic">
                        No recent transactions found.
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
