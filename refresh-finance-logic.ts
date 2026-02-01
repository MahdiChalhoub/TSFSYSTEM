import { prisma } from "./src/lib/db";
import { importChartOfAccountsTemplate } from "./src/app/actions/finance/coa-templates";
import { applySmartPostingRules, getPostingRules } from "./src/app/actions/finance/posting-rules";

async function main() {
    console.log("♻️  Refreshing Finance Logic...");

    // 1. Re-import template to ensure 2102 exists
    console.log("Creating/Updating 2102 Accrued Liabilities...");
    await importChartOfAccountsTemplate('IFRS_COA');

    // 2. Refresh Posting Rules
    console.log("Applying Smart Posting Rules...");
    await applySmartPostingRules();

    const rules = await getPostingRules();
    console.log("✅ Current Rules Mapping:");
    console.log("- Inventory (Asset):", rules.sales.inventory);
    console.log("- Reception (Suspense):", rules.suspense.reception);
    console.log("- Adjustment (Expense):", rules.inventory.adjustment);
}

main()
    .catch((e) => {
        console.error("❌ Refresh Failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
