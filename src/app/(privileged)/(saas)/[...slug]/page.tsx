'use client';

import { usePathname } from 'next/navigation';
import { FileQuestion, ArrowLeft, Home, Search } from 'lucide-react';
import Link from 'next/link';

/**
 * Catch-All Route for Undefined Pages
 * 
 * Renders inside the app layout (Sidebar + TopHeader + TabNavigator)
 * instead of showing the Next.js default 404. This ensures users
 * always stay within the platform UI shell.
 * 
 * Shows a clear "Page Not Found" message — NOT "Under Construction".
 * Only genuinely registered module pages should claim to exist.
 */
export default function CatchAllPage() {
 const pathname = usePathname();

 // Extract path segments for display
 const segments = pathname.split('/').filter(Boolean);
 const fullPath = '/' + segments.join('/');

 return (
 <div className="app-page flex items-center justify-center min-h-[80vh] p-8">
 <div className="max-w-lg w-full text-center">
 {/* Icon */}
 <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-rose-50 to-orange-50 
 border border-rose-100 flex items-center justify-center mb-8 shadow-lg shadow-rose-100/50">
 <FileQuestion className="w-10 h-10 text-rose-400" />
 </div>

 {/* Title */}
 <h1 className="page-header-title tracking-tight">
 Page Not Found
 </h1>

 {/* Subtitle / Path */}
 <div className="mt-3 inline-block px-4 py-2 bg-app-background border border-app-border rounded-xl">
 <p className="text-sm text-app-muted-foreground font-mono">
 {fullPath}
 </p>
 </div>

 {/* Message */}
 <div className="mt-6 p-5 rounded-2xl bg-app-background border border-app-border text-left space-y-3 max-w-sm mx-auto">
 <p className="text-sm text-app-muted-foreground leading-relaxed">
 The page you're trying to access doesn't exist. This could be because of:
 </p>
 <div className="space-y-2">
 <div className="flex items-start gap-2.5">
 <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
 <p className="text-sm text-app-muted-foreground">A mistyped URL or broken link</p>
 </div>
 <div className="flex items-start gap-2.5">
 <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
 <p className="text-sm text-app-muted-foreground">A page that was moved or removed</p>
 </div>
 <div className="flex items-start gap-2.5">
 <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
 <p className="text-sm text-app-muted-foreground">A feature not available for your account</p>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
 <Link
 href="/dashboard"
 className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
 bg-app-surface text-app-foreground text-sm font-bold hover:bg-app-surface-2 transition-all shadow-md shadow-app-border/20"
 >
 <ArrowLeft className="w-4 h-4" />
 Dashboard
 </Link>
 <button
 onClick={() => window.history.back()}
 className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
 bg-app-surface text-app-muted-foreground text-sm font-bold
 border border-app-border hover:border-app-border  hover:bg-app-background transition-all"
 >
 Go Back
 </button>
 </div>

 {/* Tech Info */}
 <p className="mt-10 text-[10px] text-app-muted-foreground font-mono uppercase tracking-widest">
 404 • Route Not Matched
 </p>
 </div>
 </div>
 );
}
