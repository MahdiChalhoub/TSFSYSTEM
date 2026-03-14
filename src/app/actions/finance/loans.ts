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

 revalidatePath('/finance/loans')
 return { success: true, loanId: loan.id }
 } catch (e: unknown) {
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
 revalidatePath(`/finance/loans/${loanId}`)
 return { success: true }
 } catch (e: unknown) {
 console.error("Disburse Loan Failed", e)
 throw e
 }
}

// ─── Phase 2 Loan Enhancements ────────────────────────────────────

export async function getAmortizationSchedule(loanId: number) {
 return await erpFetch(`finance/loans/${loanId}/amortization-schedule/`)
}

export async function calculateEarlyPayoff(loanId: number, payoffDate: string) {
 const params = new URLSearchParams({ payoff_date: payoffDate })
 return await erpFetch(`finance/loans/${loanId}/early-payoff/?${params.toString()}`)
}

export async function makeLoanPayment(loanId: number, data: {
 amount: string
 payment_account_id: number
 reference?: string
}) {
 try {
 const result = await erpFetch(`finance/loans/${loanId}/payment/`, {
 method: 'POST',
 body: JSON.stringify(data)
 })
 revalidatePath(`/finance/loans/${loanId}`)
 return { success: true, data: result }
 } catch (e: unknown) {
 console.error("Make Payment Failed", e)
 throw e
 }
}
