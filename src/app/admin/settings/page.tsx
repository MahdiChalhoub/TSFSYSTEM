import { getActiveSettingsPanels } from '@/lib/module-registry';
import { SafeModuleBoundary } from '@/components/SafeModuleBoundary';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    // [TEMPORARY] Simulate installed modules (Same as Dashboard)
    // We add 'core' explicitly here because it's always installed
    const installedModuleCodes = ['core', 'inventory', 'sales', 'finance', 'crm'];

    const SettingsPanels = getActiveSettingsPanels(installedModuleCodes);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <div className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in duration-700">

                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Configuration</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3">
                        System Configuration
                    </h1>
                    <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
                        Manage your organization profile, identity, and fine-tune installed module behaviors.
                    </p>
                </div>

                {/* Settings Stack */}
                <div className="space-y-8 relative">
                    {/* Decorator Line */}
                    <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-gray-200/50 -z-10 hidden md:block"></div>

                    {/* Dynamic Module Settings (Including Core Business Profile) */}
                    {SettingsPanels.map((Panel, i) => (
                        <SafeModuleBoundary key={i} moduleName="Settings Panel">
                            <div className="relative">
                                {/* Timeline Dot */}
                                <div className="absolute left-8 top-8 w-3 h-3 rounded-full bg-white border-4 border-gray-100 -translate-x-1.5 hidden md:block"></div>

                                <div className="md:pl-20 transition-all duration-500 hover:translate-x-1">
                                    <Panel />
                                </div>
                            </div>
                        </SafeModuleBoundary>
                    ))}
                </div>

                {/* Footer Tip */}
                <div className="mt-16 text-center">
                    <p className="text-sm text-gray-400 font-medium bg-gray-100 inline-block px-4 py-2 rounded-full">
                        Need more capabilities? Visit the <span className="text-gray-600 font-bold">Module Marketplace</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
