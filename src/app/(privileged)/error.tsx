'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

export default function PrivilegedError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-100 flex items-center justify-center text-red-600 mb-6 shadow-lg shadow-red-200">
                <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight underline decoration-red-500 decoration-4 underline-offset-4">
                Something Went Wrong
            </h2>
            <p className="text-gray-500 mt-4 font-medium max-w-sm mx-auto leading-relaxed">
                An unexpected error occurred while loading this page. Please try again or return to the dashboard.
            </p>

            <div className="mt-8 bg-white border border-gray-200 p-4 rounded-2xl max-w-md w-full text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Technical Trace</p>
                <p className="text-xs font-mono text-gray-600 break-all bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {error.message || "Unknown error context"}
                </p>
            </div>

            <div className="mt-10 flex gap-4">
                <Button
                    onClick={() => reset()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-6 rounded-2xl font-black shadow-lg shadow-emerald-200 transition-all flex gap-3"
                >
                    <RotateCcw size={18} />
                    Try Again
                </Button>
                <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboard'}
                    className="border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-8 py-6 rounded-2xl font-black transition-all"
                >
                    Go to Dashboard
                </Button>
            </div>
        </div>
    )
}
