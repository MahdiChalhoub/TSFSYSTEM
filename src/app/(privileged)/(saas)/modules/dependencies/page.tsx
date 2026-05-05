'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Network, Crown, Package, AlertTriangle, Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getModuleDependencyGraph } from '@/app/actions/saas/modules'

interface GraphNode {
    code: string
    name: string
    description: string
    is_core: boolean
    total_installs: number
    installed_for_org: boolean | null
    dependencies: string[]
    missing_dependencies: string[]
}

interface Graph {
    nodes: GraphNode[]
    edges: { from: string; to: string }[]
    organization_id: string | null
}

export default function ModuleDependenciesPage() {
    const router = useRouter()
    const [graph, setGraph] = useState<Graph | null>(null)
    const [loading, setLoading] = useState(true)
    const [focus, setFocus] = useState<string | null>(null)

    useEffect(() => {
        (async () => {
            try {
                const data = await getModuleDependencyGraph()
                setGraph(data)
            } catch {
                toast.error('Failed to load dependency graph')
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    // Reverse index: code → modules that depend on it.
    const dependents = useMemo(() => {
        const map: Record<string, string[]> = {}
        graph?.edges.forEach(e => {
            if (!map[e.to]) map[e.to] = []
            map[e.to].push(e.from)
        })
        return map
    }, [graph])

    // Transitive-dependency closure for the focused node.
    const focusedSubgraph = useMemo(() => {
        if (!focus || !graph) return null
        const byCode: Record<string, GraphNode> = Object.fromEntries(graph.nodes.map(n => [n.code, n]))
        const deps = new Set<string>()
        const dependsOn = (code: string) => {
            for (const dep of byCode[code]?.dependencies ?? []) {
                if (deps.has(dep)) continue
                deps.add(dep)
                dependsOn(dep)
            }
        }
        dependsOn(focus)

        const uses = new Set<string>()
        const usedBy = (code: string) => {
            for (const u of dependents[code] ?? []) {
                if (uses.has(u)) continue
                uses.add(u)
                usedBy(u)
            }
        }
        usedBy(focus)

        return { deps: Array.from(deps), uses: Array.from(uses) }
    }, [focus, graph, dependents])

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
                <Loader2 size={40} className="animate-spin text-app-success mx-auto" />
                <p className="text-app-muted-foreground font-medium text-sm">Loading module graph...</p>
            </div>
        </div>
    )

    if (!graph || graph.nodes.length === 0) return (
        <div className="p-12 text-center">
            <h2>No modules registered</h2>
            <p className="text-sm text-app-muted-foreground mt-2">Sync modules from the <a href="/modules" className="text-app-success underline">Modules page</a> first.</p>
        </div>
    )

    const core = graph.nodes.filter(n => n.is_core)
    const business = graph.nodes.filter(n => !n.is_core)

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto py-6 px-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/modules')} className="text-app-muted-foreground hover:text-app-foreground rounded-xl">
                        <ArrowLeft size={18} />
                    </Button>
                    <div>
                        <h1 className="flex items-center gap-3">
                            <Network size={24} className="text-app-success" />
                            Module Dependencies
                        </h1>
                        <p className="text-sm text-app-muted-foreground mt-1">
                            {graph.nodes.length} modules · {graph.edges.length} dependency edges
                            {focus && <span className="ml-2">· focused on <strong>{focus}</strong> <button onClick={() => setFocus(null)} className="underline text-app-success">clear</button></span>}
                        </p>
                    </div>
                </div>
            </div>

            {core.length > 0 && (
                <section>
                    <h2 className="uppercase text-app-accent mb-3 flex items-center gap-2">
                        <Crown size={14} /> Core Infrastructure
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {core.map(n => <NodeCard key={n.code} node={n} dependents={dependents[n.code] ?? []} focus={focus} setFocus={setFocus} focusedSubgraph={focusedSubgraph} />)}
                    </div>
                </section>
            )}

            <section>
                <h2 className="uppercase text-app-success mb-3 flex items-center gap-2">
                    <Package size={14} /> Business Modules
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {business.map(n => <NodeCard key={n.code} node={n} dependents={dependents[n.code] ?? []} focus={focus} setFocus={setFocus} focusedSubgraph={focusedSubgraph} />)}
                </div>
            </section>
        </div>
    )
}

function NodeCard({ node, dependents, focus, setFocus, focusedSubgraph }: {
    node: GraphNode
    dependents: string[]
    focus: string | null
    setFocus: (c: string | null) => void
    focusedSubgraph: { deps: string[]; uses: string[] } | null
}) {
    const isFocused = focus === node.code
    const isDep = !!focusedSubgraph && focusedSubgraph.deps.includes(node.code)
    const isUser = !!focusedSubgraph && focusedSubgraph.uses.includes(node.code)
    const dim = focus && !isFocused && !isDep && !isUser

    return (
        <Card className={`transition-all border shadow-sm ${isFocused
            ? 'border-app-primary bg-app-success-bg/40 ring-2 ring-app-primary'
            : isDep
                ? 'border-app-accent bg-app-accent-bg/40'
                : isUser
                    ? 'border-app-warning bg-app-warning-bg/40'
                    : 'border-app-border bg-app-surface'
            } ${dim ? 'opacity-40' : ''}`}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle className="text-base font-bold text-app-foreground">{node.name}</CardTitle>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-app-muted-foreground mt-0.5">{node.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-app-surface text-app-muted-foreground border-app-border text-[9px] flex items-center gap-1">
                            <Users size={9} /> {node.total_installs}
                        </Badge>
                        {node.is_core && <Badge className="bg-app-accent-bg text-app-accent border-app-accent text-[9px]">Core</Badge>}
                    </div>
                </div>
                {node.description && (
                    <CardDescription className="text-xs mt-1 line-clamp-2">{node.description}</CardDescription>
                )}
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
                {node.missing_dependencies.length > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-app-error-bg border border-app-error">
                        <AlertTriangle size={12} className="text-app-error mt-0.5 shrink-0" />
                        <span className="text-[11px] text-app-error">
                            Missing dependencies: {node.missing_dependencies.join(', ')}
                        </span>
                    </div>
                )}
                <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground mb-1">
                        Depends on ({node.dependencies.length})
                    </p>
                    {node.dependencies.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground italic">none</p>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {node.dependencies.map(d => (
                                <button key={d} onClick={() => setFocus(d)}
                                    className="text-[10px] px-2 py-0.5 rounded-md font-mono uppercase bg-app-accent-bg text-app-accent border border-app-accent hover:bg-app-accent-bg cursor-pointer transition-colors">
                                    {d}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground mb-1">
                        Required by ({dependents.length})
                    </p>
                    {dependents.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground italic">nothing</p>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {dependents.map(d => (
                                <button key={d} onClick={() => setFocus(d)}
                                    className="text-[10px] px-2 py-0.5 rounded-md font-mono uppercase bg-app-warning-bg text-app-warning border border-app-warning hover:bg-app-warning-bg cursor-pointer transition-colors">
                                    {d}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="pt-2 flex justify-end">
                    <Button size="sm" variant={isFocused ? 'default' : 'outline'}
                        onClick={() => setFocus(isFocused ? null : node.code)}
                        className={`text-[10px] h-7 rounded-xl ${isFocused ? 'bg-app-primary-dark hover:bg-app-primary-dark text-white' : ''}`}>
                        {isFocused ? 'Clear focus' : 'Focus'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
