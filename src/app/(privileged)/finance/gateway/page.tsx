import { Metadata } from 'next'
import PaymentGatewayPage from './page-client'

export const metadata: Metadata = {
 title: 'Payment Gateway | Finance',
 description: 'Configure Stripe and other payment gateways for your organization.',
}

export default function Page() {
 return <PaymentGatewayPage />
}
