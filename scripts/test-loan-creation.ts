import { prisma } from "../src/lib/db"
import { createLoanContract } from "../src/app/actions/finance/loans"

async function main() {
    console.log("Testing Loan Creation...")

    // Find a partner
    const partner = await prisma.contact.findFirst({
        where: { type: 'PARTNER' }
    })

    if (!partner) {
        console.error("No partner found. Please create a partner first.")
        process.exit(1)
    }

    console.log(`Using Partner: ${partner.name} (ID: ${partner.id})`)

    try {
        const res = await createLoanContract({
            contactId: partner.id,
            principalAmount: 1000,
            interestRate: 5,
            interestType: 'SIMPLE',
            termMonths: 12,
            startDate: new Date(),
            paymentFrequency: 'MONTHLY'
        })

        if (res.success) {
            console.log("Success! Loan created with ID:", res.loanId)

            // Verify installments
            const installments = await (prisma as any).loanInstallment.count({
                where: { loanId: res.loanId }
            })
            console.log(`Verified: ${installments} installments created.`)
        } else {
            console.error("Failed:", res)
        }
    } catch (e: any) {
        console.error("Error catch:", e.message)
        if (e.stack) console.error(e.stack)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
