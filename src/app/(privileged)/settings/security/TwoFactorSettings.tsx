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
 } catch (error: unknown) {
 toast.error((error instanceof Error ? error.message : String(error)) || "Failed to start 2FA setup");
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
 } catch (error: unknown) {
 toast.error((error instanceof Error ? error.message : String(error)) || "Invalid token");
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
 } catch (error: unknown) {
 toast.error((error instanceof Error ? error.message : String(error)) || "Failed to disable 2FA. Token might be incorrect.");
 } finally {
 setLoading(false);
 }
 };
 return (
 <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm transition-all overflow-hidden">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex items-center gap-4">
 <div className={`p-4 rounded-2xl ${enabled ? 'bg-app-primary-light text-app-primary' : 'bg-app-warning-bg text-app-warning'}`}>
 {enabled ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
 </div>
 <div>
 <h2 className="text-xl font-black text-app-foreground uppercase tracking-tighter">Two-Factor Authentication</h2>
 <p className="text-xs text-app-muted-foreground font-medium tracking-tight mt-0.5">
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
 className="h-14 px-10 bg-app-surface text-app-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-app-border/20 hover:bg-app-background transition-all"
 >
 {loading ? <Loader2 className="animate-spin" /> : "Initialize 2FA"}
 </Button>
 )}
 {enabled && (
 <Button
 variant="outline"
 onClick={handleDisable}
 disabled={loading}
 className="h-14 px-10 border-app-error/20 text-app-error rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-app-error-bg transition-all"
 >
 {loading ? <Loader2 className="animate-spin" /> : "Disable Protection"}
 </Button>
 )}
 </div>
 {step === 'SETUP' && setupData && (
 <div className="mt-8 p-10 bg-app-background rounded-[2.5rem] border border-app-border animate-in zoom-in-95 duration-500">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
 <div className="space-y-8">
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-app-surface text-app-foreground flex items-center justify-center text-xs font-black">1</div>
 <h3 className="text-md font-black text-app-foreground uppercase tracking-tighter">Scan QR Code</h3>
 </div>
 <p className="text-[11px] text-app-muted-foreground leading-relaxed font-medium pl-11">
 Open your authenticator app (e.g., Google Authenticator, Authy, or Microsoft Authenticator) and scan this QR code.
 </p>
 </div>
 <div className="bg-app-surface p-8 rounded-[2rem] flex justify-center border border-app-border shadow-sm w-fit mx-auto lg:ml-11">
 <QRCodeSVG value={setupData.otp_uri} size={180} />
 </div>
 <div className="space-y-3 pl-11">
 <p className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Manual Setup Key</p>
 <div className="flex items-center gap-2">
 <code className="flex-1 p-4 bg-app-surface rounded-xl text-xs font-mono text-app-muted-foreground border border-app-border">
 {setupData.secret}
 </code>
 </div>
 </div>
 </div>
 <div className="space-y-8">
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-app-surface text-app-foreground flex items-center justify-center text-xs font-black">2</div>
 <h3 className="text-md font-black text-app-foreground uppercase tracking-tighter">Verification</h3>
 </div>
 <p className="text-[11px] text-app-muted-foreground leading-relaxed font-medium pl-11">
 Enter the 6-digit verification code showing in your authenticator app to finalize the link.
 </p>
 </div>
 <div className="space-y-6 pl-11">
 <Input
 placeholder="0 0 0 0 0 0"
 value={token}
 onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
 maxLength={6}
 className="h-20 rounded-[1.5rem] border-app-border text-center text-4xl font-mono tracking-[0.3em] focus:ring-app-primary/10 focus:border-app-primary/50 shadow-inner bg-app-surface"
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
 className="h-16 flex-2 bg-app-primary hover:bg-app-primary text-app-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-app-primary/20 transition-all flex items-center gap-2"
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
