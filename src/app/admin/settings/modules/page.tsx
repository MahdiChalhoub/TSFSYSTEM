'use client'

import { useState, useEffect } from 'react'
import { getModules, enableModule, disableModule, ModuleInfo } from '@/app/actions/modules'
import { toast } from 'sonner'

export default function ModulesPage() {
    const [modules, setModules] = useState<ModuleInfo[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadModules()
    }, [])

    async function loadModules() {
        setLoading(true)
        const data = await getModules()
        setModules(data)
        setLoading(false)
    }

    async function handleToggle(module: ModuleInfo) {
        if (module.is_core) return

        const isEnabling = module.status === 'UNINSTALLED' || module.status === 'DISABLED'
        const action = isEnabling ? enableModule : disableModule

        const res = await action(module.code)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(res.message || (isEnabling ? 'Module enabled' : 'Module disabled'))
            loadModules()
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Module Manager</h1>
                <p className="text-gray-500 mt-1">Install or disable system features for your organization</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {modules.map(module => (
                        <div key={module.code} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${module.is_core ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${module.status === 'INSTALLED' ? 'bg-green-100 text-green-700' :
                                            module.status === 'DISABLED' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {module.status}
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                                <p className="text-sm text-gray-500 mt-1 mb-4">{module.description}</p>

                                {module.dependencies.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-medium text-gray-400 uppercase">Dependencies</p>
                                        <div className="flex gap-2 mt-1">
                                            {module.dependencies.map(dep => (
                                                <span key={dep} className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded">
                                                    {dep}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                                <span className="text-xs text-gray-400">Version {module.version}</span>
                                <button
                                    onClick={() => handleToggle(module)}
                                    disabled={module.is_core}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${module.is_core ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                            module.status === 'INSTALLED' ? 'bg-red-50 text-red-600 hover:bg-red-100' :
                                                'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                        }`}
                                >
                                    {module.is_core ? 'Required' : module.status === 'INSTALLED' ? 'Disable' : 'Install'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
