
import { PrismaClient } from '@prisma/client'
import { createFinancialEvent, postFinancialEvent } from '../src/app/actions/finance/financial-events'
import { getPostingRules, savePostingRules } from '../src/app/actions/finance/posting-rules'

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Starting Financial Events Verification...")

    // 0. Setup: Ensure Posting Rules for Partners are set
    console.log("⚙️  Configuring Posting Rules...")
    const rules = await getPostingRules()

    // Ensure we have accounts. If not, create dummies or find existing.
    // Capital Account
    let capitalAcc = await prisma.chartOfAccount.findFirst({ where: { code: '1010' } })
    if (!capitalAcc) {
        capitalAcc = await prisma.chartOfAccount.create({
            data: { code: '1010', name: 'Partner Capital', type: 'EQUITY', isActive: true }
        })
    }

    // Cash Account (Ledger)
    let cashAcc = await prisma.chartOfAccount.findFirst({ where: { code: '5700' } })
    if (!cashAcc) {
        cashAcc = await prisma.chartOfAccount.create({
            data: { code: '5700', name: 'Main Cash', type: 'ASSET', subType: 'CASH', isActive: true }
        })
    }

    // Cash Account (Financial/Operational)
    let safeAcc = await prisma.financialAccount.findFirst({ where: { name: 'Main Safe' } })
    if (!safeAcc) {
        safeAcc = await prisma.financialAccount.create({
            data: { name: 'Main Safe', type: 'CASH', balance: 0, currency: 'USD' }
        })
    }

    // Update Rules
    rules.partners.capital = capitalAcc.id
    await savePostingRules(rules)
    console.log("✅ Posting Rules updated.")

    // 1. Create Partner Contact
    console.log("👤 Creating Partner...")
    let partner = await prisma.contact.findFirst({ where: { name: "Test Partner 1" } })
    if (!partner) {
        partner = await prisma.contact.create({
            data: {
                name: "Test Partner 1",
                type: "PARTNER"
            }
        })
    }
    console.log(`✅ Partner created/found: ${partner.name} (ID: ${partner.id})`)

    // 2. Create Event (Capital Injection)
    console.log("📝 Creating Financial Event (Capital Injection)...")
    const result = await createFinancialEvent({
        eventType: 'PARTNER_CAPITAL_INJECTION',
        amount: 5000,
        date: new Date(),
        contactId: partner.id,
        notes: "Initial Investment",
        currency: "USD"
    })

    if (!result.success || !result.eventId) {
        throw new Error("Failed to create event")
    }
    const eventId = result.eventId
    console.log(`✅ Event created (ID: ${eventId})`)

    // 3. Post Event
    console.log("📮 Posting Event...")
    // Pass Financial Account ID (for Transaction) AND Ledger Account ID (for Journal)
    const postResult = await postFinancialEvent(eventId, safeAcc.id, cashAcc.id)
    console.log("✅ Event Posted.")

    // 4. Verification
    console.log("🔍 Verifying Accounting...")

    // Check Event Status
    const event = await (prisma as any).financialEvent.findUnique({
        where: { id: eventId },
        include: { transaction: true, journalEntry: { include: { lines: true } } }
    })

    if (event?.status !== 'SETTLED') throw new Error(`Event Status wrong: ${event?.status}`)
    console.log("   - Event Status: SETTLED")

    // Check Transaction
    if (event.transaction?.amount.toNumber() !== 5000) throw new Error("Transaction Amount wrong")
    console.log("   - Transaction Created: 5000 USD")

    // Check Journal
    const lines = event.journalEntry?.lines || []
    const debitLine = lines.find((l: any) => l.debit.toNumber() === 5000)
    const creditLine = lines.find((l: any) => l.credit.toNumber() === 5000)

    if (debitLine?.accountId !== cashAcc.id) throw new Error("Debit Account wrong")
    if (creditLine?.accountId !== capitalAcc.id) throw new Error("Credit Account wrong")

    // Check Contact Link on Credit Line
    if (creditLine?.contactId !== partner.id) throw new Error("Partner Link missing on Journal Line")
    console.log("   - Journal Entry Correct: Dr Cash / Cr Capital (Linked to Partner)")

    // 5. Verify List Retrieval
    console.log("📋 Verifying List Action...")
    const { getFinancialEvents } = require('../src/app/actions/finance/financial-events')
    const list = await getFinancialEvents()
    if (!list || list.length === 0) throw new Error("List retrieval failed or empty")
    const found = list.find((e: any) => e.id === eventId)
    if (!found) throw new Error("Created event not found in list")
    console.log(`✅ List retrieved ${list.length} events, including new event #${eventId}`)

    console.log("🎉 VERIFICATION SUCCESSFUL!")
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
