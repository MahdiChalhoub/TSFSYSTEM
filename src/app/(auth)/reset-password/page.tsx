'use client'

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { confirmPasswordResetAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [uid, setUid] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const u = searchParams.get('uid');
        const t = searchParams.get('token');
        if (u) setUid(u);
        if (t) setToken(t);
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            await confirmPasswordResetAction({
                uid,
                token,
                new_password: newPassword
            });
            setSuccess(true);
            toast.success("Password reset successfully!");
            setTimeout(() => router.push('/login'), 3000);
        } catch (error: any) {
            toast.error(error.message || "Failed to reset password. Link may be expired.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="text-emerald-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">Password Updated!</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Your password has been changed successfully. Redirecting you to login...
                        </p>
                        <Button asChild className="w-full h-12 bg-gray-900 rounded-2xl">
                            <Link href="/login">Login Now</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!uid || !token) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="text-red-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">Invalid Link</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            The password reset link is missing required parameters or is invalid.
                        </p>
                        <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-gray-200">
                            <Link href="/forgot-password">Request New Link</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100">
                    <div className="mb-8 text-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="text-emerald-600" size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">New Password</h1>
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Enter your new secure password</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-gray-400 px-1 tracking-widest">New Password</Label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-gray-400 px-1 tracking-widest">Confirm Password</Label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all group"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                "Reset Password"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
