// @ts-nocheck
import { getRefCountries, getRefCurrencies, getOrgCountries, getOrgCurrencies } from "@/app/actions/reference";
import RegionalSettingsClient from "./client";
import { Globe2 } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Regional Settings — TSFSYSTEM',
    description: 'Manage countries and currencies for your organization',
};

export default async function RegionalSettingsPage() {
    const [allCountries, allCurrencies, orgCountries, orgCurrencies] = await Promise.all([
        getRefCountries(),
        getRefCurrencies(),
        getOrgCountries(),
        getOrgCurrencies(),
    ]);

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1200px] mx-auto space-y-[var(--layout-section-spacing)]">
                <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    ← Back to Settings
                </Link>

                <header className="flex items-center gap-3 md:gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shadow-sm border border-blue-100 dark:border-blue-800/50">
                        <Globe2 size={28} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Settings</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight theme-text">
                            Regional <span className="text-blue-500">Settings</span>
                        </h1>
                        <p className="text-xs theme-text-muted mt-0.5">Manage countries and currencies for your organization</p>
                    </div>
                </header>

                <RegionalSettingsClient
                    allCountries={allCountries}
                    allCurrencies={allCurrencies}
                    initialOrgCountries={orgCountries}
                    initialOrgCurrencies={orgCurrencies}
                />
            </div>
        </main>
    );
}
