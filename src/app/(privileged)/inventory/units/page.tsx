import { erpFetch } from "@/lib/erp-api";
import UnitsClient from "./UnitsClient";

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        // Use namespaced path to avoid potential route conflicts
        const response = await erpFetch('inventory/units/');
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