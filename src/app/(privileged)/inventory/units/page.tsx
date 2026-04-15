import { erpFetch } from "@/lib/erp-api";
import UnitsClient from "./UnitsClient";

export const dynamic = 'force-dynamic';

async function getUnitsData() {
    try {
        const units = await erpFetch('units/');
        return Array.isArray(units) ? units : [];
    } catch (e) {
        console.error("[UNITS PAGE] FAILED:", e);
        return [];
    }
}

export default async function UnitsPage() {
    const flatUnits = await getUnitsData();
    return <UnitsClient initialUnits={flatUnits} />;
}