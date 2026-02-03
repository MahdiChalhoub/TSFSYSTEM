'use client'

import { useActionState, useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, ShieldCheck, SquareTerminal, Command, Building2, Globe } from "lucide-react";

const initialState: { error: any; success?: boolean } = {
    error: {},
};

function LoginContent() {
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<any>({ tenant: null });
    const searchParams = useSearchParams();

    let prefilledUsername = "";
    const uParam = searchParams.get('u');
    const userParam = searchParams.get('username');

    if (uParam) {
        try {
            prefilledUsername = atob(uParam);
        } catch (e) {
            console.error("Failed to decode username");
        }
    } else if (userParam) {
        prefilledUsername = userParam;
    }

    useEffect(() => {
        getPublicConfig().then(setConfig);
    }, []);

    const tenant = config.tenant;
    const isRoot = !tenant || !tenant.name;
    const tenantName = tenant?.name || "TSF Cloud";
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    // --- VIEW 1: SAAS COMMAND INTERFACE (ROOT) ---
    if (isRoot) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
                {/* Tactical Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-[#020617]/80 to-[#020617] pointer-events-none" />

                <Card className="w-full max-w-lg bg-[#0f172a] border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative z-10">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

                    <CardHeader className="text-center pb-2 pt-8">
                        <div className="w-16 h-16 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-4">
                            <Command size={32} />
                        </div>
                        <CardTitle className="text-2xl font-black text-white uppercase tracking-widest">Federation Command</CardTitle>
                        <CardDescription className="font-mono text-cyan-500/60 text-xs mt-2 uppercase tracking-widest">SECURE UPLINK ESTABLISHED</CardDescription>
                    </CardHeader>

                    <CardContent className="p-8 space-y-6">
                        <form action={action} className="space-y-6">
                            {(state?.error as any)?.root && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-mono mb-4 text-center">
                                    {(state?.error as any).root[0]}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Target Workspace</Label>
                                    <Input
                                        name="slug"
                                        placeholder="workspace-id"
                                        className="bg-slate-900 border-white/5 h-12 font-mono text-cyan-400 placeholder:text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Admin Identifier</Label>
                                    <Input
                                        name="username"
                                        required
                                        className="bg-slate-900 border-white/5 h-12 text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Access Key</Label>
                                    <Input
                                        name="password"
                                        type="password"
                                        required
                                        className="bg-slate-900 border-white/5 h-12 text-white"
                                    />
                                </div>
                            </div>

                            <Button className="w-full h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-widest uppercase transition-all" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin" /> : "Initiate Sequence"}
                            </Button>
                        </form>

                        <div className="text-center pt-4 border-t border-white/5">
                            <a href="/register/business" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors uppercase font-bold tracking-wider block mb-2">
                                Provision New Federation Node
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- VIEW 2: TENANT ORGANIZATION (SPLIT SCREEN) ---
    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Visual Branding */}
            <div className="relative hidden lg:flex flex-col justify-end p-16 bg-[#020617] overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop"
                        alt="Background"
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent" />
                </div>

                <div className="relative z-10 space-y-6">
                    {tenantLogo ? (
                        <img src={tenantLogo} className="w-24 h-24 object-contain rounded-xl bg-white p-2" alt={tenantName} />
                    ) : (
                        <div className="w-20 h-20 bg-emerald-500 text-white flex items-center justify-center text-4xl font-bold rounded-2xl shadow-xl shadow-emerald-500/20">
                            {tenantName.charAt(0)}
                        </div>
                    )}
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-white tracking-tight">{tenantName.toUpperCase()}</h1>
                        <p className="text-slate-400 text-lg max-w-md">Secure enterprise gateway. Authorized personnel only.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono uppercase tracking-widest pt-8">
                        <Globe size={14} className="text-emerald-500" />
                        <span>SaaS Federation Secured</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="flex flex-col items-center justify-center p-8 lg:p-16 bg-[#0f172a] text-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-3xl font-black tracking-tight text-white">Welcome Back</h2>
                        <p className="text-slate-400">Enter your credentials to access the workspace.</p>
                    </div>

                    <form action={action} className="space-y-6">
                        {(state?.error as any)?.root && (
                            <div className="p-4 bg-red-500/10 border-l-4 border-red-500 text-red-400 text-sm font-medium">
                                {(state?.error as any).root[0]}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-slate-500">Username</Label>
                                <Input
                                    name="username"
                                    required
                                    defaultValue={prefilledUsername}
                                    suppressHydrationWarning
                                    className="bg-[#1e293b] border-slate-700 h-14 rounded-lg text-white font-medium focus:ring-emerald-500 focus:border-emerald-500"
                                />
                                {(state?.error as any)?.username && (
                                    <p className="text-xs text-red-500 font-bold mt-1">{(state?.error as any).username[0]}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-slate-500">Password</Label>
                                <Input
                                    name="password"
                                    type="password"
                                    required
                                    suppressHydrationWarning
                                    className="bg-[#1e293b] border-slate-700 h-14 rounded-lg text-white focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>

                            {sites.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-slate-500">Site Location</Label>
                                    <Select name="site_id" defaultValue={sites[0]?.id?.toString()}>
                                        <SelectTrigger className="bg-[#1e293b] border-slate-700 h-14 rounded-lg text-white">
                                            <SelectValue placeholder="Select Base" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                                            {sites.map((s: any) => (
                                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-lg shadow-lg shadow-emerald-900/20 transition-all" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                        </Button>

                        <div className="text-center">
                            <a href="/register/user" className="text-sm font-medium text-emerald-400 hover:underline">Request Access</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}>
            <LoginContent />
        </Suspense>
    );
}
