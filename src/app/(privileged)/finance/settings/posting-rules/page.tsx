import { getPostingRulesByModule, getEventCatalog, getCompleteness } from '@/app/actions/finance/posting-rules'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import PostingRulesConsole from './form'

export default async function PostingRulesPage() {
    const [rulesByModule, catalog, completeness, accounts] = await Promise.all([
        getPostingRulesByModule(),
        getEventCatalog(),
        getCompleteness(),
        getChartOfAccounts(),
    ])

    return (
        <div className="h-full flex flex-col">
            <PostingRulesConsole
                rulesByModule={rulesByModule}
                catalog={catalog}
                completeness={completeness}
                accounts={JSON.parse(JSON.stringify(accounts))}
            />
        </div>
    )
}
