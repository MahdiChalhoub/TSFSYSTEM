import { getPostingRules } from '@/app/actions/finance/posting-rules'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import PostingRulesForm from './form'

export default async function PostingRulesPage() {
    let config: any = {}, accounts: any = []
    try { config = await getPostingRules() } catch { }
    try { accounts = await getChartOfAccounts() } catch { }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PostingRulesForm initialConfig={config} accounts={accounts} />
        </div>
    )
}