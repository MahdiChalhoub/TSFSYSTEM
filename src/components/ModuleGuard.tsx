'use client';

import { useEffect, useState } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { Package, ArrowUpCircle, Lock } from 'lucide-react';

interface ModuleGuardProps {
    moduleCode: string;
    moduleName: string;
    children: React.ReactNode;
}

/**
 * ModuleGuard - Graceful degradation for module-dependent pages.
 * Shows a friendly "module required" message when the module is not installed.
 * When the module IS installed, renders children normally.
 */
export function ModuleGuard({ moduleCode, moduleName, children }: ModuleGuardProps) {
    const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading');

    useEffect(() => {
        async function checkModule() {
            try {
                // Check if module is enabled for current organization
                const res = await erpFetch(`modules/${moduleCode}/status/`);
                setStatus(res?.is_enabled ? 'enabled' : 'disabled');
            } catch (e) {
                // If endpoint fails or module doesn't exist, assume disabled
                setStatus('disabled');
            }
        }
        checkModule();
    }, [moduleCode]);

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-pulse flex flex-col items-center gap-3">
                    <Package className="w-12 h-12 text-gray-300" />
                    <span className="text-gray-400">Checking module status...</span>
                </div>
            </div>
        );
    }

    if (status === 'disabled') {
        return (
            <div className="flex items-center justify-center min-h-[60vh] p-8">
                <div className="max-w-md text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200">
                        <Lock className="w-10 h-10 text-amber-500" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {moduleName} Module Required
                        </h2>
                        <p className="text-gray-500">
                            This feature is currently suspended.
                            Please install or update the <strong>{moduleName}</strong> module to access this functionality.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <ArrowUpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span>
                                Contact your administrator or go to
                                <a href="/saas/modules" className="text-emerald-600 font-medium hover:underline ml-1">
                                    Module Management
                                </a> to install this module.
                            </span>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400">
                        Module code: <code className="bg-gray-100 px-2 py-0.5 rounded">{moduleCode}</code>
                    </p>
                </div>
            </div>
        );
    }

    // Module is enabled - render children normally
    return <>{children}</>;
}

/**
 * Hook to check if a module is enabled.
 * Returns: { isEnabled: boolean, isLoading: boolean }
 */
export function useModuleStatus(moduleCode: string) {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function check() {
            try {
                const res = await erpFetch(`modules/${moduleCode}/status/`);
                setIsEnabled(res?.is_enabled ?? false);
            } catch {
                setIsEnabled(false);
            } finally {
                setIsLoading(false);
            }
        }
        check();
    }, [moduleCode]);

    return { isEnabled, isLoading };
}
