// @ts-nocheck
'use client'

import { useState } from 'react'
import { Library, GitMerge } from 'lucide-react'
import dynamic from 'next/dynamic'

const CoaTemplatesLibrary = dynamic(() => import('./viewer'), { ssr: false })
const MigrationMapBuilder = dynamic(() => import('./migration-map-builder'), { ssr: false })

interface Props {
    templateList: { key: string; name: string }[]
    templatesMap: Record<string, any>
}

const TABS = [
    { id: 'library', label: 'Template Library', icon: Library },
    { id: 'maps', label: 'Migration Maps', icon: GitMerge },
]

export default function TemplatesPageClient({ templateList, templatesMap }: Props) {
    const [activeTab, setActiveTab] = useState<'library' | 'maps'>('library')
    const templateKeys = templateList.map(t => t.key)

    return (
        <div>
            {/* Tab bar */}
            <div
                className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
                style={{ background: 'var(--app-surface-2, var(--app-surface))' }}
            >
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            style={{
                                background: isActive ? 'var(--app-primary)' : 'transparent',
                                color: isActive ? '#fff' : 'var(--app-muted-foreground)',
                            }}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {activeTab === 'library' && <CoaTemplatesLibrary templates={templatesMap} />}
            {activeTab === 'maps' && (
                <MigrationMapBuilder templates={templatesMap} templateKeys={templateKeys} />
            )}
        </div>
    )
}
