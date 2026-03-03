import { getAllTemplates } from '@/app/actions/finance/coa-templates'
import CoaTemplatesLibrary from './viewer'
import { LayoutTemplate } from 'lucide-react'

export default async function TemplatesLibraryPage() {
    let templates: any = []
    try { templates = await getAllTemplates() } catch { /* empty fallback */ }

    return (
        <div className="app-page space-y-6 p-6">
            <header className="flex items-center gap-4 fade-in-up">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)20', border: '1px solid var(--app-info)40' }}>
                    <LayoutTemplate size={26} style={{ color: 'var(--app-info)' }} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">COA Templates</h1>
                    <p className="text-sm text-app-muted-foreground mt-0.5">Chart of accounts template library</p>
                </div>
            </header>
            <CoaTemplatesLibrary templates={templates} />
        </div>
    )
}