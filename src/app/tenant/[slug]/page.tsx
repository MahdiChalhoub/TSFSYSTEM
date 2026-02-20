import { getOrganizationBySlug, getPublicProducts } from "./actions"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { ShieldCheck, Building2, Globe, Sparkles, Search, Grid3X3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { StorefrontCatalog } from "@/components/tenant/StorefrontCatalog"
import { TenantQuickLogin } from "@/components/tenant/TenantQuickLogin"
import { ClientPortalLogin } from "@/components/tenant/ClientPortalLogin"
import { PLATFORM_CONFIG, getDynamicBranding } from "@/lib/branding"

export default async function TenantWelcomePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const host = (await headers()).get('host') || undefined;
    const branding = getDynamicBranding(host);
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
                                <Globe size={14} /> {PLATFORM_CONFIG.federation_name}
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
                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-3">
                            <Link href={`/tenant/${slug}/search`}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl text-slate-300 text-sm font-medium transition-all">
                                <Search size={16} className="text-slate-500" /> Search Products
                            </Link>
                            <Link href={`/tenant/${slug}/categories`}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl text-slate-300 text-sm font-medium transition-all">
                                <Grid3X3 size={16} className="text-slate-500" /> Categories
                            </Link>
                        </div>

                        <TenantQuickLogin slug={slug} suffix={branding.suffix} />
                        <ClientPortalLogin slug={slug} />

                        <div className="flex items-center gap-6 pt-4">
                            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest whitespace-nowrap">ID: {org.id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>

                {/* Right Section: Product Catalog (Scrolls) */}
                <div className="lg:col-span-7 animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                    <StorefrontCatalog products={products} slug={slug} />

                    {/* Footer Info */}
                    <div className="mt-20 pt-12 border-t border-white/5 space-y-4">
                        <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">{PLATFORM_CONFIG.name} Infrastructure • {org.name} Node</div>
                        <p className="text-[10px] text-slate-800 font-medium max-w-md leading-relaxed">
                            Encrypted connection established. All transactions are logged and verified by the {PLATFORM_CONFIG.federation_name}.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
