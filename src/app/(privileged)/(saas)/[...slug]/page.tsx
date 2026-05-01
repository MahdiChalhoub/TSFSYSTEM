'use client';

import { usePathname } from 'next/navigation';
import { Package, Wrench, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Catch-All Route for Undefined Module Pages
 * 
 * Renders inside the app layout (Sidebar + TopHeader + TabNavigator)
 * instead of showing the Next.js default 404. This ensures users
 * always stay within the platform UI shell.
 */
export default function CatchAllPage() {
    const pathname = usePathname();

    // Extract module name from path for display
    const segments = pathname.split('/').filter(Boolean);
    const moduleName = segments[0] ? segments[0].replace(/-/g, ' ') : 'Unknown';
    const fullPath = segments.join(' / ');

    return (
        <div className="flex items-center justify-center min-h-[80vh] p-8">
            <div className="max-w-lg w-full text-center">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 rounded-2xl bg-app-gradient-accent-soft 
                    border border-app-accent flex items-center justify-center mb-8
                    shadow-lg shadow-indigo-100/50">
                    <Package className="w-10 h-10 text-app-accent" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-black text-app-foreground tracking-tight capitalize">
                    {moduleName}
                </h1>

                {/* Subtitle */}
                <p className="mt-2 text-sm text-app-muted-foreground font-mono">
                    /{fullPath}
                </p>

                {/* Message */}
                <div className="mt-6 p-4 rounded-xl bg-app-warning-bg border border-app-warning/50">
                    <div className="flex items-center justify-center gap-2 text-app-warning font-semibold text-sm">
                        <Wrench className="w-4 h-4" />
                        Module Page Under Construction
                    </div>
                    <p className="mt-2 text-app-warning/80 text-sm leading-relaxed">
                        This page is registered in the platform but hasn't been built yet.
                        The module's backend API is ready — the UI is coming soon.
                    </p>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                            bg-app-bg text-white text-sm font-semibold
                            hover:bg-app-surface transition-all shadow-md shadow-gray-900/20"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/modules"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                            bg-app-surface text-app-foreground text-sm font-semibold
                            border border-app-border hover:border-app-border 
                            hover:bg-app-surface transition-all"
                    >
                        <Package className="w-4 h-4" />
                        Browse Modules
                    </Link>
                </div>

                {/* Tech Info */}
                <p className="mt-10 text-xs text-app-faint font-mono">
                    Engine v1.3.0 • Catch-All Route • Layout Preserved
                </p>
            </div>
        </div>
    );
}
