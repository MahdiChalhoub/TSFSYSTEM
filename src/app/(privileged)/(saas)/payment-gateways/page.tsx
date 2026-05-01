import { getRefPaymentGateways, getOrgPaymentGateways, getRefCountries } from "@/app/actions/reference";
import PaymentGatewaysClient from "./client";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Payment Gateways — SaaS Reference Data',
    description: 'Manage the global payment gateway catalog for all tenants',
};

export default async function PaymentGatewaysPage() {
    const [allGateways, orgGateways, countries] = await Promise.all([
        getRefPaymentGateways().catch(() => []),
        getOrgPaymentGateways().catch(() => []),
        getRefCountries({ is_active: true }).catch(() => []),
    ]);

    return (
        <PaymentGatewaysClient
            allGateways={Array.isArray(allGateways) ? allGateways : []}
            initialOrgGateways={Array.isArray(orgGateways) ? orgGateways : []}
            countries={Array.isArray(countries) ? countries : []}
        />
    );
}
