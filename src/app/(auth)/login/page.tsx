'use client'

import { useActionState, useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";

const initialState: { error: any; success?: boolean } = {
    error: {},
};

function LoginContent() {
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<any>({ tenant: null }); // Init null to distinguish 'loading' vs 'no tenant'
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
    // If tenant is null/empty object after loading (config usually returns empty tenant obj if root), check logic
    // Backend returns "tenant": {} if no tenant context.
    const isRoot = !tenant || !tenant.name;

    const tenantName = tenant?.name || "TSF Cloud";
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/5 blur-[160px] rounded-full" />

            <Card className="w-full max-w-md bg-[#0f172a]/60 border-white/5 backdrop-blur-[40px] rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                <CardHeader className="text-center pt-10 pb-6">
                    {tenantLogo ? (
                        <div className="flex justify-center mb-6">
                            <img src={tenantLogo} alt="Logo" className="h-16 object-contain drop-shadow-2xl" />
                        </div>
                    ) : (
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
                                V
                            </div>
                        </div>
                    )}
                    <CardTitle className="text-2xl font-black text-white tracking-tight">{tenantName}</CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                        {isRoot ? "Uplink coordinates required" : "Command authorization required"}
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-8 pb-10">
                    <form action={action} className="space-y-5">
                        {(state?.error as any)?.root && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in zoom-in-95">
                                <AlertCircle size={16} />
                                {(state?.error as any).root[0]}
                            </div>
                        )}

                        {isRoot && (
                            <div className="space-y-2">
                                <Label htmlFor="slug" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Workspace Designation</Label>
                                <Input
                                    id="slug"
                                    name="slug"
                                    placeholder="acme"
                                    required
                                    suppressHydrationWarning
                                    className="bg-slate-900/50 border-white/5 h-14 rounded-xl font-mono text-amber-400 focus:ring-amber-500/20"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Personnel ID</Label>
                            <Input
                                id="username"
                                name="username"
                                placeholder="e.g. j.smith"
                                required
                                defaultValue={prefilledUsername}
                                suppressHydrationWarning
                                className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold focus:ring-emerald-500/20"
                            />
                            {(state?.error as any)?.username && (
                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state?.error as any).username[0]}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Security Key</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                suppressHydrationWarning
                                className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white focus:ring-emerald-500/20"
                            />
                            {(state?.error as any)?.password && (
                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state?.error as any).password[0]}</p>
                            )}
                        </div>

                        {sites.length > 0 && !isRoot && (
                            <div className="space-y-2">
                                <Label htmlFor="site" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Operational Base</Label>
                                <Select name="site_id" defaultValue={sites[0]?.id?.toString()}>
                                    <SelectTrigger className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium">
                                        <SelectValue placeholder="Select Base" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                                        {sites.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Button type="submit" suppressHydrationWarning className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : (isRoot ? "Resolve Instance" : "Establish Link")}
                        </Button>

                        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                            <a href="/register/user" className="text-[10px] text-slate-400 hover:text-emerald-400 uppercase font-black tracking-widest text-center transition-colors">
                                Access Request Protocol
                            </a>
                            {isRoot && (
                                <a href="/register/business" className="text-[10px] text-slate-600 hover:text-amber-400 uppercase font-black tracking-widest text-center transition-colors">
                                    New Organization Provisioning
                                </a>
                            )}
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="bg-black/20 py-4 justify-center">
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck size={12} className="text-emerald-500/50" />
                        Encrypted Connection Secured
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
            <Suspense fallback={<Loader2 className="animate-spin" />}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
