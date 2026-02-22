import { getAllTemplates } from '@/app/actions/finance/coa-templates'
import CoaTemplatesLibrary from './viewer'

export default async function TemplatesLibraryPage() {
    let templates: any = []
    try { templates = await getAllTemplates() } catch { /* empty fallback */ }

    return <CoaTemplatesLibrary templates={templates} />
}