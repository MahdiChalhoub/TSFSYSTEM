import { getActiveSettingsPanels } from '@/lib/module-registry';
import { SafeModuleBoundary } from '@/components/SafeModuleBoundary';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    // [TEMPORARY] Simulate installed modules (Same as Dashboard)
    // We add 'core' explicitly here because it's always installed
    const installedModuleCodes = ['core', 'inventory', 'sales', 'finance', 'crm'];

    const SettingsPanels = getActiveSettingsPanels(installedModuleCodes);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
                <p className="text-gray-500 mt-1">Manage your organization profile, identity, and module configurations.</p>
            </div>

            {/* Dynamic Module Settings (Including Core Business Profile) */}
            {SettingsPanels.map((Panel, i) => (
                <SafeModuleBoundary key={i} moduleName="Settings Panel">
                    <Panel />
                </SafeModuleBoundary>
            ))}
        </div>
    );
}
