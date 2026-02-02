"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building, Globe, Zap, ShieldCheck, Activity, Check, ArrowRight, Layout, PieChart, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { registerBusiness } from "@/app/actions/saas/registration"

export default function LandingPage() {
    const [loading, setLoading] = useState(false)
    const [businessData, setBusinessData] = useState({ name: '', slug: '', email: '' })

    const plans = [
        {
            name: "Free Test",
            price: "$0",
            desc: "Perfect for exploring the platform",
            features: ["Up to 2 sites", "5 active users", "Basic reports", "Community support"],
            button: "Start Free Trial",
            highlight: false
        },
        {
            name: "Professional",
            price: "$49",
            desc: "For growing businesses scaling fast",
            features: ["Unlimited sites", "50 users", "Advanced finance logic", "Priority support"],
            button: "Get Started Now",
            highlight: true
        },
        {
            name: "Enterprise",
            price: "Custom",
            desc: "Full power for large organizations",
            features: ["Global instances", "Unlimited users", "Custom ERP modules", "24/7 dedicated lead"],
            button: "Contact Sales",
            highlight: false
        }
    ]

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        if (!businessData.name || !businessData.slug) return toast.error("Please fill required fields")
        setLoading(true)
        try {
            await registerBusiness({ name: businessData.name, slug: businessData.slug })
            toast.success("Business Registered! Redirecting to your instance...")
            setTimeout(() => {
                window.location.href = `http://${businessData.slug}.localhost:3000`
            }, 1500)
        } catch (error) {
            toast.error("Registration failed. Slug might be taken.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-32 mb-32">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
                <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                        <Zap size={14} />
                        Next-Gen Business OS
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[1.1]">
                        One Platform.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Unlimited Growth.</span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
                        TSF CITY is the world's most advanced multi-tenant ERP and Retail platform.
                        Provision your entire business ecosystem in under 60 seconds.
                    </p>
                    <div className="flex flex-col md:flex-row justify-center gap-4 pt-8">
                        <a href="#register">
                            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-8 rounded-2xl text-lg font-bold shadow-2xl shadow-emerald-900/40 border-none group">
                                Provision Your Business
                                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </a>
                        <Button variant="outline" size="lg" className="border-slate-800 bg-slate-950/50 hover:bg-slate-900 px-8 py-8 rounded-2xl text-lg font-bold">
                            View Demo
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features Preview */}
            <section id="features" className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Layout, title: "Modern ERP", desc: "Full control over your financial core and automated ledger system." },
                        { icon: ShoppingCart, title: "Smart POS", desc: "Omnichannel retail experience with real-time inventory sync." },
                        { icon: PieChart, title: "Dual Intelligence", desc: "Switch between Official and Internal data views instantly." }
                    ].map((f, i) => (
                        <div key={i} className="p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] hover:border-emerald-500/50 transition-all group">
                            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                                <f.icon size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Registration Form */}
            <section id="register" className="max-w-4xl mx-auto px-6">
                <Card className="bg-slate-950 border border-slate-800 rounded-[3rem] overflow-hidden shadow-3xl shadow-emerald-900/10 relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -z-10" />
                    <CardHeader className="p-12 text-center">
                        <CardTitle className="text-4xl font-black">Join the Federation</CardTitle>
                        <CardDescription className="text-slate-400 text-lg">Start your 14-day free test with all features unlocked.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-12 pb-12">
                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="uppercase tracking-widest text-[10px] font-bold text-slate-500">Business Name</Label>
                                    <Input
                                        placeholder="e.g. Acme Corp"
                                        className="bg-slate-900 border-slate-800 rounded-2xl h-14"
                                        value={businessData.name}
                                        onChange={e => setBusinessData({ ...businessData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="uppercase tracking-widest text-[10px] font-bold text-slate-500">Workspace / Slug</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="acme"
                                            className="bg-slate-900 border-slate-800 rounded-2xl h-14 font-mono text-emerald-400"
                                            value={businessData.slug}
                                            onChange={e => setBusinessData({ ...businessData, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                                        />
                                        <div className="h-14 flex items-center text-slate-500 font-mono text-xs">.tsf-city.com</div>
                                    </div>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-16 rounded-2xl text-xl font-black shadow-xl shadow-emerald-900/20"
                                disabled={loading}
                            >
                                {loading ? "Initializing Workspace..." : "Create My Instance"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black mb-4">Transparent Pricing</h2>
                    <p className="text-slate-400">No hidden fees. Scale as you grow.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((p, i) => (
                        <div key={i} className={`p-10 rounded-[2.5rem] border ${p.highlight ? 'bg-emerald-600 border-emerald-400 shadow-2xl shadow-emerald-900/40 relative' : 'bg-slate-950 border-slate-800'}`}>
                            {p.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-emerald-600 text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-tighter shadow-lg">Most Popular</div>}
                            <h3 className={`text-2xl font-black mb-2 ${p.highlight ? 'text-white' : 'text-slate-100'}`}>{p.name}</h3>
                            <div className="flex items-end gap-1 mb-6">
                                <span className={`text-5xl font-black ${p.highlight ? 'text-white' : 'text-slate-100'}`}>{p.price}</span>
                                {p.price !== "Custom" && <span className={p.highlight ? 'text-emerald-200' : 'text-slate-500'}>/month</span>}
                            </div>
                            <p className={`text-sm mb-8 ${p.highlight ? 'text-emerald-100' : 'text-slate-400'}`}>{p.desc}</p>
                            <ul className="space-y-4 mb-10">
                                {p.features.map((f, j) => (
                                    <li key={j} className="flex gap-3 text-sm font-medium">
                                        <Check size={18} className={p.highlight ? 'text-white' : 'text-emerald-400'} />
                                        <span className={p.highlight ? 'text-emerald-50' : 'text-slate-300'}>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button className={`w-full h-14 rounded-2xl font-bold transition-all ${p.highlight ? 'bg-white text-emerald-600 hover:bg-slate-100 shadow-xl' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                                {p.button}
                            </Button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
