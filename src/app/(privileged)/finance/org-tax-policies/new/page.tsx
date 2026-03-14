'use client'
import { redirect } from 'next/navigation'
export default function NewOrgTaxPolicyPage() {
  redirect('/finance/org-tax-policies/new')
  return null
}
