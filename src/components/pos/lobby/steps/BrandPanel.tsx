'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';

export function BrandPanel() {
    const [orgName, setOrgName] = useState('');
    const [orgLogo, setOrgLogo] = useState('');
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const tick = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        erpFetch('auth/me/')
            .then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    setOrgName(data.organization?.name || data.org_name || data.name || '');
                    setOrgLogo(data.organization?.logo || data.logo || '');
                }
            })
            .catch(() => { });
    }, []);

    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const ss = time.getSeconds().toString().padStart(2, '0');
    const dateStr = time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col items-center justify-center h-full p-10 relative">
            {/* Glow rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 rounded-full border border-[var(--app-primary-strong)]/10 animate-pulse" />
                <div className="absolute w-48 h-48 rounded-full border border-[var(--app-primary-strong)]/10" />
            </div>

            <div className="relative z-10 text-center">
                {/* Logo / icon */}
                {orgLogo ? (
                    <img src={orgLogo} alt={orgName} className="w-20 h-20 rounded-2xl object-contain mx-auto mb-6 shadow-2xl shadow-[var(--app-primary-glow)]" />
                ) : (
                    <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-[var(--app-primary-glow)] bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/30">
                        <Zap size={36} className="text-[var(--app-primary)]" />
                    </div>
                )}

                {/* Org name */}
                {orgName && (
                    <h1 className="text-2xl font-black text-[var(--app-text)] mb-1 tracking-tight">{orgName}</h1>
                )}
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--app-primary)]/60">POS Terminal</p>

                {/* Live Clock */}
                <div className="mt-10">
                    <div className="font-black text-5xl tracking-tight text-[var(--app-text)] tabular-nums" >
                        {hh}<span className="text-[var(--app-primary)] animate-pulse">:</span>{mm}<span className="text-[var(--app-text-muted)] text-3xl">.{ss}</span>
                    </div>
                    <p className="text-[var(--app-text-muted)] text-sm font-medium mt-2">{dateStr}</p>
                </div>

                {/* Bottom badge */}
                <div className="mt-12 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--app-success)] animate-pulse shadow-sm shadow-sm shadow-[var(--app-success)]" />
                    <span className="text-[11px] font-bold text-[var(--app-text-faint)] uppercase tracking-widest">System Online</span>
                </div>
            </div>
        </div>
    );
}
