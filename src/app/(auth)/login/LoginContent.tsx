'use client'

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { PublicConfig } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Building2, Globe, Lock, User, Eye, EyeOff, KeyRound, ArrowRight, Fingerprint } from "lucide-react";
import { PLATFORM_CONFIG, useDynamicBranding } from "@/lib/saas_config";

const initialState: { error: Record<string, unknown>; success?: boolean } = {
    error: {},
};

export function LoginContent({ initialSubdomain = '' }: { initialSubdomain?: string }) {
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<PublicConfig>({ tenant: null });
    const searchParams = useSearchParams();
    const branding = useDynamicBranding();
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const prefilledUsername = "";
    const [subdomain] = useState(initialSubdomain);

    useEffect(() => {
        getPublicConfig().then(setConfig).catch(() => { });

        // Auto-redirect authenticated users to /dashboard — but ONLY when we
        // weren't bounced here by a protected layout's auth failure. When
        // ?error=session_expired (or any error) is present, the (privileged)
        // layout just kicked us out; redirecting back creates an infinite
        // loop whenever the backend's auth check is flaky. Let the user
        // re-sign in explicitly in that case.
        const hasError = !!searchParams?.get('error');
        if (hasError) return;

        if (typeof window !== 'undefined') {
            import("@/app/actions/auth").then(({ meAction }) => {
                meAction().then((user: any) => {
                    if (user && user.id) {
                        window.location.href = "/dashboard";
                    }
                }).catch(() => { });
            });
        }
    }, [searchParams]);

    const tenant = config.tenant;
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];
    const loginBranding = (tenant as any)?.login_branding || (tenant as any)?.settings?.login_branding || {};

    const isSaaS = subdomain === 'saas' || tenant?.slug === 'saas';
    const isRoot = !subdomain && !isSaaS;

    const displayTitle = isSaaS ? "SAAS CONTROL" : (isRoot ? PLATFORM_CONFIG.name.toUpperCase() : (tenant?.name || PLATFORM_CONFIG.name).toUpperCase());
    const displaySubtitle = loginBranding.tagline || (isSaaS
        ? "Global infrastructure management & orchestration."
        : (isRoot
            ? PLATFORM_CONFIG.tagline
            : "Secure enterprise gateway. Authorized personnel only."));

    const brandColor = loginBranding.brand_color || 'var(--app-primary, #10b981)';
    const bgImage = loginBranding.bg_image || null;

    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] relative overflow-hidden"
            style={{ '--login-accent': brandColor } as React.CSSProperties}
        >
            {/* ─── Left Column: Branding Hero ─── */}
            <div className="relative hidden lg:flex flex-col justify-end overflow-hidden"
                style={{ background: 'var(--app-bg, #0a0f1e)' }}
            >
                {/* Background Layer */}
                {bgImage ? (
                    <img
                        src={bgImage}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ opacity: 0.35 }}
                    />
                ) : (
                    <div className="absolute inset-0">
                        {/* Animated gradient mesh */}
                        <div className="absolute inset-0 animate-gradient-shift"
                            style={{
                                background: `
                                    radial-gradient(ellipse at 20% 50%, color-mix(in srgb, ${brandColor} 15%, transparent) 0%, transparent 60%),
                                    radial-gradient(ellipse at 80% 20%, color-mix(in srgb, ${brandColor} 8%, transparent) 0%, transparent 50%),
                                    radial-gradient(ellipse at 60% 80%, color-mix(in srgb, var(--app-accent) 6%, transparent) 0%, transparent 50%)
                                `,
                            }}
                        />
                        {/* Grid pattern overlay */}
                        <div className="absolute inset-0 opacity-[0.03]"
                            style={{
                                backgroundImage: `
                                    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                                `,
                                backgroundSize: '60px 60px',
                            }}
                        />
                    </div>
                )}

                {/* Floating decorative elements */}
                <div className="absolute top-20 right-20 w-64 h-64 rounded-full opacity-[0.04] animate-float-slow"
                    style={{ background: brandColor, filter: 'blur(60px)' }}
                />
                <div className="absolute bottom-40 left-10 w-40 h-40 rounded-full opacity-[0.03] animate-float-slow"
                    style={{ background: '#818cf8', filter: 'blur(40px)', animationDelay: '2s' }}
                />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(to top, var(--app-bg, #0a0f1e) 0%, transparent 50%, color-mix(in srgb, var(--app-bg, #0a0f1e) 30%, transparent) 100%)',
                    }}
                />

                {/* Content */}
                <div className="relative z-10 p-14 pb-16 space-y-8">
                    {/* Logo / Brand Mark */}
                    {tenantLogo ? (
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl"
                            style={{
                                border: `2px solid color-mix(in srgb, ${brandColor} 30%, transparent)`,
                                boxShadow: `0 8px 32px color-mix(in srgb, ${brandColor} 20%, transparent)`,
                            }}
                        >
                            <img src={tenantLogo} className="w-full h-full object-contain bg-white p-2" alt={displayTitle} />
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl"
                            style={{
                                background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, var(--app-accent)))`,
                                boxShadow: `0 8px 32px color-mix(in srgb, ${brandColor} 25%, transparent)`,
                            }}
                        >
                            {displayTitle.charAt(0)}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-3">
                        <h1 className="text-5xl font-black tracking-tight leading-tight"
                            style={{ color: 'var(--app-foreground, #fff)' }}
                        >
                            {displayTitle}
                        </h1>
                        <p className="text-lg max-w-lg leading-relaxed"
                            style={{ color: 'var(--app-muted-foreground, #94a3b8)' }}
                        >
                            {displaySubtitle}
                        </p>
                    </div>

                    {/* Trust indicators */}
                    <div className="flex items-center gap-6 pt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: brandColor }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                            >
                                Secured
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--app-muted-foreground, #64748b)' }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                            >
                                Encrypted
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--app-muted-foreground, #64748b)' }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                            >
                                Multi-Tenant
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom decorative line */}
                <div className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, transparent, ${brandColor}, transparent)`, opacity: 0.3 }}
                />
            </div>

            {/* ─── Right Column: Login Form ─── */}
            <div className="flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 relative"
                style={{ background: 'var(--app-surface, #111827)' }}
            >
                {/* Subtle radial glow */}
                <div className="absolute top-0 left-0 right-0 h-96 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${brandColor} 4%, transparent) 0%, transparent 70%)`,
                    }}
                />

                <div className="w-full max-w-md space-y-8 relative z-10">
                    {/* Mobile-only branding header */}
                    <div className="lg:hidden text-center space-y-3">
                        {tenantLogo ? (
                            <img src={tenantLogo} className="w-14 h-14 mx-auto rounded-xl object-contain bg-white p-1.5" alt={displayTitle} />
                        ) : (
                            <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center text-xl font-black text-white"
                                style={{ background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, var(--app-accent)))` }}
                            >
                                {displayTitle.charAt(0)}
                            </div>
                        )}
                        <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--app-foreground, #fff)' }}>{displayTitle}</h2>
                    </div>

                    {/* Welcome Header */}
                    <div className="space-y-2 text-center lg:text-left">
                        <div className="flex items-center gap-3 justify-center lg:justify-start mb-4">
                            <div className="p-2.5 rounded-xl"
                                style={{
                                    background: `color-mix(in srgb, ${brandColor} 10%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${brandColor} 20%, transparent)`,
                                }}
                            >
                                <Fingerprint size={22} style={{ color: brandColor }} />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-foreground, #fff)' }}>
                            Welcome Back
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--app-muted-foreground, #94a3b8)' }}>
                            Enter your credentials to access the workspace.
                        </p>
                    </div>

                    <form action={action} className="space-y-5">
                        {/* Error Banner */}
                        {(state?.error as any)?.root && (
                            <div className="p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                                    color: 'var(--app-error, #ef4444)',
                                }}
                            >
                                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                                <span className="text-sm font-semibold">{(state?.error as any).root[0]}</span>
                            </div>
                        )}

                        {state?.two_factor_required ? (
                            /* ─── 2FA State ─── */
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="p-4 rounded-xl flex items-center gap-3"
                                    style={{
                                        background: `color-mix(in srgb, ${brandColor} 8%, transparent)`,
                                        border: `1px solid color-mix(in srgb, ${brandColor} 20%, transparent)`,
                                        color: brandColor,
                                    }}
                                >
                                    <ShieldCheck size={20} />
                                    <span className="text-sm font-bold">{state.message}</span>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                    >Verification Code</Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2" size={18}
                                            style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                        />
                                        <Input
                                            name="otp_token"
                                            placeholder="000 000"
                                            required
                                            autoFocus
                                            className="h-16 rounded-xl font-mono text-center text-3xl tracking-[0.2em] pl-12 outline-none transition-all duration-200"
                                            style={{
                                                background: 'var(--app-bg, #0f172a)',
                                                border: `2px solid color-mix(in srgb, ${brandColor} 30%, var(--app-border, #1e293b))`,
                                                color: 'var(--app-foreground, #fff)',
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center mt-2"
                                        style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                    >
                                        Enter the verification code from your device
                                    </p>
                                </div>

                                <input type="hidden" name="challenge_id" defaultValue={(state as any).challenge_id} />
                                {isRoot && <input type="hidden" name="slug" defaultValue={(state as any)._slug} />}

                                <Button
                                    className="w-full h-14 font-black text-base rounded-xl uppercase tracking-wider transition-all duration-200"
                                    style={{
                                        background: brandColor,
                                        color: '#fff',
                                        boxShadow: `0 4px 20px color-mix(in srgb, ${brandColor} 30%, transparent)`,
                                    }}
                                    disabled={isPending}
                                >
                                    {isPending ? <Loader2 className="animate-spin" /> : (
                                        <span className="flex items-center gap-2">Verify <ArrowRight size={18} /></span>
                                    )}
                                </Button>

                                <div className="text-center">
                                    <button type="button" onClick={() => window.location.reload()}
                                        className="text-xs font-bold uppercase tracking-widest transition-colors"
                                        style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-foreground, #fff)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground, #64748b)'; }}
                                    >
                                        Cancel & Restart
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ─── Login Fields ─── */
                            <>
                                <div className="space-y-4">
                                    {/* Workspace field — root domain only */}
                                    {isRoot && (
                                        <div className="space-y-2 animate-in fade-in duration-300">
                                            <Label className="text-[10px] font-black uppercase tracking-widest"
                                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                            >Workspace</Label>
                                            <div className="relative group">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={18}
                                                    style={{ color: focusedField === 'slug' ? brandColor : 'var(--app-muted-foreground, #64748b)' }}
                                                />
                                                <Input
                                                    id="slug"
                                                    name="slug"
                                                    placeholder="acme"
                                                    required
                                                    defaultValue={searchParams.get('slug') || ''}
                                                    onFocus={() => setFocusedField('slug')}
                                                    onBlur={() => setFocusedField(null)}
                                                    className="h-14 rounded-xl font-mono pl-12 pr-36 transition-all duration-200 outline-none"
                                                    style={{
                                                        background: 'var(--app-bg, #0f172a)',
                                                        border: `2px solid ${focusedField === 'slug' ? `color-mix(in srgb, ${brandColor} 50%, transparent)` : 'var(--app-border, #1e293b)'}`,
                                                        color: 'var(--app-foreground, #fff)',
                                                        boxShadow: focusedField === 'slug' ? `0 0 0 3px color-mix(in srgb, ${brandColor} 10%, transparent)` : 'none',
                                                    }}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono select-none"
                                                    style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                                >
                                                    {branding.suffix}
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                            >
                                                Don't have a workspace?{' '}
                                                <a href="/register/business" className="font-black underline underline-offset-2 transition-colors"
                                                    style={{ color: brandColor }}
                                                >
                                                    Create one
                                                </a>
                                            </p>
                                        </div>
                                    )}

                                    {/* Username */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest"
                                            style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                        >Username</Label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={18}
                                                style={{ color: focusedField === 'username' ? brandColor : 'var(--app-muted-foreground, #64748b)' }}
                                            />
                                            <Input
                                                name="username"
                                                required
                                                defaultValue={prefilledUsername}
                                                onFocus={() => setFocusedField('username')}
                                                onBlur={() => setFocusedField(null)}
                                                className="h-14 rounded-xl pl-12 transition-all duration-200 outline-none"
                                                style={{
                                                    background: 'var(--app-bg, #0f172a)',
                                                    border: `2px solid ${focusedField === 'username' ? `color-mix(in srgb, ${brandColor} 50%, transparent)` : 'var(--app-border, #1e293b)'}`,
                                                    color: 'var(--app-foreground, #fff)',
                                                    boxShadow: focusedField === 'username' ? `0 0 0 3px color-mix(in srgb, ${brandColor} 10%, transparent)` : 'none',
                                                }}
                                            />
                                        </div>
                                        {(state?.error as any)?.username && (
                                            <p className="text-xs font-bold mt-1" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                {(state?.error as any).username[0]}
                                            </p>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase tracking-widest"
                                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                            >Password</Label>
                                            <a href="/forgot-password"
                                                className="text-[10px] font-black uppercase tracking-widest transition-colors"
                                                style={{ color: brandColor }}
                                            >
                                                Forgot?
                                            </a>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={18}
                                                style={{ color: focusedField === 'password' ? brandColor : 'var(--app-muted-foreground, #64748b)' }}
                                            />
                                            <Input
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                onFocus={() => setFocusedField('password')}
                                                onBlur={() => setFocusedField(null)}
                                                className="h-14 rounded-xl pl-12 pr-12 transition-all duration-200 outline-none"
                                                style={{
                                                    background: 'var(--app-bg, #0f172a)',
                                                    border: `2px solid ${focusedField === 'password' ? `color-mix(in srgb, ${brandColor} 50%, transparent)` : 'var(--app-border, #1e293b)'}`,
                                                    color: 'var(--app-foreground, #fff)',
                                                    boxShadow: focusedField === 'password' ? `0 0 0 3px color-mix(in srgb, ${brandColor} 10%, transparent)` : 'none',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Site selector */}
                                    {!isRoot && sites.length > 0 && (
                                        <div className="space-y-2 animate-in fade-in duration-300">
                                            <Label className="text-[10px] font-black uppercase tracking-widest"
                                                style={{ color: 'var(--app-muted-foreground, #64748b)' }}
                                            >Site Location</Label>
                                            <Select name="site_id" defaultValue={sites[0]?.id?.toString()}>
                                                <SelectTrigger
                                                    className="h-14 rounded-xl transition-all"
                                                    style={{
                                                        background: 'var(--app-bg, #0f172a)',
                                                        border: '2px solid var(--app-border, #1e293b)',
                                                        color: 'var(--app-foreground, #fff)',
                                                    }}
                                                >
                                                    <SelectValue placeholder="Select Base" />
                                                </SelectTrigger>
                                                <SelectContent
                                                    className="rounded-xl"
                                                    style={{
                                                        background: 'var(--app-surface, #111827)',
                                                        border: '1px solid var(--app-border, #1e293b)',
                                                        color: 'var(--app-foreground, #fff)',
                                                    }}
                                                >
                                                    {sites.map((s: Record<string, any>) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {/* Submit */}
                                <Button
                                    className="w-full h-14 font-black text-base rounded-xl uppercase tracking-wider transition-all duration-200 group"
                                    style={{
                                        background: brandColor,
                                        color: '#fff',
                                        boxShadow: `0 4px 20px color-mix(in srgb, ${brandColor} 30%, transparent)`,
                                    }}
                                    disabled={isPending}
                                >
                                    {isPending ? <Loader2 className="animate-spin" /> : (
                                        <span className="flex items-center gap-2">
                                            {isRoot ? "Continue" : "Sign In"}
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    )}
                                </Button>
                            </>
                        )}

                        {/* Registration links */}
                        {!isRoot && (
                            <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--app-border, #1e293b)' }}>
                                <a href="/register/business">
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 font-bold uppercase tracking-tight text-sm rounded-xl transition-all"
                                        style={{
                                            border: `1px solid color-mix(in srgb, ${brandColor} 30%, transparent)`,
                                            background: `color-mix(in srgb, ${brandColor} 6%, transparent)`,
                                            color: brandColor,
                                        }}
                                    >
                                        <Building2 size={16} className="mr-2" />
                                        Register My Business
                                    </Button>
                                </a>
                                <p className="text-center text-[10px]" style={{ color: 'var(--app-muted-foreground, #64748b)' }}>
                                    Need access to an existing business?{' '}
                                    <a href="/register/user" className="font-bold underline underline-offset-2" style={{ color: brandColor }}>
                                        Request Employee Access
                                    </a>
                                </p>
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <div className="pt-6 text-center space-y-3">
                        <button
                            type="button"
                            onClick={() => {
                                // Delete all cookies
                                document.cookie.split(';').forEach(c => {
                                    const name = c.split('=')[0].trim();
                                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
                                    // Also try parent domain
                                    const parts = window.location.hostname.split('.');
                                    if (parts.length > 2) {
                                        const parent = '.' + parts.slice(-2).join('.');
                                        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${parent}`;
                                    }
                                });
                                // Clear localStorage
                                try { localStorage.clear(); } catch {}
                                // Clear sessionStorage
                                try { sessionStorage.clear(); } catch {}
                                // Reload
                                window.location.reload();
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{
                                color: 'var(--app-muted-foreground, #64748b)',
                                background: 'color-mix(in srgb, var(--app-muted-foreground, #64748b) 8%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-muted-foreground, #64748b) 15%, transparent)',
                            }}
                        >
                            🗑️ Clear Session &amp; Cookies
                        </button>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em]"
                            style={{ color: 'var(--app-muted-foreground, #475569)' }}
                        >
                            Powered by {PLATFORM_CONFIG.name} · End-to-End Encrypted
                        </p>
                    </div>
                </div>
            </div>

            {/* Global login page animations */}
            <style jsx>{`
                @keyframes gradient-shift {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(3deg); }
                }
                .animate-gradient-shift {
                    animation: gradient-shift 8s ease-in-out infinite;
                }
                .animate-float-slow {
                    animation: float-slow 6s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
