'use client'

import Link from "next/link"

export default function GlobalNotFound() {
    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 bg-app-bg">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-rose-50 to-orange-50 
 border border-rose-100 flex items-center justify-center shadow-lg shadow-rose-100/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                        <path d="M12 18v-6" />
                        <path d="M12 12h.01" />
                    </svg>
                </div>

                {/* Title */}
                <div>
                    <h1>
                        Page Not Found
                    </h1>
                    <p className="mt-2 text-app-muted-foreground text-sm">
                        The page you're looking for doesn't exist or has been moved.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
 bg-app-surface text-app-foreground text-sm font-bold hover:bg-app-surface-2 transition-all shadow-md shadow-gray-900/20"
                    >
                        ← Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
 bg-app-surface text-app-muted-foreground text-sm font-bold
 border border-app-border hover:border-app-border  hover:bg-app-bg transition-all"
                    >
                        Home
                    </Link>
                </div>

                <p className="text-[10px] text-app-muted-foreground font-mono uppercase tracking-widest pt-4">
                    404 • Page Not Found
                </p>
            </div>
        </div>
    )
}
