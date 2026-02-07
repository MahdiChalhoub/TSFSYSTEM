'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Box, CheckCircle2, Zap } from "lucide-react"

export default function DemoPage() {
    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-4xl font-black text-white tracking-tight">Demo Feature Module</h2>
                <p className="text-gray-400 mt-2 font-medium">Verification successful. This module is registered and active in the SaaS Panel.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#0F172A]/80 backdrop-blur-md border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                            <CheckCircle2 size={24} />
                        </div>
                        <CardTitle className="text-xl font-bold text-white">Installation Verified</CardTitle>
                        <CardDescription>System has correctly identified the "demo" slug and enabled this route.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-400">
                        This page works as a live verification of the modular package system.
                    </CardContent>
                </Card>

                <Card className="bg-[#0F172A]/80 backdrop-blur-md border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                            <Zap size={24} />
                        </div>
                        <CardTitle className="text-xl font-bold text-white">Registry Logic</CardTitle>
                        <CardDescription>Module discovered in filesystem and injected into kernel successfully.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-400">
                        Ready for business logic implementation.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}