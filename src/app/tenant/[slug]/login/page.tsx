'use client'

import { useActionState, useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { PublicConfig } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Building2, Globe } from "lucide-react";
import { useDynamicBranding } from "@/lib/saas_config";

const initialState: { error: Record<string, unknown>; success?: boolean } = {
    error: {},
};

function TenantLoginContent() {
    const params = useParams();
    const slug = params.slug as string;
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<PublicConfig>({ tenant: null });
    const branding = useDynamicBranding();

    useEffect(() => {
        // Fetch config for this specific tenant to get logo/name
        getPublicConfig().then(setConfig).catch(() => { });
    }, [slug]);

    const tenant = config.tenant;
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    const displayTitle = (tenant?.name || slug).toUpperCase();
    const displaySubtitle = "Secure enterprise gateway. Authorized personnel only.";

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
                        <span>Platform Secured</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="flex flex-col items-center justify-center p-8 lg:p-16 bg-[#0f172a] text-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-3xl font-black tracking-tight text-white">Sign In</h2>
                        <p className="text-slate-400">Enter your credentials to access <b>{tenant?.name || slug}</b>.</p>
                    </div>

                    <form action={action} className="space-y-6">
                        {(state?.error as any)?.root && (
                            <div className="p-4 bg-red-500/10 border-l-4 border-red-500 text-red-400 text-sm font-medium">
                                {(state?.error as any).root[0]}
                            </div>
                        )}

                        {/* Hidden slug field from URL path */}
                        <input type="hidden" name="slug" value={slug} />

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
                                </div>
                                <input type="hidden" name="challenge_id" defaultValue={(state as any).challenge_id} />
                                <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-lg shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-tighter" disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin" /> : "Verify"}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-slate-500">Username</Label>
                                    <Input
                                        name="username"
                                        required
                                        className="bg-[#1e293b] border-slate-700 h-14 rounded-lg text-white font-medium focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-slate-500">Password</Label>
                                    <Input
                                        name="password"
                                        type="password"
                                        required
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
                                <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-lg shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-tighter" disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                                </Button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function TenantLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}>
            <TenantLoginContent />
        </Suspense>
    );
}
