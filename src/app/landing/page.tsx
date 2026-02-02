"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, UserPlus, LogIn, ArrowRight, ShieldCheck, Zap, Globe, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { registerBusiness } from "@/app/actions/saas/registration"

type AuthMode = 'login' | 'signup' | 'register'

export default function LandingPage() {
    const [mode, setMode] = useState<AuthMode>('login')
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        email: '',
        workspace: '' // For login/signup discovery
    })

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (mode === 'register') {
                if (!formData.name || !formData.slug) throw new Error("Please fill business details")
                await registerBusiness({ name: formData.name, slug: formData.slug })
                toast.success("Business Registered! provisioning your instance...")
                setTimeout(() => {
                    const host = window.location.host.includes('localhost') ? `http://${formData.slug}.localhost:3000` : `https://${formData.slug}.${window.location.host}`
                    window.location.href = host
                }, 1500)
            } else if (mode === 'login') {
                if (!formData.workspace) throw new Error("Workspace ID required")
                const host = window.location.host.includes('localhost') ? `http://${formData.workspace}.localhost:3000/login` : `https://${formData.workspace}.${window.location.host}/login`
                window.location.href = host
            } else if (mode === 'signup') {
                if (!formData.workspace) throw new Error("Workspace ID required")
                const host = window.location.host.includes('localhost') ? `http://${formData.workspace}.localhost:3000/register/user` : `https://${formData.workspace}.${window.location.host}/register/user`
                window.location.href = host
            }
        } catch (error: any) {
            toast.error(error.message || "Operation failed")
        } finally {
            setLoading(false)
        }
    }

    const renderForm = () => {
        switch (mode) {
            case 'login':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-tighter font-bold text-slate-500">Workspace ID</Label>
                            <Input
                                placeholder="e.g. acme"
                                className="bg-slate-900/50 border-slate-800 h-14 rounded-xl font-mono text-emerald-400 focus:ring-emerald-500/20"
                                value={formData.workspace}
                                onChange={e => setFormData({ ...formData, workspace: e.target.value.toLowerCase() })}
                            />
                            <p className="text-[10px] text-slate-500">Enter the unique identifier of your organization.</p>
                        </div>
                        <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 group" disabled={loading}>
                            Access Workspace <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                )
            case 'signup':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-tighter font-bold text-slate-500">Target Workspace</Label>
                            <Input
                                placeholder="e.g. acme"
                                className="bg-slate-900/50 border-slate-800 h-14 rounded-xl font-mono text-cyan-400 focus:ring-cyan-500/20"
                                value={formData.workspace}
                                onChange={e => setFormData({ ...formData, workspace: e.target.value.toLowerCase() })}
                            />
                            <p className="text-[10px] text-slate-500">Find the business you want to join.</p>
                        </div>
                        <Button className="w-full h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 group" disabled={loading}>
                            Join Organization <UserPlus className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform" />
                        </Button>
                    </div>
                )
            case 'register':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-tighter font-bold text-slate-500">Business Name</Label>
                                <Input
                                    placeholder="Acme Industries"
                                    className="bg-slate-900/50 border-slate-800 h-14 rounded-xl"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-tighter font-bold text-slate-500">Instance Slug</Label>
                                <Input
                                    placeholder="acme"
                                    className="bg-slate-900/50 border-slate-800 h-14 rounded-xl font-mono text-amber-400"
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                                />
                            </div>
                        </div>
                        <Button className="w-full h-14 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-900/20 group" disabled={loading}>
                            Provision Infrastructure <ShieldCheck className="ml-2 w-4 h-4 group-hover:animate-pulse" />
                        </Button>
                    </div>
                )
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />

            {/* Header Content */}
            <div className="text-center mb-12 space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 backdrop-blur-md">
                    <Sparkles size={12} className="animate-pulse" />
                    Strategic Enterprise Operating System
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none italic">
                    VANTAGE <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 not-italic">OS</span>
                </h1>
                <p className="text-slate-400 max-w-lg mx-auto text-sm md:text-base font-medium">
                    The hybrid backbone for modern commerce. Multi-tenant architecture designed for massive scale and tactical precision.
                </p>
            </div>

            {/* Main Unified Portal */}
            <Card className="w-full max-w-2xl bg-white/[0.02] border-white/10 backdrop-blur-2xl rounded-[2rem] overflow-hidden shadow-2xl relative z-10 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

                {/* Mode Switcher */}
                <div className="grid grid-cols-3 border-b border-white/5 bg-white/[0.01]">
                    <button
                        onClick={() => setMode('login')}
                        className={`py-6 flex flex-col items-center gap-2 transition-all ${mode === 'login' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <LogIn size={20} className={mode === 'login' ? 'scale-110' : ''} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Entrance</span>
                    </button>
                    <button
                        onClick={() => setMode('signup')}
                        className={`py-6 flex flex-col items-center gap-2 transition-all ${mode === 'signup' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <UserPlus size={20} className={mode === 'signup' ? 'scale-110' : ''} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Recruitment</span>
                    </button>
                    <button
                        onClick={() => setMode('register')}
                        className={`py-6 flex flex-col items-center gap-2 transition-all ${mode === 'register' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Building2 size={20} className={mode === 'register' ? 'scale-110' : ''} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Founding</span>
                    </button>
                </div>

                <CardContent className="p-8 md:p-12">
                    <form onSubmit={handleAction}>
                        {renderForm()}
                    </form>
                </CardContent>

                {/* Footer Insight */}
                <div className="p-8 border-t border-white/5 bg-black/20 text-center">
                    <div className="flex flex-wrap justify-center gap-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <div className="flex items-center gap-2"><Zap size={14} className="text-emerald-500" /> Real-time Sync</div>
                        <div className="flex items-center gap-2"><Globe size={14} className="text-cyan-500" /> Multi-Tenant</div>
                        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-amber-500" /> Encrypted Core</div>
                    </div>
                </div>
            </Card>

            {/* Bottom Credits */}
            <div className="mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] relative z-10">
                Secured by TSF Federation Architecture
            </div>
        </div>
    )
}
