import { getOrganizationBySlug, getPublicProducts } from "./actions"
import { notFound } from "next/navigation"
import { ShieldCheck, Lock, ArrowRight, Building2, Globe, Command, Sparkles, Activity, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { StorefrontCatalog } from "@/components/tenant/StorefrontCatalog"
import { PLATFORM_CONFIG, getDynamicBranding } from "@/lib/saas_config"

export default async function TenantWelcomePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const branding = getDynamicBranding();
    const org = await getOrganizationBySlug(slug)
    const products = await getPublicProducts(slug)

    if (!org) {
        return notFound()
    }

    if ((org as any).error === "ACCOUNT_SUSPENDED") {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                        <ShieldCheck size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Instance Suspended</h1>
                    <p className="text-gray-400">The account for <span className="text-white font-bold">{org.name}</span> has been temporarily suspended. Please contact platform administration.</p>
                    <Link href="/">
                        <Button variant="outline" className="border-gray-800 text-white rounded-xl">
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 overflow-x-hidden relative">
            {/* Ambient Background */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
                {/* Left Section: Info & Login (Sticky on LG) */}
                <div className="lg:col-span-5 space-y-12 lg:sticky lg:top-12 lg:h-fit">
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                <Globe size={14} /> {PLATFORM_CONFIG.federation_name} Edge Node
                            </div>
                            <h1 className="text-6xl lg:text-8xl font-black text-white tracking-tighter leading-none">
                                {org.name} <span className="text-emerald-500">.</span>
                            </h1>
                            <p className="text-lg text-slate-400 font-medium max-w-sm leading-relaxed">
                                Welcome to the official digital gateway for {org.name}. Explore our catalog or authenticate to manage your operations.
                            </p>
                        </div>

                        {/* Telemetry Chips */}
                        <div className="flex flex-wrap gap-4">
                            <div className="px-6 py-4 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-xl group hover:border-emerald-500/30 transition-all">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Products</div>
                                <div className="text-2xl font-black text-white flex items-center gap-2">
                                    <Sparkles size={18} className="text-emerald-500" />
                                    {products.length || 0}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-xl group hover:border-blue-500/30 transition-all">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sites</div>
                                <div className="text-2xl font-black text-white flex items-center gap-2">
                                    <Building2 size={18} className="text-blue-500" />
                                    {org._count?.sites || 0}
                                </div>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex justify-between items-center relative">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-bold text-white">Secure Access</h2>
                                    <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">{slug}{branding.suffix}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform">
                                    <Lock size={20} />
                                </div>
                            </div>

                            <div className="space-y-4 pt-2 relative">
                                <input
                                    type="email"
                                    placeholder="Credentials"
                                    className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                                />
                                <input
                                    type="password"
                                    placeholder="Access Key"
                                    className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                                />
                                <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3">
                                    Initialize Session <ArrowRight size={20} />
                                </button>
                                <div className="flex justify-center">
                                    <Link href="/login" className="text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.2em] transition-colors mt-2">
                                        Advanced Authentication
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 pt-4">
                            <a
                                href={`http://saas.${branding.domain}/saas/dashboard`}
                                className="inline-flex items-center gap-2 text-[10px] text-slate-600 hover:text-emerald-500 font-bold uppercase tracking-[0.2em] transition-colors"
                            >
                                <ShieldCheck size={14} /> Master Panel
                            </a>
                            <div className="h-px w-10 bg-white/5" />
                            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest whitespace-nowrap">ID: {org.id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>

                {/* Right Section: Product Catalog (Scrolls) */}
                <div className="lg:col-span-7 animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                    <StorefrontCatalog products={products} />

                    {/* Footer Info */}
                    <div className="mt-20 pt-12 border-t border-white/5 space-y-4">
                        <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">{PLATFORM_CONFIG.name} Infrastructure • {org.name} Node</div>
                        <p className="text-[10px] text-slate-800 font-medium max-w-md leading-relaxed">
                            Encrypted connection established. All transactions are logged and verified by the {PLATFORM_CONFIG.federation_name} Protocol.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
