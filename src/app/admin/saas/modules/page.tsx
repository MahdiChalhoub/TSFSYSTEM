'use client'

import { useEffect, useState } from "react"
import { getSaaSModules, syncModulesGlobal, installModuleGlobal } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Box, RefreshCw, Zap, ShieldCheck, Info } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function SaaSModulesPage() {
    const [modules, setModules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    useEffect(() => {
        loadModules()
    }, [])

    async function loadModules() {
        setLoading(true)
        try {
            const data = await getSaaSModules()
            setModules(data)
        } catch {
            toast.error("Failed to load modules")
        } finally {
            setLoading(false)
        }
    }

    async function handleSync() {
        setSyncing(true)
        try {
            const res = await syncModulesGlobal()
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            loadModules()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSyncing(false)
        }
    }

    async function handleGlobalInstall(code: string) {
        try {
            const res = await installModuleGlobal(code)
            if (res.error) throw new Error(res.error)
            toast.success(res.message)
            loadModules()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">Global Module Registry</h2>
                    <p className="text-gray-400 mt-2 font-medium">Coordinate system features across all tenant distributions</p>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-6 rounded-2xl flex gap-2 font-bold transition-all"
                >
                    <RefreshCw size={20} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Scanning Filesystem..." : "Sync Registry"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-gray-500 font-medium italic">Scanning core modules...</div>
                ) : modules.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-500 font-medium">No modules detected in filesystem.</div>
                ) : modules.map((m) => (
                    <Card key={m.code} className="bg-[#0F172A] border-gray-800 hover:border-emerald-500/50 transition-all rounded-3xl overflow-hidden group shadow-xl flex flex-col">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div className={`p-3 rounded-2xl ${m.is_core ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <Box size={24} />
                                </div>
                                {m.is_core && (
                                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                                        Core Module
                                    </Badge>
                                )}
                            </div>
                            <CardTitle className="text-2xl font-bold text-white mt-4">{m.name}</CardTitle>
                            <CardDescription className="text-gray-400 text-xs mt-1">
                                Version {m.version} | ID: {m.code}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-grow flex flex-col justify-between">
                            <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                {m.description}
                            </p>

                            <div className="space-y-4 pt-4 border-t border-gray-800/50">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 uppercase font-black tracking-widest">Active Installs</span>
                                    <span className="text-emerald-400 font-mono font-bold leading-none">{m.total_installs} Tenants</span>
                                </div>

                                {m.dependencies.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {m.dependencies.map((dep: string) => (
                                            <span key={dep} className="px-2 py-1 bg-gray-900 border border-gray-800 text-[10px] text-gray-400 rounded-lg font-mono">
                                                {dep}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    onClick={() => handleGlobalInstall(m.code)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-6 font-black shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
                                >
                                    <Zap size={18} className="mr-2" />
                                    Push to All Tenants
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="p-6 bg-emerald-500/5 rounded-[2.5rem] border border-emerald-500/10 flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Info size={24} />
                </div>
                <div>
                    <h4 className="text-emerald-400 font-bold">Manager Tip</h4>
                    <p className="text-sm text-emerald-300/70 font-medium">
                        Syncing the Registry will detect new folders in `erp/modules`. Use "Push to All" only for core updates or mandatory subscription migrations.
                    </p>
                </div>
            </div>
        </div>
    )
}
