'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Package, CheckCircle2, Loader2, Play } from "lucide-react"
import { toast } from "sonner"
import { populateSessionLines } from "@/app/actions/inventory/stock-count"

interface SessionPopulatorProps {
    sessionId?: number
    sessionRef?: string
    onComplete?: () => void
}

export function SessionPopulator({ sessionId, sessionRef, onComplete }: SessionPopulatorProps) {
    const [populating, setPopulating] = useState(false)
    const [progress, setProgress] = useState({ current: 0, lastId: 0 })
    const [done, setDone] = useState(false)

    async function handlePopulate() {
        if (!sessionId) {
            toast.error("Please select or create a session first")
            return
        }

        setPopulating(true)
        setDone(false)
        setProgress({ current: 0, lastId: 0 })
        let lastId = 0
        let total = 0
        let isDone = false

        try {
            while (!isDone) {
                const res = await populateSessionLines(sessionId, lastId)
                if (!res.success) throw new Error(res.error)

                total += res.batch_synced
                lastId = res.last_id
                isDone = res.done

                setProgress({ current: total, lastId })

                if (isDone) break
            }
            setDone(true)
            toast.success(`Session ${sessionRef || sessionId} populated with ${total} products!`)
            if (onComplete) onComplete()
        } catch (e: any) {
            toast.error(`Population failed: ${e.message}`)
        } finally {
            setPopulating(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-sm">
            <CardHeader className="pb-3 text-center sm:text-left">
                <CardTitle className="text-lg font-bold text-indigo-900 flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className={populating ? "animate-pulse" : ""} size={20} />
                    High-Performance Populator
                </CardTitle>
                <CardDescription>
                    {sessionId
                        ? `Populate session ${sessionRef || `#${sessionId}`} with matching products`
                        : "Create a session to start the population engine"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    variant={done ? "outline" : "default"}
                    onClick={handlePopulate}
                    disabled={populating || !sessionId}
                    className="w-full h-12 gap-2 font-bold shadow-sm transition-all"
                >
                    {populating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Processing Batch...
                        </>
                    ) : done ? (
                        <>
                            <CheckCircle2 className="text-emerald-500" size={20} />
                            Repopulate Session
                        </>
                    ) : (
                        <>
                            <Play size={20} />
                            Start Population Engine
                        </>
                    )}
                </Button>

                {populating && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <span>Indexing Local Catalog...</span>
                            <span>{progress.current} Indexed</span>
                        </div>
                        <Progress value={undefined} className="h-1.5 bg-indigo-100" />
                        <p className="text-[10px] text-slate-400 italic text-center">Batch processing ensures zero-timeout for large inventories.</p>
                    </div>
                )}

                {done && !populating && (
                    <div className="p-3 bg-white/60 rounded-xl border border-indigo-50 flex items-center justify-center gap-3 shadow-inner">
                        <div className="text-center">
                            <p className="text-[10px] uppercase font-black text-slate-400 text-center">Batch Result</p>
                            <p className="text-lg font-black text-indigo-600 leading-none mt-1">+{progress.current} Lines</p>
                        </div>
                        <div className="bg-emerald-50 p-1.5 rounded-full text-emerald-600">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
