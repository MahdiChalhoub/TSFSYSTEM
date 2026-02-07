'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getLoans() {
    return await erpFetch('loans/')
}

export async function getLoan(id: number) {
    return await erpFetch(`loans/${id}/`)
}

export type CreateLoanInput = {
    contactId: number
    principalAmount: number
    interestRate: number
    interestType: 'NONE' | 'SIMPLE' | 'COMPOUND' | string
    termMonths: number
    startDate: Date
    paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string
}

export async function createLoanContract(data: CreateLoanInput) {
    try {
        const loan = await erpFetch('loans/contract/', {
            method: 'POST',
            body: JSON.stringify({
                contact_id: data.contactId,
                principal_amount: data.principalAmount,
                interest_rate: data.interestRate,
                interest_type: data.interestType,
                term_months: data.termMonths,
                start_date: data.startDate, // erpFetch/JSON.stringify might handling date string conversion? Usually ISO string is fine.
                payment_frequency: data.paymentFrequency
            })
        })

        revalidatePath('/admin/finance/loans')
        return { success: true, loanId: loan.id }
    } catch (e: any) {
        console.error("Create Loan Failed", e)
        throw e
    }
}

export async function disburseLoan(loanId: number, targetAccountId: number) {
    try {
        await erpFetch(`loans/${loanId}/disburse/`, {
            method: 'POST',
            body: JSON.stringify({
                account_id: targetAccountId
            })
        })
        revalidatePath(`/admin/finance/loans/${loanId}`)
        return { success: true }
    } catch (e: any) {
        console.error("Disburse Loan Failed", e)
        throw e
    }
}
