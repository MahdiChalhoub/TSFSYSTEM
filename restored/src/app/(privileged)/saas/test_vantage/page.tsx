'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ShieldCheck, Server, Globe } from "lucide-react"

export default function TestVantagePage() {
    return (
        <div className="p-8 space-y-8 animate-in slide-in-from-bottom duration-700">
            <div>
                <h2 className="text-4xl font-black text-white tracking-tight italic">Voyager Module</h2>
                <p className="text-cyan-400 mt-2 font-mono uppercase tracking-widest text-xs">Pipeline Verification: Online</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 rounded-3xl overflow-hidden shadow-2xl">
                    <CardHeader>
                        <ShieldCheck className="text-cyan-400 mb-2" size={32} />
                        <CardTitle className="text-white">Security Check</CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-400 text-sm">
                        This module was uploaded via the SaaS Portal and verified by the platform kernel.
                    </CardContent>
                </Card>

                <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/20 rounded-3xl overflow-hidden shadow-2xl">
                    <CardHeader>
                        <Server className="text-emerald-400 mb-2" size={32} />
                        <CardTitle className="text-white">Live Deployment</CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-400 text-sm">
                        Code successfully injected into the production Docker environment without a rebuild.
                    </CardContent>
                </Card>

                <Card className="bg-black/40 backdrop-blur-xl border-purple-500/20 rounded-3xl overflow-hidden shadow-2xl">
                    <CardHeader>
                        <Globe className="text-purple-400 mb-2" size={32} />
                        <CardTitle className="text-white">Global Reach</CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-400 text-sm">
                        Available across all provisioned organizations in the current cluster.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}