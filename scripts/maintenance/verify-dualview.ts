import { prisma } from './src/lib/db'
import { processSale } from './src/app/admin/sales/actions'
import { recalculateAccountBalances } from './src/app/actions/finance/ledger'

async function testDualView() {
    console.log("🚀 Testing Dual View (Official vs Internal)...")

    // 1. Setup: Reset balances
    await recalculateAccountBalances()

    // 2. Fetch or Create test user with a cash drawer
    let user = await prisma.user.findFirst({ where: { email: 'admin@tsfci.com' } })
    if (!user) {
        console.log("Admin user missing, check seed.")
        return
    }

    // Ensure user has a cash register assigned for the test
    const cashRegister = await prisma.financialAccount.findFirst({ where: { type: 'CASH' } })
    if (cashRegister) {
        await prisma.user.update({
            where: { id: user.id },
            data: { cashRegisterId: cashRegister.id }
        })
    }

    // 3. Process an OFFICIAL Sale ($100)
    console.log("Step 1: Processing OFFICIAL Sale ($100)...")
    await processSale({
        cart: [
            { productId: 1, name: 'Test Product', price: 100, quantity: 1, taxRate: 0, isTaxIncluded: true }
        ],
        paymentMethod: 'CASH',
        totalAmount: 100,
        scope: 'OFFICIAL',
        _userId: user.id
    })

    // 4. Process an INTERNAL Sale ($50)
    console.log("Step 2: Processing INTERNAL Sale ($50)...")
    await processSale({
        cart: [
            { productId: 1, name: 'Internal Product', price: 50, quantity: 1, taxRate: 0, isTaxIncluded: true }
        ],
        paymentMethod: 'CASH',
        totalAmount: 50,
        scope: 'INTERNAL',
        _userId: user.id
    })

    // 5. Verify Balances
    const revenueAccount = await prisma.chartOfAccount.findFirst({ where: { code: '7011' } }) // Assuming standard sales revenue
    if (!revenueAccount) {
        console.log("Revenue account 7011 not found, finding any INCOME account...")
    }

    const cashLedger = await prisma.chartOfAccount.findFirst({ where: { subType: 'CASH' } })

    console.log("\n📊 BALANCE VERIFICATION:")
    console.log("------------------------")
    if (cashLedger) {
        console.log(`Cash Account [${cashLedger.code}]:`)
        console.log(`  Consolidated (Real): $${cashLedger.balance}`)
        console.log(`  Official (Declared): $${cashLedger.balanceOfficial}`)

        const bReal = Number(cashLedger.balance)
        const bOff = Number(cashLedger.balanceOfficial)

        if (bReal === 150 && bOff === 100) {
            console.log("\n✅ SUCCESS: Dual View logic confirmed!")
            console.log("   - Official reflects only the $100 sale.")
            console.log("   - Management reflects $100 + $50 = $150.")
        } else {
            console.log("\n❌ FAILURE: Balances do not match expected values.")
        }
    }
}

testDualView().catch(console.error)
