import { getRefCountries, getRefCurrencies, getOrgCountries, getOrgCurrencies } from "@/app/actions/reference";
import RegionalSettingsClient from "./client";

// `force-dynamic` removed: the page is *naturally* dynamic (it reads
// auth cookies via erpFetch), but forcing it skipped the App Router's
// segment cache and re-rendered the entire tree every visit. The four
// SSR fetches now use `next: { revalidate, tags }` so they're cached
// per-user (auth header in the cache key) and tag-revalidate on writes.

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
