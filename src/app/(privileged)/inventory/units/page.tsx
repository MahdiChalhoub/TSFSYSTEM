import { erpFetch } from "@/lib/erp-api";
import UnitsClient from "./UnitsClient";

export const dynamic = 'force-dynamic';

async function getUnitsData() {
  try {
    const units = await erpFetch('inventory/units/');
    return (Array.isArray(units) ? units : units?.results ?? []);
  } catch (e) {
    console.error("Failed to fetch units:", e);
    return [];
  }
}

export default async function UnitsPage() {
  const units = await getUnitsData();

  return (
    <div className="app-page p-4 md:p-6" style={{ height: '100%' }}>
      <UnitsClient initialUnits={units} />
    </div>
  )
}
