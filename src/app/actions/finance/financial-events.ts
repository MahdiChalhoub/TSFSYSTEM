'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { createJournalEntry, JournalLineInput } from "./ledger"
import { getPostingRules } from "./posting-rules"

export type FinancialEventInput = {
    eventType: 'PARTNER_CAPITAL_INJECTION' | 'PARTNER_LOAN' | 'PARTNER_WITHDRAWAL' | 'REFUND_RECEIVED'
    amount: number
    date: Date
    reference?: string
    notes?: string
    contactId?: number
    currency?: string
    // Simplified for now: We assume Cash/Bank is handled via a Transaction logic or we create it here directly
    // Ideally user selects "Deposit to: Cash Drawer"
    targetAccountId?: number
}

export async function getFinancialEvents(type?: FinancialEventInput['eventType']) {
    return await (prisma as any).financialEvent.findMany({
        where: type ? { eventType: type } : {},
        orderBy: { date: 'desc' },
        include: {
            contact: true,
            transaction: true,
            journalEntry: true
        }
    })
}

export async function getFinancialEvent(id: number) {
    return await (prisma as any).financialEvent.findUnique({
        where: { id },
        include: {
            contact: true,
            transaction: true,
            journalEntry: {
                include: { lines: { include: { account: true, contact: true } } }
            }
        }
    })
}

export async function createFinancialEvent(data: FinancialEventInput, tx?: any) {
    const db = tx || prisma
    // 1. Validate
    if (!data.contactId) throw new Error("Partner/Contact is required for Financial Events")

    // 2. Create Draft
    const event = await (db as any).financialEvent.create({
        data: {
            eventType: data.eventType,
            amount: data.amount,
            currency: data.currency || 'USD',
            date: data.date,
            reference: data.reference,
            notes: data.notes,
            contactId: data.contactId,
            status: 'DRAFT'
        }
    })

    try {
        revalidatePath('/admin/finance/events')
    } catch (e) { /* Standalone Script safe */ }
    return { success: true, eventId: event.id }
}

export async function updateFinancialEvent(id: number, data: Partial<FinancialEventInput>) {
    const existing = await (prisma as any).financialEvent.findUnique({ where: { id } })
    if (!existing) throw new Error("Event not found")
    if (existing.status !== 'DRAFT') throw new Error("Cannot edit a processed event")

    await (prisma as any).financialEvent.update({
        where: { id },
        data: {
            amount: data.amount,
            date: data.date,
            reference: data.reference,
            notes: data.notes,
            contactId: data.contactId
        }
    })

    try {
        revalidatePath('/admin/finance/events')
    } catch (e) { /* Standalone Script safe */ }
    return { success: true }
}

