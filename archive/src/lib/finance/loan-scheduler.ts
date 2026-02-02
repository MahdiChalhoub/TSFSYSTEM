import { addMonths, addQuarters, startOfDay } from "date-fns"

export type ScheduleParams = {
    principal: number
    interestRate: number // Annual % (e.g. 5 for 5%)
    interestType: 'NONE' | 'SIMPLE' | 'COMPOUND' | string
    termMonths: number
    startDate: Date
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string
}

export type ScheduledInstallment = {
    dueDate: Date
    principal: number
    interest: number
    total: number
}

export function calculateSchedule(params: ScheduleParams): ScheduledInstallment[] {
    const { principal, interestRate, termMonths, startDate, frequency } = params

    // 1. Determine number of installments
    let numInstallments = 0
    if (frequency === 'MONTHLY') numInstallments = termMonths
    else if (frequency === 'QUARTERLY') numInstallments = Math.ceil(termMonths / 3)
    else if (frequency === 'YEARLY') numInstallments = Math.ceil(termMonths / 12)

    if (numInstallments <= 0) return []

    const installments: ScheduledInstallment[] = []

    // 2. Calculate Base Amounts
    // Simple Interest Logic: Total Interest = Principal * (Rate/100) * (Years)
    // Years = termMonths / 12
    const totalInterest = (params.interestType === 'SIMPLE')
        ? principal * (interestRate / 100) * (termMonths / 12)
        : 0

    const totalPayable = principal + totalInterest

    // Base amount per installment
    const basePrincipal = principal / numInstallments
    const baseInterest = totalInterest / numInstallments

    // Rounding handling: Track remaining to ensure sum matches exactly
    let remainingPrincipal = principal
    let remainingInterest = totalInterest

    for (let i = 1; i <= numInstallments; i++) {
        // Calculate Due Date
        let dueDate: Date
        if (frequency === 'MONTHLY') dueDate = addMonths(startDate, i)
        else if (frequency === 'QUARTERLY') dueDate = addQuarters(startDate, i)
        else dueDate = addMonths(startDate, i * 12) // YEARLY fallback

        // Determine amounts for this line
        // Last installment takes the remainder to fix rounding issues
        const isLast = i === numInstallments

        const linePrincipal = isLast ? remainingPrincipal : Number(basePrincipal.toFixed(2))
        const lineInterest = isLast ? remainingInterest : Number(baseInterest.toFixed(2))
        const lineTotal = linePrincipal + lineInterest

        installments.push({
            dueDate: startOfDay(dueDate),
            principal: linePrincipal,
            interest: lineInterest,
            total: lineTotal
        })

        remainingPrincipal -= linePrincipal
        remainingInterest -= lineInterest
    }

    return installments
}

/**
 * Rescheduling Logic - Option A: Push to End
 * Takes an incomplete schedule and the missed installment, and moves it.
 * This is complex because it involves database IDs usually. 
 * For this pure logic file, we'll keep it simple or implement later when DB models are involved.
 */
