import { getPostingRulesByModule, getCompletenessReport, getCompletenessByModule, getPostingRuleHistory } from '@/app/actions/finance/posting-rules'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import PostingRulesClient from './form'

export default async function PostingRulesPage() {
    let rulesByModule: any = {}, completeness: any = null, moduleCoverage: any = null, history: any = [], accounts: any = []

    try {
        const [rm, comp, mc, hist, accs] = await Promise.all([
            getPostingRulesByModule(),
            getCompletenessReport(),
            getCompletenessByModule(),
            getPostingRuleHistory(),
            getChartOfAccounts(),
        ])
        rulesByModule = rm
        completeness = comp
        moduleCoverage = mc
        history = hist
        accounts = accs
    } catch { }

    return (
        <div className="app-page space-y-6 animate-in fade-in duration-500">
            <PostingRulesClient
                rulesByModule={rulesByModule}
                completeness={completeness}
                moduleCoverage={moduleCoverage}
                history={history}
                accounts={accounts}
            />
        </div>
    )
}