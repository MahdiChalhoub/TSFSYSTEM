
import React from 'react';
import { Box as BoxIcon } from 'lucide-react';

export default function DemoPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="bg-[#0F172A] border border-emerald-500/20 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700" />

                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-4">
                        <BoxIcon size={48} className="text-emerald-400" />
                    </div>

                    <h1 className="text-4xl font-bold text-white tracking-tight">
                        Demo Module Active
                    </h1>

                    <p className="text-lg text-emerald-400/80 max-w-lg leading-relaxed">
                        If you can see this page, the <strong className="text-emerald-300">Modular Architecture</strong> is working perfectly.
                    </p>

                    <div className="flex flex-col gap-2 mt-4 text-sm text-gray-500 font-mono bg-[#0B1120] p-4 rounded-xl border border-gray-800">
                        <div className="flex justify-between gap-8">
                            <span>Status:</span>
                            <span className="text-emerald-500">INSTALLED</span>
                        </div>
                        <div className="flex justify-between gap-8">
                            <span>Version:</span>
                            <span className="text-white">1.0.0</span>
                        </div>
                        <div className="flex justify-between gap-8">
                            <span>Backend:</span>
                            <span className="text-white">apps/demo</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
