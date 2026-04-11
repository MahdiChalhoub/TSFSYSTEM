'use client'

import Link from "next/link"
import { PLATFORM_CONFIG } from '@/lib/branding'

export default function TenantNotFound() {
    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden bg-app-bg">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/3 to-indigo-500/3 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-lg w-full text-center space-y-8">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="w-28 h-28 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] flex items-center justify-center border border-slate-700/50 shadow-2xl">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-app-text-muted">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-app-warning rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-app-text">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-3">
                    <h1 className="text-4xl font-black text-app-text tracking-tight">
                        Workspace Not Found
                    </h1>
                    <p className="text-app-text-faint text-lg leading-relaxed max-w-sm mx-auto">
                        This organization hasn't been registered on our platform yet. It may have been removed or the address is incorrect.
                    </p>
                </div>

                {/* Slug Display */}
                <div className="bg-app-surface-2/50 border border-slate-700/50 rounded-2xl p-4 inline-block backdrop-blur-sm">
                    <p className="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1">Requested Workspace</p>
                    <p className="text-slate-300 font-mono font-bold text-lg">
                        <span className="text-app-text-muted">https://</span>
                        <span className="text-app-warning">???</span>
                        <span className="text-app-text-muted">{PLATFORM_CONFIG.suffix}</span>
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                    <Link
                        href="/register/business"
                        className="block w-full py-4 px-8 bg-emerald-600 hover:bg-emerald-500 text-app-text font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-500/20 hover:-translate-y-0.5"
                    >
                        Register Your Business
                    </Link>
                    <div className="flex gap-3">
                        <Link
                            href="/"
                            className="flex-1 py-3 px-6 bg-app-surface-2 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700/50 transition-all"
                        >
                            Home
                        </Link>
                        <Link
                            href="/login"
                            className="flex-1 py-3 px-6 bg-app-surface-2 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700/50 transition-all"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* Footer hint */}
                <p className="text-xs text-app-text-muted pt-4">
                    Already have a workspace?{' '}
                    <Link href="/login" className="text-emerald-400 hover:text-app-success font-bold underline underline-offset-2">
                        Sign in here
                    </Link>
                </p>
            </div>
        </div>
    )
}
