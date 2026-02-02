import { prisma } from "./src/lib/db";
import { receiveStock } from "./src/app/actions/inventory/movements";
import { getInventoryFinancialStatus } from "./src/app/actions/finance/inventory-integration";

async function testValuation() {
    console.log("🧪 Starting Valuation Test...");

    // 1. Pick a product and warehouse
    const product = await prisma.product.findFirst({
        where: { unitId: { not: null } }
    });
    const warehouse = await prisma.warehouse.findFirst();
    const unit = await prisma.unit.findFirst({ where: { id: product?.unitId || undefined } });

    if (!product || !warehouse || !unit) {
        console.error("❌ Test setup failed: Need at least 1 product, 1 warehouse, and units.");
        return;
    }

    console.log(`📦 Testing with Product: ${product.name} (Base Unit: ${unit.code})`);

    // 2. Initial Status
    const initial = await getInventoryFinancialStatus();
    console.log(`📉 Initial Valuation: ${initial.totalValue} | Ledger: ${initial.ledgerBalance}`);

    // 3. Receive Stock (Simulate 10 units at $15 each)
    console.log("📥 Receiving 10 units @ $15.00...");
    const res = await receiveStock(
        product.id,
        warehouse.id,
        10,
        unit.id,
        15.00,
        "TEST-RECEPTION-01"
    );

    if (res.success) {
        console.log("✅ Reception successful!");
    } else {
        console.error("❌ Reception failed:", res.message);
        return;
    }

    // 4. Verification
    const final = await getInventoryFinancialStatus();
    console.log(`📈 Final Valuation: ${final.totalValue} | Ledger: ${final.ledgerBalance}`);

    const diffVal = final.totalValue - initial.totalValue;
    const diffLedger = final.ledgerBalance - initial.ledgerBalance;

    if (Math.abs(diffVal - 150) < 0.01 && Math.abs(diffLedger - 150) < 0.01) {
        console.log("🏆 SUCCESS: Valuation and Ledger increased by exactly $150.00!");
    } else {
        console.warn(`⚠️ Mismatch: Value Diff: ${diffVal}, Ledger Diff: ${diffLedger} (Expected 150)`);
    }

    // 5. Check AMC update
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`📊 New Product AMC: ${updatedProd?.costPrice}`);
}

testValuation()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
