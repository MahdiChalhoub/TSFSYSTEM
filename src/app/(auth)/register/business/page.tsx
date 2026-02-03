"use client"

import { useState, useActionState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { registerBusinessAction, getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Building2, ShieldCheck, Sparkles, ArrowRight, CheckCircle2, Globe, Rocket } from "lucide-react";

const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

function BusinessRegisterContent() {
    const searchParams = useSearchParams();
    const [state, action, isPending] = useActionState(registerBusinessAction, null);
    const [config, setConfig] = useState<any>({ business_types: [], currencies: [] });
    const [businessName, setBusinessName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    useEffect(() => {
        getPublicConfig().then(setConfig);

        const initialSlug = searchParams.get('slug');
        const initialName = searchParams.get('name');

        if (initialSlug) {
            setSlug(initialSlug);
            setSlugManuallyEdited(true);
        }
        if (initialName) {
            setBusinessName(initialName);
        }
    }, [searchParams]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setBusinessName(name);
        if (!slugManuallyEdited) {
            setSlug(slugify(name));
        }
    };

    if (state?.success && state?.login_url) {
        window.location.href = state.login_url;
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/5 blur-[160px] rounded-full" />
                <Card className="w-full max-w-md bg-[#0f172a]/60 border-emerald-500/20 backdrop-blur-[40px] rounded-[2.5rem] text-center p-12 relative z-10 transition-all duration-1000">
                    <Rocket className="mx-auto text-emerald-400 mb-6 animate-bounce" size={48} />
                    <h2 className="text-3xl font-black text-white tracking-tighter italic mb-4">FEDERATION ESTABLISHED</h2>
                    <p className="text-slate-400 font-medium mb-8">Provisioning your strategic infrastructure. Stand by for redirection.</p>
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 py-20 relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 blur-[160px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none" />

            <div className="text-center mb-16 space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-4 backdrop-blur-xl">
                    <Sparkles size={14} className="animate-pulse" />
                    New Federation Provisioning
                </div>
                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter italic">
                    FOUND A <span className="text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-emerald-400 not-italic">BUSINESS</span>
                </h1>
                <p className="text-slate-500 max-w-lg mx-auto text-sm md:text-lg font-medium">
                    Initialize your autonomous enterprise ecosystem with built-in multi-tenant isolation.
                </p>
            </div>

            <Card className="w-full max-w-4xl bg-[#0f172a]/60 border-white/5 backdrop-blur-[40px] rounded-[3rem] overflow-hidden shadow-2xl relative z-10">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

                <CardContent className="p-10 md:p-16">
                    <form action={action} className="space-y-12">
                        {(state as any)?.error?.root && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in zoom-in-95">
                                <AlertCircle size={16} />
                                {(state as any).error.root}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Business Infrastructure */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                        <Building2 size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-white italic tracking-tight uppercase">Infrastructure Details</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Business Designation</Label>
                                        <Input
                                            name="business_name"
                                            required
                                            placeholder="e.g. Acme Corp"
                                            value={businessName}
                                            onChange={handleNameChange}
                                            className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold"
                                        />
                                        {(state as any)?.error?.business_name && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.business_name}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Workspace Slug (URL)</Label>
                                        <div className="flex items-center gap-2 group">
                                            <div className="bg-slate-900 border border-white/5 h-14 rounded-xl flex items-center px-4 font-mono text-[10px] text-slate-500">https://</div>
                                            <Input
                                                name="slug"
                                                required
                                                placeholder="acme-corp"
                                                value={slug}
                                                onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
                                                className="bg-slate-900/50 border-white/5 h-14 rounded-xl font-mono text-amber-400 text-sm flex-1"
                                            />
                                            <div className="bg-slate-900 border border-white/5 h-14 rounded-xl flex items-center px-4 font-mono text-[10px] text-slate-500">.tsf.os</div>
                                        </div>
                                        {(state as any)?.error?.slug && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.slug}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Industry Vector</Label>
                                            <Select name="business_type_id" required>
                                                <SelectTrigger className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                                    {config.business_types.map((t: any) => (
                                                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Base Currency</Label>
                                            <Select name="currency_id" required defaultValue="1">
                                                <SelectTrigger className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium">
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                                    {config.currencies.map((c: any) => (
                                                        <SelectItem key={c.id} value={c.id.toString()}>{c.code}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Contact Uplink (Email)</Label>
                                        <Input name="email" type="email" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium" />
                                    </div>
                                </div>
                            </div>

                            {/* Super Admin Configuration */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <h3 className="text-lg font-black text-white italic tracking-tight uppercase">Admin Authorization</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Admin First Name</Label>
                                            <Input name="admin_first_name" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Admin Last Name</Label>
                                            <Input name="admin_last_name" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Admin Login ID</Label>
                                        <Input name="admin_username" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl font-mono text-cyan-400" />
                                        {(state as any)?.error?.admin_username && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.admin_username}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Master Security Key</Label>
                                        <Input name="admin_password" type="password" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Master Admin Email</Label>
                                        <Input name="admin_email" type="email" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium" />
                                        {(state as any)?.error?.admin_email && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.admin_email}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8">
                            <Button type="submit" className="w-full h-20 bg-amber-600 hover:bg-amber-500 text-white font-black text-xl rounded-2xl shadow-2xl shadow-amber-900/40 transition-all active:scale-[0.98] group" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin" /> : (
                                    <div className="flex items-center gap-3">
                                        Initialize Enterprise Provisioning <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                                    </div>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="bg-black/40 py-8 justify-center border-t border-white/5">
                    <div className="grid grid-cols-3 gap-12 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                        <div className="flex items-center gap-2"><Globe size={14} className="text-amber-500" /> Multi-Tenant</div>
                        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-500" /> Isolated DB</div>
                        <div className="flex items-center gap-2"><Sparkles size={14} className="text-cyan-500" /> Auto-Scaling</div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function BusinessRegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="animate-spin text-amber-500 h-12 w-12" />
            </div>
        }>
            <BusinessRegisterContent />
        </Suspense>
    );
}
