import Link from "next/link"

export function OrgNotFoundPage({ slug }: { slug: string }) {
 const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tsf.ci'

 return (
 <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
 {/* Ambient glow effects */}
 <div className="absolute inset-0 overflow-hidden pointer-events-none">
 <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
 <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/[0.03] to-indigo-500/[0.03] rounded-full blur-3xl" />
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
 <div className="w-28 h-28 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] flex items-center justify-center border border-slate-700/50 shadow-2xl shadow-black/50">
 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-app-text-muted">
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
 <div className="absolute -top-2 -right-2 w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/40 rotate-12">
 <span className="text-app-text text-lg font-black">?</span>
 </div>
 </div>
 </div>

 {/* Main text */}
 <div className="space-y-3">
 <h1 className="text-4xl font-black text-app-text tracking-tight leading-tight">
 Workspace Not Found
 </h1>
 <p className="text-app-text-faint text-lg leading-relaxed max-w-sm mx-auto">
 The organization you&apos;re looking for hasn&apos;t been registered on our platform yet.
 </p>
 </div>

 {/* Slug Display Card */}
 <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 backdrop-blur-sm mx-auto max-w-sm">
 <p className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2">Requested Address</p>
 <p className="text-slate-300 font-mono font-bold text-lg">
 <span className="text-app-text-muted">https://</span>
 <span className="text-amber-400">{slug}</span>
 <span className="text-app-text-muted">.{rootDomain}</span>
 </p>
 </div>

 {/* Possible reasons */}
 <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5 text-left space-y-3 max-w-sm mx-auto">
 <p className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">This could mean</p>
 <div className="space-y-2">
 <div className="flex items-start gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
 <p className="text-sm text-app-text-faint">The workspace name is misspelled</p>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
 <p className="text-sm text-app-text-faint">The organization hasn&apos;t been created yet</p>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
 <p className="text-sm text-app-text-faint">The workspace was removed by its owner</p>
 </div>
 </div>
 </div>

 {/* Action buttons */}
 <div className="space-y-3 pt-2 max-w-sm mx-auto">
 <Link
 href={`https://${rootDomain}/register/business`}
 className="block w-full py-4 px-8 bg-emerald-600 hover:bg-emerald-500 text-app-text font-black text-sm uppercase tracking-[0.15em] rounded-2xl shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:shadow-emerald-500/25 hover:-translate-y-0.5"
 >
 Create Your Workspace
 </Link>
 <div className="flex gap-3">
 <Link
 href={`https://${rootDomain}`}
 className="flex-1 py-3.5 px-6 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700/50 transition-all duration-200"
 >
 Home
 </Link>
 <Link
 href={`https://${rootDomain}/login`}
 className="flex-1 py-3.5 px-6 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700/50 transition-all duration-200"
 >
 Sign In
 </Link>
 </div>
 </div>

 {/* Footer */}
 <div className="pt-6 space-y-2">
 <p className="text-xs text-app-text-muted">
 Know your workspace name?{' '}
 <Link href={`https://${rootDomain}/login`} className="text-emerald-500 hover:text-emerald-400 font-bold underline underline-offset-2 transition-colors">
 Sign in from the main page
 </Link>
 </p>
 <p className="text-[10px] text-slate-700 font-mono uppercase tracking-widest">
 Powered by TSF Platform
 </p>
 </div>
 </div>
 </div>
 )
}
