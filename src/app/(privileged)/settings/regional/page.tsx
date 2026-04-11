import { getRefCountries, getRefCurrencies, getOrgCountries, getOrgCurrencies } from "@/app/actions/reference";
import RegionalSettingsClient from "./client";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Regional Settings — TSFSYSTEM',
    description: 'Manage countries and currencies for your organization',
};

export default async function RegionalSettingsPage() {
    const [allCountries, allCurrencies, orgCountries, orgCurrencies] = await Promise.all([
        getRefCountries().catch(() => []),
        getRefCurrencies().catch(() => []),
        getOrgCountries().catch(() => []),
        getOrgCurrencies().catch(() => []),
    ]);

    return (
        <RegionalSettingsClient
            allCountries={Array.isArray(allCountries) ? allCountries : []}
            allCurrencies={Array.isArray(allCurrencies) ? allCurrencies : []}
            initialOrgCountries={Array.isArray(orgCountries) ? orgCountries : []}
            initialOrgCurrencies={Array.isArray(orgCurrencies) ? orgCurrencies : []}
        />
    );
}
