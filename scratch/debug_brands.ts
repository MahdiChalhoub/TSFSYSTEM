import { erpFetch } from "../src/lib/erp-api";

async function checkBrands() {
    try {
        console.log("Checking inventory/brands/...");
        const brands = await erpFetch("inventory/brands/");
        console.log("Response (inventory/brands/):", Array.isArray(brands) ? `Array of ${brands.length}` : typeof brands);
        if (Array.isArray(brands) && brands.length > 0) {
            console.log("First brand:", brands[0].name);
        }

        console.log("\nChecking brands/ (flat)...");
        const flatBrands = await erpFetch("brands/");
        console.log("Response (brands/):", Array.isArray(flatBrands) ? `Array of ${flatBrands.length}` : typeof flatBrands);

        console.log("\nChecking inventory/brands/?with_counts=true...");
        const countsBrands = await erpFetch("inventory/brands/?with_counts=true");
        console.log("Response (with_counts):", Array.isArray(countsBrands) ? `Array of ${countsBrands.length}` : typeof countsBrands);

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

checkBrands();