export async function postFinancialEvent(id: number, financialAccountId: number, ledgerAccountId: number) {
    return await prisma.$transaction(async (tx) => {
        // 1. Get Event
        const event = await (tx as any).financialEvent.findUnique({
            where: { id },
            include: { contact: true }
        })
        if (!event) throw new Error("Event not found")
        if (event.status !== 'DRAFT') throw new Error("Event already processed")

        // 2. Load Mapping Rules
        const rules = await getPostingRules(tx)
        const partners = rules.partners
        const contact = event.contact

        // 3. Determine Accounts
        let debitAccount: number | null = null
        let creditAccount: number | null = null
        let description = event.notes || event.eventType

        // 3a. Target Accounts
        const moneyTransactionId = financialAccountId
        const moneyLedgerId = ledgerAccountId

        // 3b. Logic per Type
        switch (event.eventType) {
            case 'PARTNER_CAPITAL_INJECTION':
                // Dr Cash, Cr Capital
                debitAccount = moneyLedgerId
                creditAccount = partners.capital
                description = `Capital Injection from ${contact?.name}`
                break

            case 'PARTNER_LOAN':
                // Dr Cash, Cr Loan Payable
                debitAccount = moneyLedgerId
                creditAccount = partners.loan
                description = `Loan received from ${contact?.name}`
                break

            case 'PARTNER_WITHDRAWAL':
                // Dr Partner Current/Withdrawal, Cr Cash
                debitAccount = partners.withdrawal
                creditAccount = moneyLedgerId
                description = `Withdrawal by ${contact?.name}`
                break

            case 'REFUND_RECEIVED':
                // Dr Cash, Cr Expense/Supplier/Tax
                // Complex: usually credits the Supplier Account (AP) or specific Expense
                // For simplified "Cash Refund", we Credit Supplier Control Account
                debitAccount = moneyLedgerId
                creditAccount = rules.purchases.payable // Credit the supplier (reduce what we paid them, or create credit balance)
                description = `Refund received from ${contact?.name}`
                break
        }

        if (!debitAccount || !creditAccount) {
            throw new Error(`Missing Account Mapping for ${event.eventType}. Please configure Posting Rules.`)
        }

        // 4. Create Transaction (Voucher) - The Money Movement
        // This validates the Cash Account side
        const transaction = await tx.transaction.create({
            data: {
                accountId: moneyTransactionId,
                amount: event.amount, // TODO: Handle sign? Usually absolute amount with Type
                type: (event.eventType === 'PARTNER_WITHDRAWAL') ? 'CREDIT' : 'DEBIT', // Credit Cash on withdrawal, Debit Cash on receipt
                description: description,
                referenceId: `EVT-${event.id}`,
                financialEvent: { connect: { id: event.id } } // Connect strictly
            } as any
        })

        // 5. Create Journal Entry (GL) - The Double Entry
        const lines: JournalLineInput[] = [
            {
                accountId: debitAccount,
                debit: Number(event.amount),
                credit: 0,
                description: description
            },
            {
                accountId: creditAccount,
                debit: 0,
                credit: Number(event.amount),
                description: description
            }
        ]

        // Add Contact Traceability to the relevant line
        // Only add contactId to the Partner/Supplier account line, not the Cash account line (unless needed)
        // Usually, Capital/Loan/Supplier accounts track the Contact.
        if (event.eventType === 'PARTNER_CAPITAL_INJECTION') lines[1].contactId = event.contactId // Credit Capital
        if (event.eventType === 'PARTNER_LOAN') lines[1].contactId = event.contactId // Credit Loan
        if (event.eventType === 'PARTNER_WITHDRAWAL') lines[0].contactId = event.contactId // Debit Withdrawal
        if (event.eventType === 'REFUND_RECEIVED') lines[1].contactId = event.contactId // Credit Supplier (AP)

        // Post to Ledger
        // We reuse the createJournalEntry logic but pass the tx
        // Note: Ledger function needs to accept 'tx'
        // For now, we manually call create because we are inside a transaction and 'createJournalEntry' might start its own if not careful
        // But our 'createJournalEntry' supports tx. Let's refer to Step 11. Yes, it supports tx.

        // We CANNOT import createJournalEntry easily if it's a server action file itself? 
        // It's in the same directory.
        // We will call it. 
        // NOTE: createJournalEntry takes a complex object.

        // Wait, 'lines' in createJournalEntry do not assume 'contactId' in the types exported?
        // Let's check 'JournalLineInput' in ledger.ts
        // In Step 11: `export type JournalLineInput = { accountId: number, debit: number, credit: number, description?: string }`
        // It DOES NOT have contactId.
        // I need to update JournalLineInput in ledger.ts to support contactId?
        // Or I manually create the entry here to ensure contactId is saved.
        // Since I want strict Contact tracing, I should manual create or update strict types.
        // Let's manually create to avoid modifying ledger.ts types right now (or I can cast).

        // Manual Create Journal Entry
        // First find FY (Reusing logic is better, but simple find here)
        const fy = await tx.fiscalYear.findFirst({
            where: { startDate: { lte: event.date }, endDate: { gte: event.date } }
        })
        if (!fy) throw new Error("No Open Fiscal Year for this date")

        const journalEntry = await tx.journalEntry.create({
            data: {
                transactionDate: event.date,
                description: description,
                reference: event.reference || `EVT-${event.id}`,
                status: 'POSTED',
                postedAt: new Date(),
                fiscalYearId: fy.id,
                // siteId?
                financialEvent: { connect: { id: event.id } }, // Connect strictly
                lines: {
                    create: lines.map(l => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                        description: l.description,
                        contactId: (l as any).contactId // Hack cast if type not updated, but we are writing raw prisma here
                    }))
                }
            } as any
        })

        // 6. Update Balances
        for (const line of lines) {
            const net = line.debit - line.credit
            await tx.chartOfAccount.update({
                where: { id: line.accountId },
                data: { balance: { increment: net } }
            })
        }

        // 7. Update Event Status
        await (tx as any).financialEvent.update({
            where: { id: event.id },
            data: {
                status: 'SETTLED',
                transactionId: transaction.id,
                journalEntryId: journalEntry.id
            }
        })

        return { success: true, eventId: event.id, journalId: journalEntry.id }
    }, { maxWait: 10000, timeout: 30000 })
}
