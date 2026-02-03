import { getActiveSettingsPanels } from '@/lib/module-registry';
import { SafeModuleBoundary } from '@/components/SafeModuleBoundary';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    // [TEMPORARY] Simulate installed modules (Same as Dashboard)
    const installedModuleCodes = ['inventory', 'sales', 'finance', 'crm']; // TODO: Fetch from DB

    const SettingsPanels = getActiveSettingsPanels(installedModuleCodes);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
                <p className="text-gray-500 mt-1">Configure application behavior and defaults</p>
            </div>

            {/* Core Settings (Always Visible) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">General Configuration</h2>
                <div className="text-sm text-gray-500 italic">
                    Global platform settings (Users, Roles, Localization) will appear here.
                </div>
            </div>

            {/* Dynamic Module Settings */}
            {SettingsPanels.map((Panel, i) => (
                <SafeModuleBoundary key={i} moduleName="Settings Panel">
                    <Panel />
                </SafeModuleBoundary>
            ))}
        </div>
    );
}
