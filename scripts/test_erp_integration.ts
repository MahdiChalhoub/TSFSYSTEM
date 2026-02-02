import { getChartOfAccounts } from '../src/app/actions/finance/accounts';
import { getGlobalInventory } from '../src/app/actions/inventory/viewer';

async function test() {
    console.log("--- Testing Chart of Accounts ---");
    try {
        // Mocking the headers/subdomain by providing context if needed 
        // But getTenantContext in erp-api.ts uses next/headers which requires a request context.
        // This won't work easily in a standalone script without mocking 'next/headers'.
        console.log("Note: This script requires a request context to work correctly with getTenantContext.");
    } catch (e) {
        console.error(e);
    }
}

test();
