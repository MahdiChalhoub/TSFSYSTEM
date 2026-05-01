'use client'

/**
 * Compare Modal — Profile Comparison
 * =====================================
 */

import type { AnalyticsProfile } from '@/app/actions/settings/analytics-profiles'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import { GitCompare, X } from 'lucide-react'
import { periodLabel, formulaLabel, contextLabel, sourceLabel } from '../_lib/constants'

export function CompareModal({ profiles, config, onClose }: {
  profiles: [AnalyticsProfile, AnalyticsProfile]
  config: PurchaseAnalyticsConfig
  onClose: () => void
}) {
  type FieldDef = {
    key: keyof PurchaseAnalyticsConfig & string;
    label: string;
    fmt: (v: unknown) => string;
  };
  const fields: FieldDef[] = [
    { key: 'sales_avg_period_days', label: 'Sales Avg Period', fmt: (v) => periodLabel(v as number) },
    { key: 'sales_window_size_days', label: 'Window Size', fmt: (v) => `${v} days` },
    { key: 'proposed_qty_formula', label: 'Formula', fmt: (v) => formulaLabel(v as string) },
    { key: 'proposed_qty_lead_days', label: 'Lead Days', fmt: (v) => String(v) },
    { key: 'proposed_qty_safety_multiplier', label: 'Safety Mult.', fmt: (v) => String(v) },
    { key: 'best_price_period_days', label: 'Best Price Period', fmt: (v) => periodLabel(v as number) },
    { key: 'purchase_context', label: 'Purchase Context', fmt: (v) => contextLabel(v as string) },
    { key: 'po_count_source', label: 'PO Count Source', fmt: (v) => sourceLabel(v as string) },
  ]

  const w1 = profiles[0].overrides?.financial_score_weights || config?.financial_score_weights
  const w2 = profiles[1].overrides?.financial_score_weights || config?.financial_score_weights
  const wDiff = JSON.stringify(w1) !== JSON.stringify(w2)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-app-surface rounded-xl border border-app-border shadow-2xl max-w-[700px] w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-app-primary" />
            <h3 className="text-[14px] font-bold text-app-foreground">Profile Comparison</h3>
          </div>
          <button onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground"><X size={16} /></button>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-[9px] font-black text-app-muted-foreground uppercase">Setting</div>
            <div className="text-[9px] font-black text-app-primary uppercase">{profiles[0].name}</div>
            <div className="text-[9px] font-black text-app-success uppercase">{profiles[1].name}</div>
          </div>
          {fields.map(({ key, label, fmt }) => {
            const overrides0 = profiles[0].overrides as Record<string, unknown> | undefined
            const overrides1 = profiles[1].overrides as Record<string, unknown> | undefined
            const cfg = config as unknown as Record<string, unknown> | undefined
            const v1 = overrides0?.[key] ?? cfg?.[key]
            const v2 = overrides1?.[key] ?? cfg?.[key]
            const diff = JSON.stringify(v1) !== JSON.stringify(v2)
            return (
              <div key={key} className={`grid grid-cols-3 gap-2 py-1.5 border-b border-app-border/10 ${diff ? 'bg-app-warning/5' : ''}`}>
                <span className="text-[10px] text-app-muted-foreground">{label}</span>
                <span className={`text-[10px] font-medium ${diff ? 'text-app-primary' : 'text-app-foreground'}`}>{fmt(v1)}</span>
                <span className={`text-[10px] font-medium ${diff ? 'text-app-success' : 'text-app-foreground'}`}>{fmt(v2)}</span>
              </div>
            )
          })}
          <div className={`grid grid-cols-3 gap-2 py-1.5 ${wDiff ? 'bg-app-warning/5' : ''}`}>
            <span className="text-[10px] text-app-muted-foreground">Score Weights</span>
            <span className={`text-[10px] font-medium ${wDiff ? 'text-app-primary' : 'text-app-foreground'}`}>{w1?.margin}/{w1?.velocity}/{w1?.stock_health}</span>
            <span className={`text-[10px] font-medium ${wDiff ? 'text-app-success' : 'text-app-foreground'}`}>{w2?.margin}/{w2?.velocity}/{w2?.stock_health}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
