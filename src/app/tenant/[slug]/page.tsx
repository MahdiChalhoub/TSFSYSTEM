import { getOrganizationBySlug } from "./actions"
import { notFound, redirect } from "next/navigation"
import { Building, ShieldCheck, ArrowRight, Globe, Users, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function TenantBrandedPortal({ params }: { params: { slug: string } }) {
    const org = await getOrganizationBySlug(params.slug)

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
                    <Button variant="outline" className="border-gray-800 text-white rounded-xl" asChild>
                        <Link href="/">Back to Home</Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-emerald-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-10">
                {/* Header */}
                <nav className="flex justify-between items-center mb-20 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
                            <span className="text-2xl font-black bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
                                {org.name[0]}
                            </span>
                        </div>
                        <div>
                            <h2 className="font-black text-xl tracking-tight leading-none">{org.name}</h2>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Verified Instance</p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-400 uppercase tracking-widest">
                        <a href="#" className="hover:text-white transition-colors">Resources</a>
                        <a href="#" className="hover:text-white transition-colors">Support</a>
                        <div className="h-4 w-px bg-gray-800" />
                        <span className="text-gray-600">ID: {org.id.split('-')[0]}</span>
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                <Globe size={14} /> Cloud Workspace Active
                            </div>
                            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.9]">
                                Enterprise <br />
                                <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent italic">Verified.</span>
                            </h1>
                            <p className="text-xl text-gray-400 max-w-lg leading-relaxed font-medium">
                                Welcome back to the {org.name} management environment. Your data is isolated, secure, and ready for operations.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button className="bg-white text-black hover:bg-gray-200 rounded-2xl px-10 py-8 font-black text-lg flex gap-3 shadow-2xl shadow-emerald-500/20 transition-all hover:scale-[1.03] active:scale-[0.98]">
                                Secure Login <ArrowRight size={20} />
                            </Button>
                            <Button variant="outline" className="border-gray-800 bg-transparent hover:bg-white/5 text-white rounded-2xl px-10 py-8 font-black text-lg transition-all">
                                Request Access
                            </Button>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-8 pt-10 border-t border-white/5">
                            <div>
                                <div className="text-3xl font-black text-white">{org._count.sites}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Operational Sites</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white">{org._count.users}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Team Members</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white">99.9%</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Instance Uptime</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
                        {/* Mockup Card */}
                        <div className="bg-[#0F172A] border border-white/10 rounded-[3rem] p-4 shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            <div className="bg-[#020617] rounded-[2.5rem] p-10 space-y-8 relative">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-gray-600 uppercase tracking-widest leading-none">Access Gateway</div>
                                        <div className="text-2xl font-black text-white">Identity Check</div>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                        <ShieldCheck size={28} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Identity Provider</label>
                                        <div className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-gray-400 text-sm font-medium flex justify-between items-center italic">
                                            {params.slug}.tsf-city.com
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Status</label>
                                        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-xs font-black text-emerald-300 uppercase tracking-tighter italic">Instance Reachable - Low Latency</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-between">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gray-800" />
                                        ))}
                                        <div className="w-10 h-10 rounded-full border-2 border-black bg-emerald-600 flex items-center justify-center text-[10px] font-black">+12</div>
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Active Sessions</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating elements */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl animate-pulse" />
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/20 blur-3xl animate-pulse" />
                    </div>
                </div>

                {/* Footer Section */}
                <footer className="mt-32 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 animate-in fade-in duration-1000">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.3em]">
                        &copy; 2026 TSF CITY OS &bull; <span className="text-gray-400">All Systems Operational</span>
                    </p>
                    <div className="flex gap-10 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-white transition-all">Privacy Protocol</a>
                        <a href="#" className="hover:text-white transition-all">Service Level Agreement</a>
                        <a href="#" className="hover:text-white transition-all">Global Node Map</a>
                    </div>
                </footer>
            </div>
        </div>
    )
}
