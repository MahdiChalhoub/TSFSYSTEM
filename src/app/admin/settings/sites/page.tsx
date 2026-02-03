import { getSites } from "@/app/actions/sites";
import SiteManager from "./manager";
import { Building2, Globe, ShieldCheck } from "lucide-react";

export default async function SitesPage() {
    const sites = await getSites();

    return (
        <div className="min-h-screen bg-[#FDFDFF] p-6 lg:p-12">
            <div className="max-w-[1600px] mx-auto space-y-12">
                {/* Enterprise Header */}
                <div className="bg-white rounded-[60px] p-10 lg:p-16 relative overflow-hidden shadow-2xl shadow-indigo-900/5 flex flex-col lg:flex-row justify-between items-center gap-12 border border-gray-50">
                    {/* Decorative Blobs */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-50 rounded-full blur-[100px] opacity-60"></div>
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-50 rounded-full blur-[100px] opacity-60"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="w-28 h-28 rounded-[40px] bg-indigo-600 shadow-2xl shadow-indigo-300 flex items-center justify-center -rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Building2 size={48} className="text-white" />
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 tracking-tighter mb-4">
                                Multi-Site <span className="text-indigo-600">Logistics</span>
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <span className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <Globe size={16} /> Global Network
                                </span>
                                <span className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={16} /> Secured by RBAC
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4 lg:gap-8 w-full lg:w-auto">
                        <div className="p-8 lg:p-10 bg-gray-50 rounded-[48px] text-center border-2 border-white shadow-xl flex flex-col justify-center">
                            <div className="text-4xl lg:text-6xl font-black text-gray-900 mb-2">{sites.length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Active Branches</div>
                        </div>
                        <div className="p-8 lg:p-10 bg-indigo-600 rounded-[48px] text-center shadow-2xl shadow-indigo-200 flex flex-col justify-center">
                            <div className="text-4xl lg:text-6xl font-black text-white mb-2">
                                {sites.reduce((acc: number, s: any) => acc + (s._count?.warehouses || 0), 0)}
                            </div>
                            <div className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em]">Total Zones</div>
                        </div>
                    </div>
                </div>

                <SiteManager sites={sites} />
            </div>
        </div>
    );
}
