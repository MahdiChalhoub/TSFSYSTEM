'use client'

import { useActionState, useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { PublicConfig } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, ShieldCheck, SquareTerminal, Command, Building2, Globe } from "lucide-react";
import { PLATFORM_CONFIG, useDynamicBranding } from "@/lib/saas_config";

const initialState: { error: Record<string, unknown>; success?: boolean } = {
    error: {},
};

function LoginContent() {
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<PublicConfig>({ tenant: null });
    const searchParams = useSearchParams();
    const branding = useDynamicBranding();

    const prefilledUsername = "";

    const [subdomain, setSubdomain] = useState("");

    useEffect(() => {
        getPublicConfig().then(setConfig).catch(() => { });
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            const parts = host.split('.');
            if (host.includes("localhost")) {
                if (parts.length > 1) setSubdomain(parts[0]);
            } else {
                if (parts.length > 2) setSubdomain(parts[0]);
            }

            // --- Already logged in check ---
            // If the user has a valid session, send them straight to the dashboard.
            // This prevents the "I see the login form but I'm actually logged in" state.
            import("@/app/actions/auth").then(({ meAction }) => {
                meAction().then((user: any) => {
                    if (user && user.id) {
                        window.location.href = "/dashboard";
                    }
                }).catch(() => { /* No session, stay on login */ });
            });
        }
    }, []);

    const tenant = config.tenant;
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    // --- Deterministic context detection based on hostname ---
    // isRoot = on bare root domain (pos.tsf.ci, tsf.ci, localhost:3000) with no subdomain
    // isSaaS = on saas.tsf.ci or saas.localhost:3000
    const isSaaS = subdomain === 'saas' || tenant?.slug === 'saas';
    const isRoot = !subdomain && !isSaaS;

    const displayTitle = isSaaS ? "SAAS CONTROL" : (isRoot ? PLATFORM_CONFIG.name.toUpperCase() : (tenant?.name || PLATFORM_CONFIG.name).toUpperCase());
    const displaySubtitle = isSaaS
        ? "Global infrastructure management & orchestration."
        : (isRoot
            ? PLATFORM_CONFIG.tagline
            : "Secure enterprise gateway. Authorized personnel only.");

    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Visual Branding */}
            <div className="relative hidden lg:flex flex-col justify-end p-16 bg-app-bg overflow-hidden border-r border-app-border">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop"
                        alt="Background"
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-app-bg via-transparent to-transparent" />
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
                        <span>Platform Secured</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="flex flex-col items-center justify-center p-8 lg:p-16 bg-app-surface text-app-foreground">
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

                        {state?.two_factor_required ? (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="p-4 bg-emerald-500/10 border-l-4 border-emerald-500 text-emerald-400 text-sm font-medium flex items-center gap-3">
                                    <ShieldCheck size={20} />
                                    {state.message}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-slate-500">Verification Code</Label>
                                    <Input
                                        name="otp_token"
                                        placeholder="000 000"
                                        required
                                        autoFocus
                                        className="bg-[#1e293b] border-slate-700 h-16 rounded-lg text-white font-mono text-center text-3xl tracking-[0.2em] focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <p className="text-[10px] text-slate-500 uppercase font-black text-center mt-2">Enter the verification code from your device</p>
                                </div>

                                {/* Server-side 2FA challenge — no passwords in DOM */}
                                <input type="hidden" name="challenge_id" defaultValue={(state as any).challenge_id} />
                                {isRoot && <input type="hidden" name="slug" defaultValue={(state as any)._slug} />}

                                <Button className="w-full h-14 bg-app-primary hover:brightness-110 text-white font-black text-lg rounded-lg shadow-lg transition-all uppercase tracking-tighter" style={{ boxShadow: '0 4px 12px var(--app-primary-glow)' }} disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin" /> : "Verify"}
                                </Button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => window.location.reload()}
                                        className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                                    >
                                        Cancel & Restart
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
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
                                                    defaultValue={searchParams.get('slug') || ''}
                                                    suppressHydrationWarning
                                                    className="bg-app-surface-2 border-app-border h-14 rounded-lg text-app-foreground font-mono pl-4 pr-32 focus:ring-app-primary focus:border-app-primary"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono select-none">
                                                    {branding.suffix}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">
                                                Don't have a workspace? <a href="/register/business" className="text-emerald-400 hover:text-emerald-300 font-black underline">Create one</a>
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
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs uppercase font-bold text-slate-500">Password</Label>
                                            <a href="/forgot-password" className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 transition-colors">
                                                Forgot?
                                            </a>
                                        </div>
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
                                                    {sites.map((s: Record<string, any>) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <Button className="w-full h-14 bg-app-primary hover:brightness-110 text-white font-black text-lg rounded-lg shadow-lg transition-all uppercase tracking-tighter" style={{ boxShadow: '0 4px 12px var(--app-primary-glow)' }} disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin" /> : (isRoot ? "Continue" : "Sign In")}
                                </Button>
                            </>
                        )}

                        {!isRoot && (
                            <div className="space-y-3 pt-2 border-t border-app-border">
                                <a href="/register/business">
                                    <Button variant="outline" className="w-full h-12 border-app-primary/30 bg-app-primary/10 text-app-primary hover:bg-app-primary/20 hover:text-app-primary-dark font-bold uppercase tracking-tight text-sm">
                                        <Building2 size={16} className="mr-2" />
                                        Register My Business
                                    </Button>
                                </a>
                                <p className="text-center text-[10px] text-app-muted-foreground">
                                    Need access to an existing business?{' '}
                                    <a href="/register/user" className="text-app-primary hover:text-emerald-300 font-bold underline">Request Employee Access</a>
                                </p>
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
        <Suspense fallback={<div className="min-h-screen bg-app-bg flex items-center justify-center"><Loader2 className="animate-spin text-app-foreground" /></div>}>
            <LoginContent />
        </Suspense>
    );
}
