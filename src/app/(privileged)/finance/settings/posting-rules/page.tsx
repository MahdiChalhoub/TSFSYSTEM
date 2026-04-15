import { getPostingRulesByModule, getEventCatalog } from '@/app/actions/finance/posting-rules'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import PostingRulesConsole from './form'

export default async function PostingRulesPage() {
    const [rulesByModule, catalog, accounts] = await Promise.all([
        getPostingRulesByModule(),
        getEventCatalog(),
        getChartOfAccounts(),
    ])

    return (
        <div className="h-full flex flex-col">
            <PostingRulesConsole
                rulesByModule={rulesByModule}
                catalog={catalog}
                accounts={JSON.parse(JSON.stringify(accounts))}
            />
        </div>
    )
}
