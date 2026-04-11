'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ArrowLeft, Zap, Settings2, Shield } from 'lucide-react';
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

const STEP_META: Record<LobbyStep, { title: string; subtitle: string }> = {
    site: { title: 'Select Branch', subtitle: 'Choose your point of sale location' },
    register: { title: 'Select Register', subtitle: 'Pick the terminal to operate' },
    user: { title: 'Select Cashier', subtitle: 'Who is operating this register?' },
    pin: { title: 'Enter PIN', subtitle: 'Verify your identity to continue' },
    opening: { title: 'Open Session', subtitle: 'Set your opening float and begin' },
};

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

    const meta = STEP_META[step];

    /* ── Loading screen ── */
    if (loading) return (
        <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'var(--app-bg, var(--app-background))' }}>
            <div className="text-center">
                <div className="relative mx-auto mb-6">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                        style={{
                            background: 'linear-gradient(145deg, color-mix(in srgb, var(--app-primary) 15%, var(--app-surface)), color-mix(in srgb, var(--app-primary) 5%, var(--app-surface)))',
                            boxShadow: '0 8px 32px color-mix(in srgb, var(--app-primary) 15%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                    </div>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em]"
                    style={{ color: 'color-mix(in srgb, var(--app-primary) 60%, var(--app-text, var(--app-foreground)))' }}>
                    Initializing Terminal…
                </p>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 flex overflow-hidden"
            style={{ background: 'var(--app-bg, var(--app-background))' }}>

            {/* ── LEFT: Brand Panel ── */}
            <div className="hidden lg:flex w-[38%] xl:w-[35%] shrink-0 flex-col relative"
                style={{
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 4%, var(--app-surface)), color-mix(in srgb, var(--app-primary) 1%, var(--app-bg, var(--app-background))))',
                    borderRight: '1px solid color-mix(in srgb, var(--app-primary) 8%, transparent)',
                }}>
                <BrandPanel />
                {/* Settings link at bottom */}
                <div className="absolute bottom-5 left-0 right-0 flex justify-center z-20">
                    <a href="/sales/pos-settings"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all"
                        style={{
                            color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 40%, transparent)',
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            backdropFilter: 'blur(8px)',
                        }}>
                        <Settings2 size={11} /> POS Settings
                    </a>
                </div>
            </div>

            {/* ── RIGHT: Step Wizard ── */}
            <div className="flex-1 flex flex-col min-h-0 z-10 relative">

                {/* ── Top bar ── */}
                <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    {/* Back button */}
                    <button
                        onClick={goBack}
                        className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all',
                            step !== 'site'
                                ? 'hover:bg-app-surface'
                                : 'invisible'
                        )}
                        style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 50%, transparent)' }}
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    {/* Center: step title */}
                    <div className="text-center">
                        <h2 className="text-[14px] font-black tracking-tight"
                            style={{ color: 'var(--app-text, var(--app-foreground))' }}>
                            {meta.title}
                        </h2>
                        <p className="text-[10px] font-medium"
                            style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 40%, transparent)' }}>
                            {meta.subtitle}
                        </p>
                    </div>

                    {/* Right: mobile POS label */}
                    <div className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        }}>
                        <Zap size={11} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[9px] font-black uppercase tracking-wider"
                            style={{ color: 'var(--app-primary)' }}>POS</span>
                    </div>
                    <div className="hidden lg:block w-16" /> {/* spacer */}
                </header>

                {/* ── Step progress ── */}
                <div className="flex-shrink-0 px-6 pt-4 pb-2">
                    <StepProgress current={step} />
                </div>

                {/* ── Step content (scrollable) ── */}
                <main className="flex-1 flex items-start justify-center px-6 pb-6 overflow-y-auto min-h-0 w-full">
                    <div className="w-full max-w-2xl py-4">
                        {step === 'site' && <SiteStep sites={sites} onSelect={s => { setSelectedSite(s); setStep('register'); }} />}
                        {step === 'register' && selectedSite && <RegisterStep site={selectedSite} onSelect={r => { setSelectedRegister(r); setStep('user'); }} />}
                        {step === 'user' && selectedRegister && <UserStep register={selectedRegister} onSelect={u => { setSelectedCashier(u); setStep('pin'); }} />}
                        {step === 'pin' && selectedRegister && selectedCashier && <PinStep register={selectedRegister} cashier={selectedCashier} onVerified={handlePinVerified} />}
                        {step === 'opening' && selectedRegister && selectedSite && verifiedUser && (
                            <OpeningStep register={selectedRegister} site={selectedSite} verifiedUser={verifiedUser} currency={currency} onEnterPOS={onEnterPOS} />
                        )}
                    </div>
                </main>

                {/* ── Footer ── */}
                <footer className="flex-shrink-0 px-6 py-2.5 flex items-center justify-between"
                    style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--app-success)', boxShadow: '0 0 4px var(--app-success)' }} />
                        <span className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 30%, transparent)' }}>
                            Online
                        </span>
                    </div>
                    <a href="/sales/pos-settings"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all lg:hidden"
                        style={{
                            color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 35%, transparent)',
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                        }}>
                        <Settings2 size={9} /> Settings
                    </a>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <Shield size={9} style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 25%, transparent)' }} />
                            <span className="text-[9px] font-mono"
                                style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 25%, transparent)' }}>
                                v3.2
                            </span>
                        </div>
                        <span className="text-[9px]"
                            style={{ color: 'color-mix(in srgb, var(--app-text, var(--app-foreground)) 20%, transparent)' }}>
                            {new Date().toLocaleDateString()}
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
