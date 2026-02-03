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

    const [subdomain, setSubdomain] = useState("");

    useEffect(() => {
        getPublicConfig().then(setConfig);
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            const parts = host.split('.');
            if (host.includes("localhost")) {
                if (parts.length > 1) setSubdomain(parts[0]);
            } else {
                if (parts.length > 2) setSubdomain(parts[0]);
            }
        }
    }, []);

    const tenant = config.tenant;
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    // --- UNIFIED VIEW (SPLIT SCREEN) ---
    // Calculate display values based on context
    const isSaaS = subdomain === 'saas' || tenant?.slug === 'saas' || tenant?.name === 'SaaS Federation';
    const isRoot = (!tenant || !tenant.name) && !isSaaS;

    const displayTitle = isSaaS ? "SaaS FEDERATION" : (isRoot ? "TSF CLOUD" : (tenant?.name || "TSF Cloud").toUpperCase());
    const displaySubtitle = isSaaS
        ? "Global infrastructure management & orchestration."
        : (isRoot
            ? "Enterprise Resource Federation Platform"
            : "Secure enterprise gateway. Authorized personnel only.");

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
                        <img src={tenantLogo} className="w-24 h-24 object-contain rounded-xl bg-white p-2" alt={displayTitle} />
                    ) : (
                        <div className="w-20 h-20 bg-emerald-500 text-white flex items-center justify-center text-4xl font-bold rounded-2xl shadow-xl shadow-emerald-500/20">
                            {displayTitle.charAt(0)}
                        </div>
                    )}
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-white tracking-tight">{displayTitle}</h1>
                        <p className="text-slate-400 text-lg max-w-md">{displaySubtitle}</p>
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
                            {/* If Root, show Workspace Slug Input */}
                            {isRoot && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-slate-500">Workspace</Label>
                                    <div className="relative">
                                        <Input
                                            id="slug"
                                            name="slug"
                                            placeholder="acme"
                                            required
                                            suppressHydrationWarning
                                            className="bg-[#1e293b] border-slate-700 h-14 rounded-lg text-white font-mono pl-4 pr-32 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono select-none">
                                            .tsfcloud
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-600">
                                        Don't have a workspace? <a href="/register/business" className="text-emerald-400 hover:text-emerald-300 font-bold underline">Create one</a>
                                    </p>
                                </div>
                            )}

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

                            {!isRoot && sites.length > 0 && (
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
                            {isPending ? <Loader2 className="animate-spin" /> : (isRoot ? "Continue" : "Sign In")}
                        </Button>

                        {!isRoot && (
                            <div className="text-center">
                                <a href="/register/user" className="text-sm font-medium text-emerald-400 hover:underline">Request Access</a>
                            </div>
                        )}

                        {isRoot && (
                            <div className="text-center pt-4">
                                <a href="/saas/login" className="text-[10px] text-slate-600 hover:text-emerald-500 font-mono uppercase tracking-widest flex items-center justify-center gap-2">
                                    <SquareTerminal size={12} />
                                    Federation Admin Login
                                </a>
                            </div>
                        )}
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
