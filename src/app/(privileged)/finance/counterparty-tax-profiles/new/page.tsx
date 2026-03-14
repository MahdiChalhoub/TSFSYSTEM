'use client'
import { redirect } from 'next/navigation'
export default function NewCounterpartyTaxProfilePage() {
  redirect('/finance/counterparty-tax-profiles/new')
  return null
}
