import { erpFetch } from "@/lib/erp-api";
import UnitsClient from "./UnitsClient";

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        const response = await erpFetch('units/');
        // Handle both array and paginated { results: [...] } responses
        const units = Array.isArray(response) ? response : (response?.results ?? []);
        return units;
    } catch (e) {
        console.error("[UNITS PAGE] FAILED:", e);
        return [];
    }
}

export default async function UnitsPage() {
    const flatUnits = await getUnitsData();
    return <UnitsClient initialUnits={flatUnits} />;
}