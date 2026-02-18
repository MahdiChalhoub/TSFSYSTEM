'use client'

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Command } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/branding";

const initialState: { error: any; success?: boolean } = {
    error: {},
};

export default function SaaSLoginPage() {
    const [state, action, isPending] = useActionState(loginAction, initialState);

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Tactical Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-[#020617]/80 to-[#020617] pointer-events-none" />

            <Card className="w-full max-w-lg bg-[#0f172a] border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

                <CardHeader className="text-center pb-2 pt-8">
                    <div className="w-16 h-16 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                        <Command size={32} />
                    </div>
                    <CardTitle className="text-2xl font-black text-white uppercase tracking-widest">Admin Login</CardTitle>
                    <CardDescription className="font-mono text-cyan-500/60 text-xs mt-2 uppercase tracking-widest">Restricted Access // Level 5 Clearance</CardDescription>
                </CardHeader>

                <CardContent className="p-8 space-y-6">
                    <form action={action} className="space-y-6">
                        {(state?.error as any)?.root && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-mono mb-4 text-center">
                                {(state?.error as any).root[0]}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Hidden slug field to ensure correct redirection after login */}
                            <input type="hidden" name="slug" value="saas" />

                            <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Commander ID</Label>
                                <Input
                                    name="username"
                                    required
                                    autoComplete="off"
                                    className="bg-slate-900 border-white/5 h-12 text-white font-mono focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                    placeholder="IDENTIFIER"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Access Key</Label>
                                <Input
                                    name="password"
                                    type="password"
                                    required
                                    className="bg-slate-900 border-white/5 h-12 text-white font-mono focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>

                        <Button className="w-full h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)]" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                        </Button>
                    </form>

                    <div className="flex justify-center pt-4 opacity-30 hover:opacity-100 transition-opacity">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-500 font-mono">
                            {PLATFORM_CONFIG.name} Control v{PLATFORM_CONFIG.version}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
