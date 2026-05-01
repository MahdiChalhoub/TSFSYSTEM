import { getAccountCategories, getChartOfAccounts, getOrgPaymentGateways } from '../accounts/actions'
import { AccountCategoriesClient } from './AccountCategoriesClient'

export const dynamic = 'force-dynamic'

export default async function AccountCategoriesPage() {
    const [categories, coaList, orgGateways] = await Promise.all([
        getAccountCategories(),
        getChartOfAccounts(),
        getOrgPaymentGateways(),
    ])

    return (
        <AccountCategoriesClient
            initialCategories={Array.isArray(categories) ? categories : []}
            coaList={Array.isArray(coaList) ? coaList : []}
            orgGateways={Array.isArray(orgGateways) ? orgGateways : []}
        />
    )
}
