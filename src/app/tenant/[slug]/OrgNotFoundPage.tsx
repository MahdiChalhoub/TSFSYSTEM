'use client'

import Link from "next/link"
import { PLATFORM_CONFIG } from '@/lib/branding'

export function OrgNotFoundPage({ slug }: { slug: string }) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_CONFIG.domain

    return (
        <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden bg-app-bg">
            {/* Ambient glow effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-app-success/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-app-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
                    style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 3%, transparent), color-mix(in srgb, var(--app-accent) 3%, transparent))' }}
                />
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-[0.015]" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px'
                }} />
            </div>

            <div className="relative z-10 max-w-lg w-full text-center space-y-8">
                {/* Icon cluster */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="w-28 h-28 bg-app-gradient-surface rounded-[2rem] flex items-center justify-center border border-app-border-strong/50 shadow-2xl shadow-black/50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-app-muted-foreground">
                                <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                                <path d="M9 22v-4h6v4" />
                                <path d="M8 6h.01" />
                                <path d="M16 6h.01" />
                                <path d="M12 6h.01" />
                                <path d="M12 10h.01" />
                                <path d="M12 14h.01" />
                                <path d="M16 10h.01" />
                                <path d="M16 14h.01" />
                                <path d="M8 10h.01" />
                                <path d="M8 14h.01" />
                            </svg>
                        </div>
                        {/* Status badge */}
                        <div className="absolute -top-2 -right-2 w-9 h-9 bg-app-warning rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/40 rotate-12">
                            <span className="text-app-foreground text-lg font-black">?</span>
                        </div>
                    </div>
                </div>

                {/* Main text */}
                <div className="space-y-3">
                    <h1>
                        Workspace Not Found
                    </h1>
                    <p className="text-app-muted-foreground text-lg leading-relaxed max-w-sm mx-auto">
                        The organization you&apos;re looking for hasn&apos;t been registered on our platform yet.
                    </p>
                </div>

                {/* Slug Display Card */}
                <div className="bg-app-surface-2/50 border border-app-border-strong/40 rounded-2xl p-5 backdrop-blur-sm mx-auto max-w-sm">
                    <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">Requested Address</p>
                    <p className="text-app-foreground font-mono font-bold text-lg">
                        <span className="text-app-muted-foreground">https://</span>
                        <span className="text-app-warning">{slug}</span>
                        <span className="text-app-muted-foreground">.{rootDomain}</span>
                    </p>
                </div>

                {/* Possible reasons */}
                <div className="bg-app-surface-2/30 border border-app-border-strong/30 rounded-2xl p-5 text-left space-y-3 max-w-sm mx-auto">
                    <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">This could mean</p>
                    <div className="space-y-2">
                        <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-app-warning mt-2 shrink-0" />
                            <p className="text-sm text-app-muted-foreground">The workspace name is misspelled</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-app-warning mt-2 shrink-0" />
                            <p className="text-sm text-app-muted-foreground">The organization hasn&apos;t been created yet</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-app-warning mt-2 shrink-0" />
                            <p className="text-sm text-app-muted-foreground">The workspace was removed by its owner</p>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 pt-2 max-w-sm mx-auto">
                    <Link
                        href={`https://${rootDomain}/register/business`}
                        className="block w-full py-4 px-8 bg-app-primary-dark hover:bg-app-primary text-app-foreground font-black text-sm uppercase tracking-[0.15em] rounded-2xl shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                    >
                        Create Your Workspace
                    </Link>
                    <div className="flex gap-3">
                        <Link
                            href={`https://${rootDomain}`}
                            className="flex-1 py-3.5 px-6 bg-app-surface-2/80 hover:bg-app-surface-2 text-app-foreground font-bold text-sm rounded-xl border border-app-border-strong/50 transition-all duration-200"
                        >
                            Home
                        </Link>
                        <Link
                            href={`https://${rootDomain}/login`}
                            className="flex-1 py-3.5 px-6 bg-app-surface-2/80 hover:bg-app-surface-2 text-app-foreground font-bold text-sm rounded-xl border border-app-border-strong/50 transition-all duration-200"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-6 space-y-2">
                    <p className="text-xs text-app-muted-foreground">
                        Know your workspace name?{' '}
                        <Link href={`https://${rootDomain}/login`} className="text-app-success hover:text-app-success font-bold underline underline-offset-2 transition-colors">
                            Sign in from the main page
                        </Link>
                    </p>
                    <p className="text-[10px] text-app-muted-foreground font-mono uppercase tracking-widest">
                        Powered by {PLATFORM_CONFIG.federation_name}
                    </p>
                </div>
            </div>
        </div>
    )
}
