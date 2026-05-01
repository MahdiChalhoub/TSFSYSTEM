import { getPaymentTerms } from "@/app/actions/commercial/payment-terms";
import PaymentTermsClient from "./client";
import { CreditCard } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function PaymentTermsPage() {
    const terms = await getPaymentTerms();

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1200px] mx-auto space-y-[var(--layout-section-spacing)]">
                <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    ← Back to Settings
                </Link>

                <header className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-app-success-bg dark:bg-emerald-900/30 flex items-center justify-center shadow-sm">
                        <CreditCard size={24} className="text-app-success" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight theme-text">
                            Payment <span className="text-app-success">Terms</span>
                        </h1>
                        <p className="text-xs theme-text-muted mt-0.5">Manage payment conditions for purchase orders and invoices</p>
                    </div>
                </header>

                <PaymentTermsClient initialTerms={terms} />
            </div>
        </main>
    );
}
