import { getAllTemplates } from '@/app/actions/finance/coa-templates'
import CoaTemplatesLibrary from './viewer'

export default async function TemplatesLibraryPage() {
    const templates = await getAllTemplates()

    return <CoaTemplatesLibrary templates={templates} />
}