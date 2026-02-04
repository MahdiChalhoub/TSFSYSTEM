'use client'

import { useState, useEffect } from 'react'
import { getModules, enableModule, disableModule, ModuleInfo } from '@/app/actions/modules'
import { toast } from 'sonner'
import { Box, ShieldCheck, Zap, Info, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ModulesPage() {
    const [modules, setModules] = useState<ModuleInfo[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadModules()
    }, [])

    async function loadModules() {
        setLoading(true)
        const data = await getModules()
        setModules(data)
        setLoading(false)
    }

    async function handleToggle(module: ModuleInfo) {
        if (module.is_core) return

        const isEnabling = module.status === 'UNINSTALLED' || module.status === 'DISABLED'
        const action = isEnabling ? enableModule : disableModule

        const res = await action(module.code)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(res.message || (isEnabling ? 'Module enabled' : 'Module disabled'))
            loadModules()
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">System Engine</h1>
                    <p className="text-gray-400 mt-2 font-medium">Activate or configure platform extensions for your enterprise</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    <ShieldCheck size={14} />
                    Verified by SaaS Panel
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 shadow-lg shadow-emerald-500/20"></div>
                    <p className="text-gray-500 font-medium italic">Synchronizing instance capabilities...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {modules.map(module => (
                        <div key={module.code} className="bg-[#0F172A] rounded-[2.5rem] border border-gray-800 shadow-2xl p-8 flex flex-col justify-between group hover:border-emerald-500/40 transition-all duration-500">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-4 rounded-2xl transition-all duration-500 ${module.is_core ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                                        <Box size={28} />
                                    </div>
                                    <Badge className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${module.status === 'INSTALLED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            module.status === 'DISABLED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                'bg-gray-800 text-gray-400 border-transparent'
                                        }`}>
                                        {module.status}
                                    </Badge>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2 leading-none group-hover:text-emerald-400 transition-colors">{module.name}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium line-clamp-3">
                                    {module.description}
                                </p>

                                {module.dependencies.length > 0 && (
                                    <div className="mb-6 space-y-2">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dependencies</p>
                                        <div className="flex flex-wrap gap-2">
                                            {module.dependencies.map(dep => (
                                                <span key={dep} className="text-[10px] bg-gray-950 text-gray-500 border border-gray-800/50 px-3 py-1 rounded-lg font-mono font-bold">
                                                    {dep}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-800/50 flex items-center justify-between mt-auto">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Engine v{module.version}</span>
                                    {module.is_core && <span className="text-[9px] text-indigo-400 font-bold uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded mt-1">Platform Core</span>}
                                </div>
                                <Button
                                    onClick={() => handleToggle(module)}
                                    disabled={module.is_core}
                                    variant={module.status === 'INSTALLED' ? 'outline' : 'default'}
                                    className={`rounded-2xl px-6 font-black text-xs transition-all active:scale-95 ${module.is_core ? 'bg-gray-800/50 text-gray-600 border-transparent cursor-not-allowed' :
                                            module.status === 'INSTALLED' ? 'border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white hover:border-transparent' :
                                                'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                                        }`}
                                >
                                    {module.is_core ? (
                                        <span className="flex items-center gap-1"><Lock size={12} /> Core</span>
                                    ) : module.status === 'INSTALLED' ? (
                                        'Deactivate'
                                    ) : (
                                        <span className="flex items-center gap-1"><Zap size={14} fill="currentColor" /> Activate</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-8 bg-gray-950/50 rounded-[3rem] border border-gray-800 flex flex-col md:flex-row gap-6 items-center">
                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                    <Info size={32} />
                </div>
                <div className="flex-grow">
                    <h4 className="text-white font-black text-xl tracking-tight">Enterprise Infrastructure</h4>
                    <p className="text-gray-400 text-sm font-medium mt-1">
                        Modules are securely partitioned per organization. Some high-level features may require subscription verification by the platform administrator.
                    </p>
                </div>
                <Button variant="outline" className="rounded-2xl border-gray-800 text-gray-400 font-bold hover:bg-gray-800 shrink-0">
                    System Audit
                </Button>
            </div>
        </div>
    )
}
