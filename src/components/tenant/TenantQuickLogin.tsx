'use client'

import { useActionState } from "react"
import { loginAction } from "@/app/actions/auth"
import { ArrowRight, Loader2, AlertCircle, Lock, ShieldCheck } from "lucide-react"

// `loginAction` returns a discriminated union (auth path vs 2FA path); the
// inferred type from useActionState is the union of all cases. The popup
// renders fields progressively, so we read the union with narrow checks below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initialState: any = { error: {} }

export function TenantQuickLogin({ slug, suffix }: { slug: string; suffix: string }) {
    const [state, action, isPending] = useActionState(loginAction, initialState)

    return (
        <div className="p-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-center relative">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white">Secure Access</h2>
                    <p className="text-[10px] text-app-muted-foreground font-medium tracking-wide uppercase">{slug}{suffix}</p>
                </div>
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform">
                    <Lock size={20} />
                </div>
            </div>

            <form action={action} className="space-y-4 pt-2 relative">
                {/* Error Display */}
                {state?.error?.root && (
                    <div className="p-4 bg-app-error/10 border border-app-error/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
                        <AlertCircle size={18} className="shrink-0" />
                        {Array.isArray(state.error.root) ? state.error.root[0] : state.error.root}
                    </div>
                )}

                <input type="hidden" name="slug" value={slug} />

                {/* 2FA Step */}
                {state?.two_factor_required ? (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <div className="p-4 bg-app-success/10 border border-app-success/20 rounded-2xl text-emerald-400 text-sm font-medium flex items-center gap-3">
                            <ShieldCheck size={18} className="shrink-0" />
                            {state.message || "Enter your verification code"}
                        </div>

                        <input
                            name="otp_token"
                            type="text"
                            placeholder="000 000"
                            required
                            autoFocus
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white text-center text-2xl font-mono tracking-[0.3em] outline-none focus:border-app-success transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-app-muted-foreground"
                        />

                        {/* Server-side 2FA challenge — no passwords in DOM */}
                        <input type="hidden" name="challenge_id" defaultValue={state.challenge_id} />

                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-app-success hover:bg-app-success text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:hover:scale-100"
                        >
                            {isPending ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>Sign In <ShieldCheck size={20} /></>
                            )}
                        </button>

                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="text-[10px] text-app-muted-foreground hover:text-white font-bold uppercase tracking-[0.2em] transition-colors"
                            >
                                Cancel &amp; Restart
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <input
                            name="username"
                            type="text"
                            placeholder="Username"
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-app-success transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-app-muted-foreground"
                        />
                        <input
                            name="password"
                            type="password"
                            placeholder="Access Key"
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-app-success transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-app-muted-foreground"
                        />
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-app-success hover:bg-app-success text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:hover:scale-100"
                        >
                            {isPending ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>Initialize Session <ArrowRight size={20} /></>
                            )}
                        </button>
                        <div className="flex justify-center">
                            <a href="/forgot-password" className="text-[10px] text-app-muted-foreground hover:text-emerald-400 font-bold uppercase tracking-[0.2em] transition-colors">
                                Forgot Password?
                            </a>
                        </div>
                    </>
                )}
            </form>
        </div>
    )
}
