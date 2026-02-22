import { erpFetch } from "@/lib/erp-api";
import { CountriesClient } from "./CountriesClient";

export const dynamic = 'force-dynamic';

async function getCountriesData() {
    try {
        const countries = await erpFetch('countries/');
        return (countries as any[]).map((c: any) => ({
            ...c,
            product_count: c.product_count || 0,
            brands: c.brands || []
        }));
    } catch (e) {
        console.error("Failed to fetch countries:", e);
        return [];
    }
}

export default async function CountriesPage() {
    const countries = await getCountriesData();

    return (
        <CountriesClient initialCountries={countries} />
    );
}