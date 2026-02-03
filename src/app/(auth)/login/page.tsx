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
    // --- VIEW 1: ROOT DOMAIN -> FIND WORKSPACE (Redirector) ---
    if (isRoot) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />

                <Card className="w-full max-w-md bg-[#0f172a]/80 border-white/5 backdrop-blur-[20px] rounded-[2rem] shadow-2xl relative z-10">
                    <CardHeader className="text-center pt-10 pb-6">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-lg mb-4">
                            W
                        </div>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">Enter Workspace</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">
                            Connect to your organization's dedicated environment
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-10">
                        <form action={action} className="space-y-6">
                            {(state?.error as any)?.root && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-bold text-center">
                                    {(state?.error as any).root[0]}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="slug" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Workspace URL</Label>
                                <div className="relative">
                                    <Input
                                        id="slug"
                                        name="slug"
                                        placeholder="acme"
                                        required
                                        suppressHydrationWarning
                                        className="bg-slate-900/50 border-white/5 h-14 rounded-xl font-mono text-indigo-400 pl-4 pr-32 focus:ring-indigo-500/20"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-mono select-none">
                                        .tsfcloud.com
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-600 pt-1">
                                    Don't have a workspace? <a href="/register/business" className="text-indigo-400 hover:text-indigo-300 font-bold underline">Create one</a>
                                </p>
                            </div>

                            <Button className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98]" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin" /> : "Continue to Workspace"}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="justify-center py-6 border-t border-white/5">
                        <a href="/saas/login" className="text-[10px] text-slate-700 hover:text-cyan-600 font-mono uppercase tracking-widest transition-colors flex items-center gap-2">
                            <SquareTerminal size={12} />
                            Federation Admin Login
                        </a>
                    </CardFooter>
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
