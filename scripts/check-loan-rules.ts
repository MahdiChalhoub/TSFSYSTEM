import { prisma } from "../src/lib/db"
import { getPostingRules } from "../src/app/actions/finance/posting-rules"

async function main() {
    const rules = await getPostingRules()
    console.log("Current Posting Rules (Partners Section):")
    console.log(JSON.stringify(rules.partners, null, 2))

    if (rules.partners.loan) {
        const account = await prisma.chartOfAccount.findUnique({
            where: { id: rules.partners.loan }
        })
        console.log(`Mapped Account: ${account?.code} - ${account?.name}`)
    } else {
        console.warn("PARTNER_LOAN IS NOT MAPPED!")

        // Try to find a suitable one
        const fallback = await prisma.chartOfAccount.findFirst({
            where: {
                OR: [
                    { code: { startsWith: '16' } },
                    { code: { startsWith: '22' } },
                    { code: { startsWith: '25' } },
                    { name: { contains: 'Loan' } }
                ]
            }
        })
        if (fallback) {
            console.log(`Suggested Fallback: ${fallback.id} (${fallback.code} - ${fallback.name})`)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
