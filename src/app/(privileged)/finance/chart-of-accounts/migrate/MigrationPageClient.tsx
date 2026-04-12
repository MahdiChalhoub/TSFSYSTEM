// @ts-nocheck
'use client'

import { useState } from 'react'
import { Map, Zap } from 'lucide-react'
import dynamic from 'next/dynamic'

const CoaMigrationTool = dynamic(() => import('./viewer'), { ssr: false })
const MigrationExecutionViewer = dynamic(() => import('./execution-viewer'), { ssr: false })

interface Props {
    accounts: any[]
    templatesMap: Record<string, any>
    templateList: { key: string; name: string }[]
    currentTemplateKey: string
}

const TABS = [
    { id: 'balance', label: 'Balance Migration', icon: Map, desc: 'Move balances between accounts using a mapping table' },
    { id: 'session', label: 'Structural Migration', icon: Zap, desc: 'Full COA restructure with dry-run, approval and execution' },
]

export default function MigrationPageClient({ accounts, templatesMap, templateList, currentTemplateKey }: Props) {
    const [activeTab, setActiveTab] = useState<'balance' | 'session'>('balance')

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

            {/* Tab description */}
            <p className="text-xs text-app-muted-foreground mb-6">
                {TABS.find(t => t.id === activeTab)?.desc}
            </p>

            {/* Tab content */}
            {activeTab === 'balance' && (
                <CoaMigrationTool
                    currentAccounts={accounts}
                    availableTemplates={templatesMap}
                />
            )}
            {activeTab === 'session' && (
                <MigrationExecutionViewer
                    templates={templateList}
                    currentTemplateKey={currentTemplateKey}
                />
            )}
        </div>
    )
}
