'use client'
import { redirect } from 'next/navigation'
export default function NewCustomTaxRulePage() {
  redirect('/finance/custom-tax-rules/new')
  return null
}
