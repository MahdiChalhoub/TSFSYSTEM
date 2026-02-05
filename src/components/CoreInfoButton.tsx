'use client';

import React, { useState } from 'react';
import { Info, X, ShieldCheck, Zap, ChevronRight } from 'lucide-react';

export function CoreInfoButton() {
    const [isOpen, setIsOpen] = useState(false);

    const cores = [
        {
            code: 'core',
            name: 'Base Infrastructure',
            version: '1.0.0',
            icon: ShieldCheck,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
            description: 'The "Spine" of the system. Handles platform integrity, security protocols, and essential multi-tenant infrastructure.',
            workflows: [
                'PostgreSQL Integrity Philosophy',
                'Global System Bootloader',
                'Security & Authentication Baseline'
            ]
        },
        {
            code: 'coreplatform',
            name: 'Core Platform',
            version: '2.7.0',
            icon: Zap,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50',
            border: 'border-indigo-100',
            description: 'The central orchestration engine. Manages modular injection and safe request routing between modules.',
            workflows: [
                'Modular Request Orchestration',
                'Connector Engine (Brokerage)',
                'Fallback & Graceful Degradation'
            ]
        }
    ];

    return (
        <div className="fixed bottom-6 left-6 z-[9999] font-sans">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-12 h-12 bg-white text-gray-400 rounded-2xl shadow-xl flex items-center justify-center hover:text-indigo-600 hover:scale-110 transition-all border border-gray-100 group"
                    title="Core Infrastructure Info"
                >
                    <Info size={20} className="group-hover:rotate-12 transition-transform" />
                </button>
            ) : (
                <div className="w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-left-4 duration-300">
                    {/* Header */}
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                                <ShieldCheck size={14} />
                            </div>
                            <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Base Infrastructure</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {cores.map((core) => (
                            <div key={core.code} className={`p-4 rounded-2xl border ${core.border} ${core.bg} space-y-3`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <core.icon size={16} className={core.color} />
                                        <span className="text-xs font-black text-gray-900">{core.name}</span>
                                    </div>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/50 rounded-md border border-white/80 text-gray-500">
                                        v{core.version}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                                    {core.description}
                                </p>
                                <div className="space-y-1">
                                    {core.workflows.map((wf, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5">
                                            <ChevronRight size={10} className="text-gray-400" />
                                            <span className="text-[10px] font-bold text-gray-500">{wf}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-center">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">TSF Modular Engine</span>
                    </div>
                </div>
            )}
        </div>
    );
}
