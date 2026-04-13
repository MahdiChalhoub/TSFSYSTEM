import fs from 'fs'
import path from 'path'
import TemplatesPageClient from './TemplatesPageClient'

// Read COA templates directly from the JSON files in src/data/coa-templates/
function loadTemplatesFromDisk() {
    const templatesDir = path.join(process.cwd(), 'src', 'data', 'coa-templates')
    const templates: any[] = []
    const templatesMap: Record<string, any> = {}

    try {
        const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'))

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(templatesDir, file), 'utf-8')
                const data = JSON.parse(raw)
                const meta = data.metadata || {}

                // Count all accounts recursively
                function countAccounts(items: any[]): number {
                    let c = 0
                    for (const item of items) {
                        c += 1
                        if (item.children) c += countAccounts(item.children)
                    }
                    return c
                }

                const accounts = data.accounts || []
                const totalAccounts = countAccounts(accounts)

                templates.push({
                    key: meta.key || file.replace('.json', ''),
                    name: meta.name || meta.key || file.replace('.json', ''),
                    region: meta.region || 'Unknown',
                    description: meta.description || '',
                    icon: meta.icon || 'Globe',
                    accent_color: meta.accent_color || 'var(--app-primary)',
                    version: meta.version || '1.0.0',
                    last_updated: meta.last_updated || '',
                    is_system: true,
                    is_custom: false,
                    account_count: totalAccounts,
                })

                templatesMap[meta.key || file.replace('.json', '')] = {
                    key: meta.key || file.replace('.json', ''),
                    name: meta.name,
                    accounts,
                    account_count: totalAccounts,
                }
            } catch {
                // Skip malformed files
            }
        }
    } catch {
        // Directory doesn't exist
    }

    return { templates, templatesMap }
}

export default async function TemplatesLibraryPage() {
    const { templates, templatesMap } = loadTemplatesFromDisk()
    return <TemplatesPageClient templates={templates} templatesMap={templatesMap} />
}
