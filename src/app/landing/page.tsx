"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, UserPlus, LogIn, ArrowRight, ShieldCheck, Zap, Globe, Sparkles, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { PLATFORM_CONFIG } from "@/lib/saas_config"
import { checkWorkspace } from "@/app/actions/onboarding"

type AuthMode = 'login' | 'signup' | 'register'

export default function LandingPage() {
    const [mode, setMode] = useState<AuthMode>('login')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [suggestions, setSuggestions] = useState<string[]>([])

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        email: '',
        workspace: ''
    })

    // Reset states when mode changes
    useEffect(() => {
        setError(null)
        setSuggestions([])
    }, [mode])

    const generateSuggestions = (base: string) => {
        const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '-')
        return [
            `${clean}-corp`,
            `${clean}-hq`,
            `${clean}-${Math.floor(Math.random() * 900) + 100}`,
            `${clean}-global`
        ]
    }

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuggestions([])

        try {
            if (mode === 'register') {
                if (!formData.name || !formData.slug) {
                    throw new Error("Missing tactical coordinates (Name & Slug).")
                }

                // First, check if the desired slug is taken
                const check = await checkWorkspace(formData.slug)
                if (check.exists) {
                    setError("Business ID collision detected. This designation is already active.")
                    setSuggestions(generateSuggestions(formData.slug))
                    setLoading(false)
                    return
                }

                // If available, redirect to full registration form with initial data
                toast.success("Designation available. Initializing onboarding sequence...")
                setTimeout(() => {
                    window.location.href = `/register/business?slug=${formData.slug}&name=${encodeURIComponent(formData.name)}`
                }, 1000)
                return
            } else {
                // Discovery for Login/Signup
                if (!formData.workspace) throw new Error("Workspace ID required for uplink.")

                const check = await checkWorkspace(formData.workspace)
                if (check.exists) {
                    const params = new URLSearchParams()
                    // Special Handling for SaaS
                    if (formData.workspace === 'saas') {
                        window.location.href = '/saas/login'
                        return
                    }

                    // Check if Host is IP
                    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(window.location.host);

                    if (isIp) {
                        // IP LOGIC: Path based or query based
                        const route = mode === 'login' ? '/login' : '/register/user'
                        // We pass slug as query param so login page knows context
                        window.location.href = `${window.location.protocol}//${window.location.host}${route}?slug=${formData.workspace}`
                    } else {
                        // DOMAIN LOGIC: Subdomain
                        const route = mode === 'login' ? '/login' : '/register/user'
                        const host = window.location.host.includes('localhost')
                            ? `${window.location.protocol}//${formData.workspace}.localhost:3000${route}`
                            : `${window.location.protocol}//${formData.workspace}.${window.location.host}${route}`
                        window.location.href = host
                    }
                } else {
                    setError(`Workspace '${formData.workspace}' not found in the federation.`)
                }
            }
        } catch (err: any) {
            setError(err.message || "Uplink failure. Please check connection.")
        } finally {
            setLoading(false)
        }
    }

    const applySuggestion = (s: string) => {
        setFormData({ ...formData, slug: s })
        setError(null)
        setSuggestions([])
    }

    const renderForm = () => {
        const isLogin = mode === 'login'
        const isSignup = mode === 'signup'
        const isRegister = mode === 'register'

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {(isLogin || isSignup) && (
                    <div className="space-y-3">
                        <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 flex items-center gap-2">
                            Target Workspace ID
                        </Label>
                        <Input
                            placeholder="e.g. acme"
                            className={`bg-slate-900/50 border-slate-800 h-16 rounded-2xl font-mono text-lg transition-all focus:ring-2 ${isLogin ? 'text-emerald-400 focus:ring-emerald-500/20' : 'text-cyan-400 focus:ring-cyan-500/20'}`}
                            value={formData.workspace}
                            onChange={e => setFormData({ ...formData, workspace: e.target.value.toLowerCase().trim() })}
                        />
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Connect to your organization's secure instance.</p>
                    </div>
                )}

                {isRegister && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Business Title</Label>
                                <Input
                                    placeholder="Acme Industries"
                                    className="bg-slate-900/50 border-slate-800 h-16 rounded-2xl text-white font-bold"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Workspace Slug</Label>
                                <Input
                                    placeholder="acme"
                                    className="bg-slate-900/50 border-slate-800 h-16 rounded-2xl font-mono text-amber-400 text-lg"
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-3 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                        {suggestions.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Suggested Available Designations:</p>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => applySuggestion(s)}
                                            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-mono text-amber-400 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <Button
                    className={`w-full h-16 rounded-2xl text-lg font-black tracking-tight shadow-2xl transition-all active:scale-[0.98] ${isLogin ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20' :
                        isSignup ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20' :
                            'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                        }`}
                    disabled={loading}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <RotateCcw className="animate-spin" size={20} />
                            Establishing Uplink...
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            {isLogin ? "Initialize Command" : isSignup ? "Request Recruitment" : "Found Federation"}
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    )}
                </Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/5 blur-[160px] rounded-full" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none brightness-200" />

            {/* Header Content */}
            <div className="text-center mb-16 space-y-4 relative z-10 transition-all duration-1000">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 backdrop-blur-xl">
                    <Sparkles size={14} className="animate-pulse" />
                    Strategic Tactical OS Backbone
                </div>
                <h1 className="text-6xl md:text-9xl font-black text-white tracking-tighter leading-none italic select-none">
                    {PLATFORM_CONFIG.name.split(' ')[0]} <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-400 not-italic drop-shadow-2xl">{PLATFORM_CONFIG.name.split(' ').slice(1).join(' ')}</span>
                </h1>
                <p className="text-slate-500 max-w-lg mx-auto text-sm md:text-lg font-medium leading-relaxed">
                    Unifying distributed business intelligence into a single, high-fidelity command interface.
                </p>
            </div>

            {/* Main Unified Portal */}
            <Card className="w-full max-w-2xl bg-[#0f172a]/40 border-white/5 backdrop-blur-[40px] rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border-t border-t-white/10 relative z-10 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                {/* Mode Switcher */}
                <div className="grid grid-cols-3 border-b border-white/5 bg-black/20">
                    <button
                        onClick={() => setMode('login')}
                        className={`py-8 flex flex-col items-center gap-3 transition-all relative ${mode === 'login' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <LogIn size={24} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Entrance</span>
                        {mode === 'login' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setMode('signup')}
                        className={`py-8 flex flex-col items-center gap-3 transition-all relative ${mode === 'signup' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <UserPlus size={24} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Recruit</span>
                        {mode === 'signup' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-cyan-500 rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setMode('register')}
                        className={`py-8 flex flex-col items-center gap-3 transition-all relative ${mode === 'register' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Building2 size={24} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Found</span>
                        {mode === 'register' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-500 rounded-t-full" />}
                    </button>
                </div>

                <CardContent className="p-10 md:p-16">
                    <form onSubmit={handleAction}>
                        {renderForm()}
                    </form>
                </CardContent>

                {/* Tactical Ledger Footer */}
                <div className="p-10 border-t border-white/5 bg-black/40">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                            <div className="text-white font-black text-xl flex items-center justify-center gap-2"><Zap size={16} className="text-emerald-400" /> 2.4s</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Latency Uplink</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-white font-black text-xl flex items-center justify-center gap-2"><CheckCircle2 size={16} className="text-cyan-400" /> AES</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Encryption</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-white font-black text-xl flex items-center justify-center gap-2"><Globe size={16} className="text-amber-400" /> INF</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Provisioning</div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Bottom Credits */}
            <div className="mt-16 text-[11px] font-black text-slate-700 uppercase tracking-[0.8em] relative z-10 flex items-center gap-4">
                <div className="h-[1px] w-12 bg-slate-800" />
                Secured by {PLATFORM_CONFIG.federation_name} Core
                <div className="h-[1px] w-12 bg-slate-800" />
            </div>
        </div>
    )
}
