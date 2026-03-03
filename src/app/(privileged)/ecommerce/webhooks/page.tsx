import { getWebhooks, getSupportedEvents } from '@/app/actions/ecommerce/webhooks'
import WebhooksClient from './WebhooksClient'

export const metadata = { title: 'Webhooks | eCommerce' }

export default async function WebhooksPage() {
  const [webhooks, supportedEvents] = await Promise.all([
    getWebhooks().catch(() => []),
    getSupportedEvents().catch(() => []),
  ])
  return <WebhooksClient initialWebhooks={webhooks} supportedEvents={supportedEvents} />
}