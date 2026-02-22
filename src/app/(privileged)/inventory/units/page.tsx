import { erpFetch } from "@/lib/erp-api";
import { UnitsClient } from "./UnitsClient";

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        const units = await erpFetch('units/');
        return (units as any[]) || [];
    } catch (e) {
        console.error("Failed to fetch units:", e);
        return [];
    }
}

export default async function UnitsPage() {
    const units = await getUnitsData();

    return (
        <UnitsClient initialUnits={units} />
    );
}