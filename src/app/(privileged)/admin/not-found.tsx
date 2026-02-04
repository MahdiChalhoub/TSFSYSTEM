'use client';

import { FileWarning, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminNotFound() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] text-center p-8">
            <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="w-24 h-24 bg-white/80 backdrop-blur-xl border border-white/50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl relative z-10 mx-auto">
                    <FileWarning size={48} />
                </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Page Not Found</h2>
            <p className="text-gray-500 mb-8 max-w-md text-lg mx-auto leading-relaxed">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                    <ArrowLeft size={18} />
                    <span>Go Back</span>
                </button>

                <Link
                    href="/admin"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all shadow-emerald-500/25"
                >
                    <Home size={18} />
                    <span>Dashboard</span>
                </Link>
            </div>
        </div>
    );
}
