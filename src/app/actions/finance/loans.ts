'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { calculateSchedule, ScheduleParams } from "@/lib/finance/loan-scheduler"
import { createFinancialEvent } from "./financial-events"
import { generateTransactionNumber } from "@/lib/sequences"

export async function getLoans() {
    return await (prisma as any).loan.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            contact: true,
            _count: { select: { installments: true } }
        }
    })
}

export async function getLoan(id: number) {
    return await (prisma as any).loan.findUnique({
        where: { id },
        include: {
            contact: true,
            installments: { orderBy: { dueDate: 'asc' } },
            financialEvents: true
        }
    })
}

export type CreateLoanInput = {
    contactId: number
    principalAmount: number // Changed from 'principal'
    interestRate: number
    interestType: 'NONE' | 'SIMPLE' | 'COMPOUND' | string // Added 'COMPOUND' and 'string'
    termMonths: number
    startDate: Date
    paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string // Added 'YEARLY' and 'string'
}

export async function createLoanContract(data: CreateLoanInput) {
    // Generate Contract Number
    const contractNumber = await generateTransactionNumber('LOAN')

    // 1. Calculate Schedule
    const schedule = calculateSchedule({
        principal: data.principalAmount, // Use new field name
        interestRate: data.interestRate,
        interestType: data.interestType,
        termMonths: data.termMonths,
        startDate: data.startDate,
        frequency: data.paymentFrequency
    })

    // 2. Create Transactionally
    const loan = await prisma.$transaction(async (tx) => {
        // Create Header
        const newLoan = await (tx as any).loan.create({
            data: {
                contactId: data.contactId,
                contractNumber: contractNumber,
                principalAmount: data.principalAmount,
                interestRate: data.interestRate,
                interestType: data.interestType,
                termMonths: data.termMonths,
                startDate: data.startDate,
                paymentFrequency: data.paymentFrequency,
                status: 'DRAFT', // Starts as DRAFT until disbursed? Or ACTIVE? Let's say ACTIVE but "Disbursement Pending" logic is separate.
                installments: {
                    create: schedule.map(line => ({
                        dueDate: line.dueDate,
                        principalAmount: line.principal,
                        interestAmount: line.interest,
                        totalAmount: line.total,
                        status: 'PENDING'
                    }))
                }
            }
        })
        return newLoan
    })

    revalidatePath('/admin/finance/loans')
    return { success: true, loanId: loan.id }
}

export async function disburseLoan(loanId: number, targetAccountId: number) {
    const loan = await (prisma as any).loan.findUnique({ where: { id: loanId }, include: { contact: true } })
    if (!loan) throw new Error("Loan not found")

    // Create the "Partner Loan" Financial Event (Cash In)
    // We reuse the existing logic but tag it with the loanId (which we added to schema)
    // NOTE: We need to update createFinancialEvent to accept loanId if we want strict linking there, 
    // or we update the relationship manually after creation.

    // Actually, createFinancialEvent doesn't support loanId in input yet.
    // We will create it via Prisma directly here for full control, OR update createFinancialEvent.
    // Let's use `createFinancialEvent` and then update the link, to ensure side effects (ledger posting) are handled?
    // Wait, `createFinancialEvent` only creates DRAFT. 
    // Then `postFinancialEvent` posts it.

    // Strategy: 
    // 1. Create Financial Event (Draft)
    // 2. Link to Loan
    // 3. Post Financial Event immediately (Auto-disburse)

    // A. Create Draft
    // We need to import `createFinancialEvent` safely.
    // Assuming we imported it.

    // We need to add `loanId` to `FinancialEvent` update or make sure we link it.
    // A. Create Draft & Update Loan Status
    const result = await prisma.$transaction(async (tx) => {
        const res = await createFinancialEvent({
            eventType: 'PARTNER_LOAN',
            amount: Number(loan.principalAmount),
            date: new Date(),
            notes: `Loan Disbursement for Contract #${loan.id}`,
            contactId: loan.contactId,
            targetAccountId: targetAccountId,
            currency: 'USD'
        }, tx)

        if (!res.success || !res.eventId) throw new Error("Failed to create financial event")

        // Link Event to Loan & Activate Loan
        await (tx as any).financialEvent.update({
            where: { id: res.eventId },
            data: { loanId: loan.id }
        })

        await (tx as any).loan.update({
            where: { id: loan.id },
            data: { status: 'ACTIVE' }
        })

        return { eventId: res.eventId }
    })

    revalidatePath(`/admin/finance/loans/${loanId}`)
    return { success: true, eventId: result.eventId }
}

