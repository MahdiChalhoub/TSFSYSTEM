'use server'
/**
 * Import Declaration — Server Actions
 * =====================================
 * Actions for ImportDeclaration (customs clearance, duties, import VAT).
 * Moved from finance/tax-engine to procurement domain.
 *
 * API paths still use finance/ routes (backend router unchanged)
 * until backend URL migration is complete.
 */
import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ─── Import Declarations ────────────────────────────────────────────

export async function getImportDeclarations() {
  return erpFetch('finance/import-declarations/')
}

export async function getImportDeclaration(id: string | number) {
  return erpFetch(`finance/import-declarations/${id}/`)
}

export async function createImportDeclaration(data: any) {
  const result = await erpFetch('finance/import-declarations/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/procurement/import-declarations')
  revalidatePath('/finance/import-declarations') // backward-compat
  return result
}

export async function updateImportDeclaration(id: string | number, data: any) {
  const result = await erpFetch(`finance/import-declarations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/procurement/import-declarations')
  revalidatePath('/finance/import-declarations')
  return result
}

export async function deleteImportDeclaration(id: string | number) {
  const result = await erpFetch(`finance/import-declarations/${id}/`, {
    method: 'DELETE',
  })
  revalidatePath('/procurement/import-declarations')
  revalidatePath('/finance/import-declarations')
  return result
}

export async function calculateImportDeclaration(id: string | number) {
  const result = await erpFetch(`finance/import-declarations/${id}/calculate/`, {
    method: 'POST',
  })
  revalidatePath('/procurement/import-declarations')
  revalidatePath('/finance/import-declarations')
  return result
}

export async function getImportDashboard() {
  return erpFetch('finance/import-declarations/dashboard/')
}
