/**
 * ModuleGate — Route Guard for Module Pages
 * ============================================
 * Wrap module page content to block access if the module
 * is not enabled for the current tenant.
 * 
 * Usage:
 *   <ModuleGate module="inventory">
 *     <InventoryPage />
 *   </ModuleGate>
 */

'use client';

import { useEffect, useState } from 'react';
import { getActiveModules } from '@/app/actions/saas/modules';
import { ShieldX, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ModuleGateProps {
    module: string;           // module code e.g. 'inventory', 'finance'
    moduleName?: string;      // display name e.g. 'Inventory'
    children: React.ReactNode;
}

export default function ModuleGate({ module, moduleName, children }: ModuleGateProps) {
    const [state, setState] = useState<'loading' | 'allowed' | 'blocked'>('loading');

    useEffect(() => {
        async function check() {
            try {
                const enabledCodes = await getActiveModules();
                if (enabledCodes.includes(module) || module === 'core') {
                    setState('allowed');
                } else {
                    setState('blocked');
                }
            } catch {
                // If we can't fetch modules, allow access (fail-open for usability)
                setState('allowed');
            }
        }
        check();
    }, [module]);

    if (state === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (state === 'blocked') {
        const displayName = moduleName || module.charAt(0).toUpperCase() + module.slice(1);
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mb-6">
                    <ShieldX className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Module Not Available
                </h2>
                <p className="text-gray-500 max-w-md mb-6">
                    The <strong>{displayName}</strong> module is not enabled for your organization.
                    Contact your administrator to activate it.
                </p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    return <>{children}</>;
}
