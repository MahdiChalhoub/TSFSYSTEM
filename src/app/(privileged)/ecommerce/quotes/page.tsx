import { getQuotes } from '@/app/actions/ecommerce/quotes'
import QuotesClient from './QuotesClient'

export const metadata = { title: 'Quote Inbox | eCommerce' }

export default async function QuotesPage() {
  const quotes = await getQuotes().catch(() => [])
  return <QuotesClient initialQuotes={quotes} />
}