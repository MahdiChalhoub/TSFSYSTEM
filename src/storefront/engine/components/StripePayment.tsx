'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'

interface StripePaymentProps {
    clientSecret: string
    publishableKey: string
    onSuccess: (paymentIntentId: string) => void
    onError: (error: string) => void
}

function CheckoutForm({ onSuccess, onError }: { onSuccess: (id: string) => void, onError: (e: string) => void }) {
    const stripe = useStripe()
    const elements = useElements()
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        if (!stripe || !elements) return

        setLoading(true)
        setErrorMessage(null)

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Redirect is handled by our manual success check if possible,
                // but Stripe requires a return_url.
                return_url: window.location.href,
            },
            redirect: 'if_required',
        })

        if (error) {
            setErrorMessage(error.message || 'Payment failed')
            onError(error.message || 'Payment failed')
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess(paymentIntent.id)
        }

        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <PaymentElement />
            </div>

            {errorMessage && (
                <div className="flex items-center gap-2 p-4 bg-app-error/10 border border-app-error/20 rounded-xl text-red-400 text-sm animate-shake">
                    <AlertCircle size={16} />
                    {errorMessage}
                </div>
            )}

            <button
                disabled={!stripe || loading}
                className="w-full py-4 bg-app-success text-white rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-app-success transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Processing Securely...</>
                ) : (
                    <><ShieldCheck size={18} /> Pay Now</>
                )}
            </button>
        </form>
    )
}

export function StripePayment({ clientSecret, publishableKey, onSuccess, onError }: StripePaymentProps) {
    const stripePromise = loadStripe(publishableKey)

    return (
        <div className="w-full">
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                <CheckoutForm onSuccess={onSuccess} onError={onError} />
            </Elements>
        </div>
    )
}
