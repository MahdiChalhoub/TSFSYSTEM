'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, Wifi } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';

export function BrandPanel() {
    const [orgName, setOrgName] = useState('');
    const [orgLogo, setOrgLogo] = useState('');
    const [time, setTime] = useState(new Date());
    const canvasRef = useRef<HTMLCanvasElement>(null);

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

    /* ── Particle canvas background ── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
        const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5,
                o: Math.random() * 0.3 + 0.05,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const style = getComputedStyle(document.documentElement);
            const primary = style.getPropertyValue('--app-primary').trim() || '#3b82f6';

            for (const p of particles) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = primary;
                ctx.globalAlpha = p.o;
                ctx.fill();
            }

            // Draw faint connections
            ctx.globalAlpha = 0.04;
            ctx.strokeStyle = primary;
            ctx.lineWidth = 0.5;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    if (dx * dx + dy * dy < 12000) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            ctx.globalAlpha = 1;
            animId = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
    }, []);

    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const ss = time.getSeconds().toString().padStart(2, '0');
    const dateStr = time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const yearStr = time.getFullYear();
    const greeting = time.getHours() < 12 ? 'Good Morning' : time.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

    return (
        <div className="relative flex flex-col items-center justify-center h-full overflow-hidden select-none"
            style={{ background: 'var(--app-bg, var(--app-background))' }}>

            {/* Particle canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} />

            {/* Radial gradient overlays */}
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 60% 50% at 50% 45%, color-mix(in srgb, var(--app-primary) 6%, transparent), transparent)`,
                }} />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6">

                {/* Logo or icon */}
                {orgLogo ? (
                    <img src={orgLogo} alt={orgName}
                        className="w-16 h-16 rounded-2xl object-contain mb-6"
                        style={{
                            boxShadow: '0 8px 32px color-mix(in srgb, var(--app-primary) 20%, transparent), 0 0 60px color-mix(in srgb, var(--app-primary) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }} />
                ) : (
                    <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(145deg, color-mix(in srgb, var(--app-primary) 15%, var(--app-surface)), color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)))',
                            boxShadow: '0 8px 32px color-mix(in srgb, var(--app-primary) 15%, transparent), inset 0 1px 1px color-mix(in srgb, white 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }}>
                        <Zap size={24} style={{ color: 'var(--app-primary)' }} />
                    </div>
                )}

                {/* Greeting */}
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] mb-1"
                    style={{ color: 'var(--app-primary)', opacity: 0.5 }}>{greeting}</p>

                {/* Org name */}
                {orgName && (
                    <h1 className="mb-8"
                        style={{ color: 'var(--app-foreground, var(--app-foreground))' }}>{orgName}</h1>
                )}

                {/* ── Hero Clock ── */}
                <div className="relative">
                    {/* Glow behind clock */}
                    <div className="absolute -inset-8 rounded-full blur-3xl opacity-20 animate-pulse"
                        style={{ background: 'var(--app-primary)' }} />

                    <div className="relative flex items-baseline justify-center gap-1 tabular-nums"
                        style={{ fontFamily: "var(--app-font, 'Outfit', system-ui, sans-serif)" }}>
                        {/* Hours */}
                        <span className="text-[80px] sm:text-[96px] font-[900] leading-none tracking-tighter"
                            style={{ color: 'var(--app-foreground, var(--app-foreground))' }}>{hh}</span>

                        {/* Colon — animated pulse */}
                        <span className="text-[60px] sm:text-[72px] font-[200] leading-none mx-0.5"
                            style={{
                                color: 'var(--app-primary)',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                            }}>:</span>

                        {/* Minutes */}
                        <span className="text-[80px] sm:text-[96px] font-[900] leading-none tracking-tighter"
                            style={{ color: 'var(--app-foreground, var(--app-foreground))' }}>{mm}</span>

                        {/* Seconds — smaller, primary colored */}
                        <div className="flex flex-col items-start ml-1 self-end mb-3 sm:mb-4">
                            <span className="text-[22px] sm:text-[26px] font-black leading-none tabular-nums"
                                style={{ color: 'var(--app-primary)' }}>{ss}</span>
                        </div>
                    </div>
                </div>

                {/* Date */}
                <div className="mt-4 flex items-center gap-3">
                    <div className="h-px w-8 sm:w-12"
                        style={{ background: 'linear-gradient(to right, transparent, color-mix(in srgb, var(--app-primary) 25%, transparent))' }} />
                    <p className="text-[13px] sm:text-[14px] font-semibold tracking-wide"
                        style={{ color: 'color-mix(in srgb, var(--app-foreground, var(--app-foreground)) 50%, transparent)' }}>
                        {dateStr}, {yearStr}
                    </p>
                    <div className="h-px w-8 sm:w-12"
                        style={{ background: 'linear-gradient(to left, transparent, color-mix(in srgb, var(--app-primary) 25%, transparent))' }} />
                </div>

                {/* ── Status bar ── */}
                <div className="mt-14 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-2 h-2 rounded-full animate-pulse"
                                style={{
                                    background: 'var(--app-success)',
                                    boxShadow: '0 0 8px var(--app-success), 0 0 20px color-mix(in srgb, var(--app-success) 30%, transparent)',
                                }} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
                            style={{ color: 'color-mix(in srgb, var(--app-foreground, var(--app-foreground)) 35%, transparent)' }}>
                            System Online
                        </span>
                    </div>

                    <div className="w-px h-3"
                        style={{ background: 'color-mix(in srgb, var(--app-foreground, var(--app-foreground)) 12%, transparent)' }} />

                    <div className="flex items-center gap-1.5">
                        <Wifi size={11} style={{ color: 'color-mix(in srgb, var(--app-foreground, var(--app-foreground)) 30%, transparent)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
                            style={{ color: 'color-mix(in srgb, var(--app-foreground, var(--app-foreground)) 35%, transparent)' }}>
                            Connected
                        </span>
                    </div>
                </div>

                {/* POS Terminal badge */}
                <div className="mt-6 px-4 py-1.5 rounded-full"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 10%, transparent)',
                    }}>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em]"
                        style={{ color: 'color-mix(in srgb, var(--app-primary) 50%, var(--app-foreground, var(--app-foreground)))' }}>
                        POS Terminal
                    </span>
                </div>
            </div>
        </div>
    );
}
