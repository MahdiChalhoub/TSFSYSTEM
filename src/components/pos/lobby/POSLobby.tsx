'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ArrowLeft, Zap, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

import type { Site, Register, RegisterUser, POSLobbyProps, LobbyStep } from './types';
import { StepProgress } from './steps/StepProgress';
import { BrandPanel } from './steps/BrandPanel';
import { SiteStep } from './steps/SiteStep';
import { RegisterStep } from './steps/RegisterStep';
import { UserStep } from './steps/UserStep';
import { PinStep } from './steps/PinStep';
import { OpeningStep } from './steps/OpeningStep';

export default function POSLobby({ currency, onEnterPOS }: POSLobbyProps) {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<LobbyStep>('site');
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
    const [selectedCashier, setSelectedCashier] = useState<RegisterUser | null>(null);
    const [verifiedUser, setVerifiedUser] = useState<{ id: number; name: string; username: string } | null>(null);

    const loadLobby = useCallback(async () => {
        setLoading(true);
        try {
            const { getPosLobby } = await import('@/components/pos/register-actions');
            const result = await getPosLobby();
            if (result.success && result.data) {
                setSites(result.data);
                if (result.data.length === 1) { setSelectedSite(result.data[0]); setStep('register'); }
            } else { toast.error(result.error || 'Failed to load lobby'); }
        } catch { toast.error('Failed to connect'); }
        setLoading(false);
    }, []);

    useEffect(() => { loadLobby(); }, [loadLobby]);

    const goBack = useCallback(() => {
        if (step === 'opening') { setStep('pin'); setVerifiedUser(null); }
        else if (step === 'pin') { setStep('user'); setSelectedCashier(null); }
        else if (step === 'user') { setStep('register'); setSelectedRegister(null); }
        else if (step === 'register') { setStep('site'); setSelectedSite(null); }
    }, [step]);

    const handlePinVerified = useCallback((user: { id: number; name: string; username: string }) => {
        setVerifiedUser(user);
        if (selectedRegister?.isOpen && selectedRegister.currentSession?.cashierId === user.id) {
            onEnterPOS({ registerId: selectedRegister.id, registerName: selectedRegister.name, sessionId: selectedRegister.currentSession!.id, cashierId: user.id, cashierName: user.name, warehouseId: selectedRegister.warehouseId, cashAccountId: selectedRegister.cashAccountId, allowedAccounts: selectedRegister.allowedAccounts || [], siteName: selectedSite?.name || '', paymentMethods: selectedRegister.paymentMethods || [] });
        } else { setStep('opening'); }
    }, [selectedRegister, selectedSite, onEnterPOS]);

    /* ── Loading screen ── */
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-app-bg">
            <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]">
                    <Loader2 size={28} className="animate-spin text-[var(--app-primary)]" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.3em] text-[var(--app-primary)]/50">Loading Registers...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex overflow-hidden bg-app-bg">
            {/* Dot grid overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

            {/* ── LEFT: Brand Panel ── */}
            <div className="hidden lg:flex w-[35%] shrink-0 flex-col relative border-r border-[var(--app-primary-strong)]/10 bg-[var(--app-surface-2)]">
                <BrandPanel />
                {/* Settings link at bottom */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
                    <a href="/sales/pos-settings" className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all text-[var(--app-text-muted)] bg-[var(--app-surface-hover)] border border-[var(--app-border)]">
                        <Settings2 size={13} /> POS Settings
                    </a>
                </div>
            </div>

            {/* ── RIGHT: Step Wizard ── */}
            <div className="flex-1 flex flex-col min-h-screen z-10 relative">
                {/* Step header */}
                <header className="px-6 pt-8 pb-0 flex items-center justify-between">
                    <button
                        onClick={goBack}
                        className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all', step !== 'site' ? 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]' : 'invisible')}
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="lg:hidden flex items-center gap-2 text-xs font-bold text-[var(--app-primary)]/70">
                        <Zap size={14} /> POS Terminal
                    </div>
                    <div className="w-20" /> {/* spacer */}
                </header>

                {/* Step progress */}
                <div className="px-6 pt-6">
                    <StepProgress current={step} />
                </div>

                {/* Step content */}
                <main className="flex-1 flex items-start justify-center px-6 pb-10 overflow-y-auto w-full">
                    {step === 'site' && <SiteStep sites={sites} onSelect={s => { setSelectedSite(s); setStep('register'); }} />}
                    {step === 'register' && selectedSite && <RegisterStep site={selectedSite} onSelect={r => { setSelectedRegister(r); setStep('user'); }} />}
                    {step === 'user' && selectedRegister && <UserStep register={selectedRegister} onSelect={u => { setSelectedCashier(u); setStep('pin'); }} />}
                    {step === 'pin' && selectedRegister && selectedCashier && <PinStep register={selectedRegister} cashier={selectedCashier} onVerified={handlePinVerified} />}
                    {step === 'opening' && selectedRegister && selectedSite && verifiedUser && (
                        <OpeningStep register={selectedRegister} site={selectedSite} verifiedUser={verifiedUser} currency={currency} onEnterPOS={onEnterPOS} />
                    )}
                </main>

                {/* Footer */}
                <footer className="px-6 py-3 flex items-center justify-between border-t border-[var(--app-border)]">
                    <p className="text-[10px] font-mono text-[var(--app-text-faint)]">POS v3.1</p>
                    <a href="/sales/pos-settings" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-[var(--app-text-muted)] bg-[var(--app-surface-hover)] border border-[var(--app-border)] lg:hidden">
                        <Settings2 size={10} /> POS Settings
                    </a>
                    <p className="text-[10px] text-[var(--app-text-faint)]">{new Date().toLocaleDateString()}</p>
                </footer>
            </div>
        </div>
    );
}
