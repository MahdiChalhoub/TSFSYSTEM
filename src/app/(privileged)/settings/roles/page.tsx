import { getPermissionsMatrix } from "@/app/actions/settings/roles"
import { RolesMatrixClient } from "./RolesMatrixClient"
import { ShieldCheck } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function RolesSettingsPage() {
    const matrixData = await getPermissionsMatrix()

    return (
        <div className="app-page min-h-screen p-5 md:p-6 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Shield size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Settings · Security</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Roles <span className="text-app-primary">& Permissions</span>
          </h1>
        </div>
      </div>
    </header>

            {!matrixData || !!matrixData.error ? (
                <div className="bg-app-error/10 border border-rose-500/20 text-rose-500 p-6 rounded-[2rem] text-center font-bold">
                    Failed to load permissions matrix. Are you an Administrator?
                </div>
            ) : (
                <RolesMatrixClient data={matrixData} />
            )}
        </div>
    )
}
