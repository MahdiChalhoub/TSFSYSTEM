"use client"

import { useState, useActionState, useEffect } from "react";
import { registerUserAction, getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, UserPlus, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/saas_config";
import { PasswordStrength } from "@/components/ui/password-strength";

export default function UserRegisterPage() {
    const [state, action, isPending] = useActionState(registerUserAction, null);
    const [config, setConfig] = useState<any>({ tenant: { roles: [] } });
    const [passwordValue, setPasswordValue] = useState('');

    useEffect(() => {
        getPublicConfig().then(setConfig);
    }, []);

    const tenantName = config.tenant?.name || PLATFORM_CONFIG.name;
    const roles = config.tenant?.roles || [];
    const tenantLogo = config.tenant?.logo;

    if (state?.success) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />
                <Card className="w-full max-w-md bg-[#0f172a]/60 border-emerald-500/20 backdrop-blur-[40px] rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
                    <CardHeader className="text-center pt-10 pb-6">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <CheckCircle2 size={32} />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-black text-white tracking-tight italic">REGISTRATION SUBMITTED</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">Your account has been created.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-6 pb-10">
                        <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10">
                            <p className="text-amber-400 font-black text-xs uppercase tracking-[0.2em] mb-2">Pending Authorization</p>
                            <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                An administrator must approve your account before you can log in.
                            </p>
                        </div>
                        <Button className="w-full h-14 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all" onClick={() => window.location.href = '/login'}>
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 py-20 relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 blur-[160px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />


            <div className="text-center mb-12 space-y-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/5 border border-cyan-500/10 rounded-full text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-2 backdrop-blur-md">
                    <Sparkles size={12} className="animate-pulse" />
                    New Employee Registration
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter italic">
                    JOIN <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-emerald-400 not-italic">{tenantName.toUpperCase()}</span>
                </h1>
                <p className="text-slate-500 max-w-md mx-auto text-sm font-medium">
                    Create your employee profile to join the team.
                </p>
            </div>

            <Card className="w-full max-w-lg bg-[#0f172a]/60 border-white/5 backdrop-blur-[40px] rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

                <CardHeader className="pt-10 px-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-white tracking-tight uppercase italic">Employee Registration</CardTitle>
                            <CardDescription className="text-slate-500 font-medium tracking-tight">Fill in your details below</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-10">
                    <form action={action} className="space-y-6">
                        {(state?.error as any)?.root && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in zoom-in-95">
                                <AlertCircle size={16} />
                                {(state?.error as any).root}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name" className="text-[10px] uppercase tracking-widest font-black text-slate-500">First Name</Label>
                                <Input id="first_name" name="first_name" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Last Name</Label>
                                <Input id="last_name" name="last_name" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-bold" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Email</Label>
                            <Input id="email" name="email" type="email" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium" />
                            {(state as any)?.error?.email && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.email}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Username</Label>
                                <Input id="username" name="username" required className="bg-slate-900/50 border-white/5 h-14 rounded-xl font-mono text-cyan-400" />
                                {(state as any)?.error?.username && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.username}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="password" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Password</Label>
                                <Input id="password" name="password" type="password" required value={passwordValue} onChange={(e) => setPasswordValue(e.target.value)} className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white" />
                                <PasswordStrength password={passwordValue} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Role</Label>
                            <Select name="role_id" required>
                                <SelectTrigger className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                    {roles.length > 0 ? (
                                        roles.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id.toString()}>
                                                {r.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="0" disabled>No roles available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {(state as any)?.error?.role_id && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{(state as any).error.role_id}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Phone</Label>
                                <Input id="phone" name="phone" className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dob" className="text-[10px] uppercase tracking-widest font-black text-slate-500">Date of Birth</Label>
                                <Input id="dob" name="date_of_birth" type="date" className="bg-slate-900/50 border-white/5 h-14 rounded-xl text-white font-medium" />
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-16 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98]" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : (
                                <div className="flex items-center gap-2">
                                    Submit Registration <ArrowRight size={18} />
                                </div>
                            )}
                        </Button>

                        <div className="text-center pt-4 border-t border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Already registered? </span>
                            <a href="/login" className="text-[10px] text-cyan-400 hover:text-white uppercase font-black tracking-widest transition-colors">Log In</a>
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="bg-black/20 py-4 justify-center">
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck size={12} className="text-cyan-500/50" />
                        Infrastructure Secured by {PLATFORM_CONFIG.federation_name}
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
