import { prisma } from "../src/lib/db"
import { applySmartPostingRules, getPostingRules, savePostingRules } from "../src/app/actions/finance/posting-rules"

async function main() {
    console.log("Checking accounts...")
    const accounts = await prisma.chartOfAccount.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true }
    })

    console.log("Total active accounts:", accounts.length)

    // Check if PARTNER_LOAN mapping exists
    const rules = await getPostingRules()
    console.log("Current Partner Loan mapping:", rules.partners.loan)

    if (!rules.partners.loan) {
        console.log("Searching for suitable Loan account...")
        // Look for common codes: 2500, 1600, 161, 2201, 10...
        const codes = ['2500', '1600', '161', '2201', '16', '25', '22']
        let targetId = null
        for (const code of codes) {
            const acc = accounts.find(a => a.code === code || a.code.startsWith(code + '.'))
            if (acc) {
                targetId = acc.id
                console.log(`Found candidate: ${acc.code} - ${acc.name} (ID: ${acc.id})`)
                break
            }
        }

        if (targetId) {
            rules.partners.loan = targetId
            await savePostingRules(rules)
            console.log("Successfully mapped partners.loan to account ID:", targetId)
        } else {
            console.log("No suitable loan account found. Please create one starting with 16, 22, or 25.")
        }
    } else {
        console.log("Posting rule already configured.")
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
