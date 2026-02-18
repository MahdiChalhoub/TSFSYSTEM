'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/context/AdminContext';
import { useDev } from '@/context/DevContext';
import { Info, Bug, ShieldCheck, Database, Settings, X, ChevronRight, Activity, Terminal, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function DebugOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'logic' | 'ledger' | 'flow'>('logic');
    const pathname = usePathname();
    const { viewScope } = useAdmin();
    const [mounted, setMounted] = useState(false);
    const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
    const [recentLedger, setRecentLedger] = useState<Record<string, unknown>[]>([]);

    // Only show in development
    useEffect(() => {
        setMounted(true);
        if (process.env.NODE_ENV !== 'production' && isOpen) {
            const fetchData = async () => {
                try {
                    // BLANC ENGINE: Business modules might not be present
                    /*
                    const { getFinancialSettings } = await import('@/app/actions/finance/settings');
                    const { getLedgerEntries } = await import('@/app/actions/finance/ledger');

                    const [s, l] = await Promise.all([
                        getFinancialSettings(),
                        getLedgerEntries(viewScope === 'OFFICIAL' ? 'OFFICIAL' : 'INTERNAL')
                    ]);

                    setSettings(s);
                    setRecentLedger(l.slice(0, 5)); // Only last 5
                    */
                } catch (e) {
                    console.log("Modular audit data unavailable");
                }
            };
            fetchData();
        }
    }, [viewScope, isOpen]); // Refetch when opened or scope changes

    if (!mounted || process.env.NODE_ENV === 'production') return null;

    const getPageLogic = () => {
        const settingsInfo = settings ? [
            `Company Basis: ${settings.pricingCostBasis}`,
            `Works in TTC: ${settings.worksInTTC ? 'YES' : 'NO'}`,
            `VAT Recov: ${settings.declareTVA ? 'YES' : 'NO'}`
        ] : ['Loading settings...'];

        if (pathname === '/admin') {
            return {
                title: 'Global Analytics Hub',
                description: 'Displays aggregated financial and operational data synced across all modules.',
                linkage: [
                    ...settingsInfo,
                    'Aggregates: Sales, Purchases, Stock Value',
                    'Scope Filter: ' + viewScope
                ],
                readDetails: ['1. System KPIs from Dashboard Engine', '2. Live Stock Alert counters'],
                writeDetails: ['- Log User Session heartbeat', '- Cache global stats for 1min']
            };
        }
        if (pathname.includes('/admin/inventory/products')) {
            return {
                title: 'Product Master Data',
                description: 'Core inventory definition. Prices and costs are influenced by VAT settings.',
                linkage: [
                    ...settingsInfo,
                    'Pricing: ' + (settings?.worksInTTC ? 'TTC Basis' : 'HT Basis'),
                    'Stock: Real-time calculation from Transactions'
                ],
                readDetails: ['1. Product model (Prisma.product.findUnique)', '2. Stock levels per warehouse', '3. Active Price Lists'],
                writeDetails: ['- Update SKU metadata', '- Log price change history', '- Regenerate barcode if changed']
            };
        }
        if (pathname.includes('/admin/inventory')) {
            return {
                title: 'Inventory & Valuation',
                description: 'Real-time stock tracking. Valuation changes based on Effective Cost basis.',
                linkage: [
                    ...settingsInfo,
                    'Strategy: ' + (settings?.pricingCostBasis === 'AUTO' ? 'Dynamic Basis Detection' : 'Forced Basis'),
                    'Link: Batch Expiry tracking'
                ],
                readDetails: ['1. Warehouse Hierarchy', '2. Stock Balances (Grouped by Site)'],
                writeDetails: ['- Internal Transfer movements', '- Manual Stock Adjustment logs']
            };
        }
        if (pathname.includes('/admin/crm')) {
            return {
                title: 'Relationship Management',
                description: 'Supplier and Customer master data. Links to financial sub-ledgers.',
                linkage: [
                    'Auto-Ledger Creation: Enabled',
                    'Balance Type: Debit/Credit linked to COA'
                ],
                readDetails: ['1. Contact Master (Client/Supplier)', '2. Transaction History (Commercial)', '3. Financial Aging Report'],
                writeDetails: ['- Update Contact profile', '- Set Credit Limits', '- Link to Accounting Sub-ledger']
            };
        }
        if (pathname.includes('/admin/purchases/new')) {
            return {
                title: 'Purchase Entrance Logic',
                description: 'Detects if company is TTC or HT. Calculates Effective Cost based on VAT recoverability.',
                linkage: [
                    ...settingsInfo,
                    'Local Context: ' + viewScope
                ],
                readDetails: ['1. FinancialSettings from TSF_DB', '2. Site/WH Hierarchy (WHERE site.isActive=1)', '3. Supplier Price lists'],
                writeDetails: ['- prisma.$transaction (Commercial + Finance)', '- Create JournalEntry (Double-Entry Law)', '- Update Inventory Stock Balances', '- Recalculate and Sync HT/TTC Price Components']
            };
        }
        if (pathname === '/admin/finance/settings') {
            return {
                title: 'Finance Settings Control',
                description: 'Master configuration for the accounting brain. Locked when fiscal year is open.',
                linkage: [
                    ...settingsInfo,
                    'Model: FinancialSettings'
                ],
                readDetails: ['1. FinancialSettings record #1', '2. Fiscal Year Lock Status'],
                writeDetails: ['- Atomic update of logic flags', '- Flush engine cache']
            };
        }
        return {
            title: 'System Node',
            description: 'Standard administrative view linked to global brain.',
            linkage: [...settingsInfo, 'Scope: ' + viewScope],
            readDetails: ['Generic Node data sync'],
            writeDetails: ['Log navigation event']
        };
    };

    const logic = getPageLogic();

    return (
        <div className="fixed bottom-6 right-6 z-[9999] font-sans">
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group"
                >
                    <Activity size={24} className="group-hover:animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full"></div>
                </button>
            ) : (
                <div className="w-[450px] bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white shrink-0">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-black tracking-tight">System Audit</h3>
                                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Dev Mode Terminal</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                                <div className={`p-2 rounded-lg ${viewScope === 'OFFICIAL' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                    <ShieldCheck size={16} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-indigo-200 leading-none">View Scope</p>
                                    <p className="text-sm font-black mt-1 leading-none">{viewScope}</p>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                                <div className="p-2 rounded-lg bg-indigo-500">
                                    <Database size={16} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-indigo-200 leading-none">Ledger Status</p>
                                    <p className="text-sm font-black mt-1 leading-none">{recentLedger.length} Recent</p>
                                </div>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-1 mt-6 bg-black/10 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('logic')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'logic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                Page Logic
                            </button>
                            <button
                                onClick={() => setActiveTab('ledger')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                Ledger Audit
                            </button>
                            <button
                                onClick={() => setActiveTab('flow')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'flow' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/60 hover:text-white'}`}
                            >
                                Inspector
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {activeTab === 'logic' ? (
                                <>
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info size={14} className="text-indigo-600" />
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{logic.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                                            {logic.description}
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Settings size={14} className="text-gray-400" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active Linkages</span>
                                        </div>
                                        <div className="space-y-2">
                                            {logic.linkage.map((item, i) => (
                                                <div key={i} className="flex items-start gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                                    <ChevronRight size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                                                    <span className="text-[11px] font-bold text-gray-700">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Bug size={14} className="text-indigo-600" />
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Integration Status</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                                <span className="text-xs font-black text-emerald-700">Linkage Verified</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : activeTab === 'flow' ? (
                                <InspectorTab
                                    readDetails={logic.readDetails || []}
                                    writeDetails={logic.writeDetails || []}
                                />
                            ) : (
                                <LedgerTab recentLedger={recentLedger} />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0 text-[10px] font-bold text-gray-400 font-mono">
                        <span>P: {pathname}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-indigo-400">v1.1.0-inspector</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InspectorTab({ readDetails, writeDetails }: { readDetails: string[], writeDetails: string[] }) {
    const { lastOperation } = useDev();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Page Inspector</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Interactive</span>
                </div>
            </div>

            <div className="space-y-4">
                {/* READ Section */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-white border-b border-gray-100 flex items-center gap-2">
                        <ArrowDownCircle size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 uppercase">Input / Data Reading</span>
                    </div>
                    <div className="p-4">
                        <p className="text-[11px] font-bold text-gray-700 leading-relaxed">
                            On page mount, he is reading:
                        </p>
                        <div className="mt-2 space-y-1">
                            {readDetails.map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-white p-2 rounded-lg border border-gray-100 italic">
                                    <span>{detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* WRITE Section */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-white border-b border-gray-100 flex items-center gap-2">
                        <ArrowUpCircle size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Output / Data Saving</span>
                    </div>
                    <div className="p-4">
                        <p className="text-[11px] font-bold text-gray-700 leading-relaxed">
                            On save, he will execute:
                        </p>
                        <div className="mt-2 space-y-1">
                            {writeDetails.map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-white p-2 rounded-lg border border-gray-100 italic">
                                    <span>{detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* LAST RESULT */}
                {lastOperation && (
                    <div className={`rounded-2xl border p-4 animate-in fade-in slide-in-from-top-2 duration-500 ${lastOperation.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${lastOperation.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            <span className={`text-[10px] font-black uppercase ${lastOperation.status === 'SUCCESS' ? 'text-emerald-700' : 'text-rose-700'}`}>Last Transaction Result</span>
                        </div>
                        <p className="text-[11px] font-black text-gray-900">{lastOperation.details}</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-2 uppercase">{new Date(lastOperation.timestamp).toLocaleTimeString()}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function LedgerTab({ recentLedger }: { recentLedger: any[] }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Database size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Last 5 Journal Entries</span>
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">Live from DB</span>
            </div>

            <div className="space-y-4">
                {recentLedger.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium">
                        No recent transactions found.
                    </div>
                ) : (
                    recentLedger.map((entry) => (
                        <div key={entry.id} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:border-indigo-200 transition-colors">
                            <div className="p-3 bg-white border-b border-gray-100 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">{entry.reference}</span>
                                    <span className="text-[9px] text-gray-400 font-bold">{new Date(entry.transactionDate).toLocaleString()}</span>
                                </div>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {entry.status}
                                </span>
                            </div>
                            <div className="p-3">
                                <p className="text-[11px] font-bold text-gray-700 mb-2 truncate">{entry.description}</p>
                                <div className="space-y-1.5 font-mono">
                                    {entry.lines.map((line: any) => (
                                        <div key={line.id} className="flex justify-between items-center text-[9px] leading-none py-1 border-b border-gray-50 last:border-0">
                                            <div className="flex gap-2">
                                                <span className="text-gray-400 w-8">{line.account?.code}</span>
                                                <span className="text-gray-600 truncate max-w-[150px]">{line.account?.name}</span>
                                            </div>
                                            <div className="flex gap-4">
                                                <span className={line.debit > 0 ? 'text-emerald-600 font-black' : 'text-transparent'}>
                                                    {Number(line.debit).toFixed(2)}
                                                </span>
                                                <span className={line.credit > 0 ? 'text-rose-600 font-black' : 'text-transparent'}>
                                                    {Number(line.credit).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
