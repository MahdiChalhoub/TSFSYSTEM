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
                <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 
                    border border-indigo-100 flex items-center justify-center mb-8
                    shadow-lg shadow-indigo-100/50">
                    <Package className="w-10 h-10 text-indigo-500" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-black text-gray-900 tracking-tight capitalize">
                    {moduleName}
                </h1>

                {/* Subtitle */}
                <p className="mt-2 text-sm text-gray-400 font-mono">
                    /{fullPath}
                </p>

                {/* Message */}
                <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200/50">
                    <div className="flex items-center justify-center gap-2 text-amber-700 font-semibold text-sm">
                        <Wrench className="w-4 h-4" />
                        Module Page Under Construction
                    </div>
                    <p className="mt-2 text-amber-600/80 text-sm leading-relaxed">
                        This page is registered in the platform but hasn't been built yet.
                        The module's backend API is ready — the UI is coming soon.
                    </p>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                            bg-gray-900 text-white text-sm font-semibold
                            hover:bg-gray-800 transition-all shadow-md shadow-gray-900/20"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/modules"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                            bg-white text-gray-700 text-sm font-semibold
                            border border-gray-200 hover:border-gray-300 
                            hover:bg-gray-50 transition-all"
                    >
                        <Package className="w-4 h-4" />
                        Browse Modules
                    </Link>
                </div>

                {/* Tech Info */}
                <p className="mt-10 text-xs text-gray-300 font-mono">
                    Engine v1.3.0 • Catch-All Route • Layout Preserved
                </p>
            </div>
        </div>
    );
}
