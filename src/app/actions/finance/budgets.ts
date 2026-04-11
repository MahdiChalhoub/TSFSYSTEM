'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export type Budget = {
  id: number
  name: string
  description?: string
  fiscal_year: number
  fiscal_year_name?: string
  version: number
  status: 'DRAFT' | 'APPROVED' | 'LOCKED'
  created_at: string
  created_by?: number
  approved_by?: number
  approved_at?: string
}

export type BudgetLine = {
  id: number
  budget: number
  account: number
  account_code?: string
  account_name?: string
  fiscal_period?: number
  cost_center?: string
  budgeted_amount: string
  actual_amount: string
  committed_amount: string
  variance_amount: string
  variance_percentage: string
}

export type VarianceReport = {
  budget_id: number
  budget_name: string
  fiscal_year: string
  total_budget: string
  total_actual: string
  total_committed: string
  total_variance: string
  total_available: string
  variance_percentage: string
  utilization_percentage: string
  over_budget_count: number
  by_account: any[]
  by_period: any[]
  by_cost_center: any[]
  over_budget_items: any[]
}

export type VarianceAlert = {
  account_code: string
  account_name: string
  budgeted_amount: string
  actual_amount: string
  over_budget_amount: string
  over_budget_percentage: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
}

export type BudgetPerformance = {
  total_budget: string
  total_actual: string
  total_committed: string
  total_available: string
  utilization_rate: string
  variance_percentage: string
  over_budget_count: number
  under_budget_count: number
}

export async function getBudgets() {
  return await erpFetch('finance/budgets/')
}

export async function getBudget(id: number) {
  return await erpFetch(`finance/budgets/${id}/`)
}

export async function createBudget(data: {
  name: string
  description?: string
  fiscal_year: number
  version?: number
  status?: string
}) {
  try {
    const budget = await erpFetch('finance/budgets/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    revalidatePath('/finance/budgets')
    return { success: true, id: budget.id }
  } catch (e: unknown) {
    console.error("Create Budget Failed", e)
    throw e
  }
}

export async function updateBudget(id: number, data: Partial<Budget>) {
  try {
    const budget = await erpFetch(`finance/budgets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
    revalidatePath('/finance/budgets')
    revalidatePath(`/finance/budgets/${id}`)
    return { success: true, data: budget }
  } catch (e: unknown) {
    console.error("Update Budget Failed", e)
    throw e
  }
}

export async function deleteBudget(id: number) {
  try {
    await erpFetch(`finance/budgets/${id}/`, {
      method: 'DELETE'
    })
    revalidatePath('/finance/budgets')
    return { success: true }
  } catch (e: unknown) {
    console.error("Delete Budget Failed", e)
    throw e
  }
}

export async function refreshBudgetActuals(budgetId: number, force: boolean = false) {
  try {
    const result = await erpFetch(`finance/budgets/${budgetId}/refresh-actuals/`, {
      method: 'POST',
      body: JSON.stringify({ force })
    })
    revalidatePath(`/finance/budgets/${budgetId}`)
    return { success: true, data: result }
  } catch (e: unknown) {
    console.error("Refresh Actuals Failed", e)
    throw e
  }
}

export async function getVarianceReport(
  budgetId: number,
  filters?: {
    period?: string
    account?: string
    cost_center?: string
  }
): Promise<VarianceReport> {
  const params = new URLSearchParams()
  if (filters?.period) params.set('period', filters.period)
  if (filters?.account) params.set('account', filters.account)
  if (filters?.cost_center) params.set('cost_center', filters.cost_center)

  const queryString = params.toString()
  const url = `finance/budgets/${budgetId}/variance-report/${queryString ? `?${queryString}` : ''}`

  return await erpFetch(url)
}

export async function getVarianceAlerts(
  budgetId: number,
  threshold: number = 10
): Promise<{ total_alerts: number; critical_count: number; warning_count: number; info_count: number; alerts: VarianceAlert[] }> {
  return await erpFetch(`finance/budgets/${budgetId}/variance-alerts/?threshold=${threshold}`)
}

export async function getAllVarianceAlerts(threshold: number = 10) {
  return await erpFetch(`finance/budgets/all-alerts/?threshold=${threshold}`)
}

export async function getBudgetPerformance(budgetId: number): Promise<BudgetPerformance> {
  return await erpFetch(`finance/budgets/${budgetId}/performance-summary/`)
}

export async function getBudgetDashboard() {
  return await erpFetch('finance/budgets/dashboard/')
}

export async function compareBudgetToPrevious(budgetId: number, previousBudgetId: number) {
  return await erpFetch(`finance/budgets/${budgetId}/compare-to-previous/?previous_budget_id=${previousBudgetId}`)
}

// Budget Lines
export async function getBudgetLines(budgetId?: number) {
  const url = budgetId
    ? `finance/budget-lines/?budget=${budgetId}`
    : 'finance/budget-lines/'
  return await erpFetch(url)
}

export async function createBudgetLine(data: {
  budget: number
  account: number
  fiscal_period?: number
  cost_center?: string
  budgeted_amount: string
}) {
  try {
    const line = await erpFetch('finance/budget-lines/', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    revalidatePath('/finance/budgets')
    return { success: true, id: line.id }
  } catch (e: unknown) {
    console.error("Create Budget Line Failed", e)
    throw e
  }
}

export async function updateBudgetLine(id: number, data: Partial<BudgetLine>) {
  try {
    const line = await erpFetch(`finance/budget-lines/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
    revalidatePath('/finance/budgets')
    return { success: true, data: line }
  } catch (e: unknown) {
    console.error("Update Budget Line Failed", e)
    throw e
  }
}

export async function refreshBudgetLineActual(lineId: number) {
  try {
    const result = await erpFetch(`finance/budget-lines/${lineId}/refresh-actual/`, {
      method: 'POST'
    })
    revalidatePath('/finance/budgets')
    return { success: true, data: result }
  } catch (e: unknown) {
    console.error("Refresh Line Actual Failed", e)
    throw e
  }
}
