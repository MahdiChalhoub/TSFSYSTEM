import { Paintbrush } from 'lucide-react';
import { getOrgDefaultTheme } from '@/app/actions/settings/theme';
import { OrgThemeSettings } from './OrgThemeSettings';

export const metadata = {
    title: 'Appearance Settings — TSFSYSTEM',
};

export default async function AppearancePage() {
    const orgDefaultTheme = await getOrgDefaultTheme();

    return (
        <div className="page-container">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <div
                    className="w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-lg flex-shrink-0"
                    style={{ background: 'var(--app-primary)', boxShadow: 'var(--app-glow)' }}
                >
                    <Paintbrush size={26} className="text-white" />
                </div>
                <div>
                    <h1 className="page-header-title flex items-center gap-3">
                        Appearance &amp; <span style={{ color: 'var(--app-primary)' }}>Theme</span>
                    </h1>
                    <p className="page-header-subtitle mt-1">
                        Customise the visual identity of your workspace for all users.
                    </p>
                </div>
            </header>

            {/* Org default theme panel */}
            <OrgThemeSettings currentOrgDefault={orgDefaultTheme} />
        </div>
    );
}
