import { getPostingRules } from '@/app/actions/finance/posting-rules'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import PostingRulesForm from './form'

export default async function PostingRulesPage() {
    const config = await getPostingRules()
    const accounts = await getChartOfAccounts()

    return (
        <div className="p-8">
            <PostingRulesForm initialConfig={config} accounts={accounts} />
        </div>
    )
}