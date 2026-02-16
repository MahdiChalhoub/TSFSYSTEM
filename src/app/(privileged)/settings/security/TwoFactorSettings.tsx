'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, QrCode, CheckCircle2, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setup2FAAction, verify2FAAction, disable2FAAction } from '@/app/actions/auth';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export function TwoFactorSettings({ initialEnabled }: { initialEnabled: boolean }) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [step, setStep] = useState<'IDLE' | 'SETUP'>('IDLE');
    const [setupData, setSetupData] = useState<{ secret: string, otp_uri: string } | null>(null);
    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);

    const handleStartSetup = async () => {
        setLoading(true);
        try {
            const res = await setup2FAAction();
            setSetupData(res);
            setStep('SETUP');
            toast.info("Authenticator setup initiated");
        } catch (error: any) {
            toast.error(error.message || "Failed to start 2FA setup");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!token) return;
        setLoading(true);
        try {
            await verify2FAAction(token);
            setEnabled(true);
            setStep('IDLE');
            setToken("");
            toast.success("Two-factor authentication enabled!");
        } catch (error: any) {
            toast.error(error.message || "Invalid token");
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async () => {
        const confirmToken = prompt("Please enter a verification code from your device to disable 2FA:");
        if (!confirmToken) return;

        setLoading(true);
        try {
            await disable2FAAction(confirmToken);
            setEnabled(false);
            toast.success("Two-factor authentication disabled");
        } catch (error: any) {
            toast.error(error.message || "Failed to disable 2FA. Token might be incorrect.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm transition-all overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {enabled ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Two-Factor Authentication</h2>
                        <p className="text-xs text-gray-400 font-medium tracking-tight mt-0.5">
                            {enabled
                                ? "Your account is prioritized with an additional security layer."
                                : "Strengthen your account security by requiring a code during login."}
                        </p>
                    </div>
                </div>

                {!enabled && step === 'IDLE' && (
                    <Button
                        onClick={handleStartSetup}
                        disabled={loading}
                        className="h-14 px-10 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Initialize 2FA"}
                    </Button>
                )}

                {enabled && (
                    <Button
                        variant="outline"
                        onClick={handleDisable}
                        disabled={loading}
                        className="h-14 px-10 border-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Disable Protection"}
                    </Button>
                )}
            </div>

            {step === 'SETUP' && setupData && (
                <div className="mt-8 p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 animate-in zoom-in-95 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">1</div>
                                    <h3 className="text-md font-black text-gray-900 uppercase tracking-tighter">Scan QR Code</h3>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-medium pl-11">
                                    Open your authenticator app (e.g., Google Authenticator, Authy, or Microsoft Authenticator) and scan this QR code.
                                </p>
                            </div>

                            <div className="bg-white p-8 rounded-[2rem] flex justify-center border border-gray-100 shadow-sm w-fit mx-auto lg:ml-11">
                                <QRCodeSVG value={setupData.otp_uri} size={180} />
                            </div>

                            <div className="space-y-3 pl-11">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Manual Setup Key</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-4 bg-white rounded-xl text-xs font-mono text-gray-600 border border-gray-100">
                                        {setupData.secret}
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">2</div>
                                    <h3 className="text-md font-black text-gray-900 uppercase tracking-tighter">Verification</h3>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-medium pl-11">
                                    Enter the 6-digit verification code showing in your authenticator app to finalize the link.
                                </p>
                            </div>

                            <div className="space-y-6 pl-11">
                                <Input
                                    placeholder="0 0 0 0 0 0"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                                    maxLength={6}
                                    className="h-20 rounded-[1.5rem] border-gray-200 text-center text-4xl font-mono tracking-[0.3em] focus:ring-emerald-500/10 focus:border-emerald-500/50 shadow-inner bg-white"
                                />
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep('IDLE')}
                                        className="h-16 flex-1 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                    >
                                        Abort
                                    </Button>
                                    <Button
                                        onClick={handleVerify}
                                        disabled={loading || token.length < 6}
                                        className="h-16 flex-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 transition-all flex items-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Lock size={16} />}
                                        Verify & Activate
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
