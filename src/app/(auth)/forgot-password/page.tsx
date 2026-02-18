'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await requestPasswordResetAction(email);
            setSubmitted(true);
            toast.success("Instructions sent!");
        } catch (error: any) {
            toast.error(error.message || "Failed to send reset instructions");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/5 text-center">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="text-emerald-400" size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Check your email</h1>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            We've sent password reset instructions to <span className="font-bold text-white">{email}</span>.
                        </p>
                        <Button asChild variant="outline" className="w-full rounded-2xl h-12 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                            <Link href="/login">
                                <ArrowLeft className="mr-2" size={18} />
                                Back to Login
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/5">
                    <div className="mb-8 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="text-slate-400" size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Forgot Password?</h1>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">No worries, we'll send you reset instructions</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-500 px-1 tracking-widest">Email Address</Label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-12 h-14 rounded-2xl border-white/5 bg-slate-950/50 text-white focus:bg-slate-950 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-slate-700"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all group"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                "Send Instructions"
                            )}
                        </Button>

                        <div className="text-center pt-2">
                            <Link
                                href="/login"
                                className="inline-flex items-center text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 transition-colors tracking-widest"
                            >
                                <ArrowLeft className="mr-2" size={14} />
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
