'use client'

/**
 * General Ledger Page — V2 DajingoListView
 * ==========================================
 * Thin wrapper rendering the full-featured LedgerManager component.
 * Replaces the legacy card-based layout with the Dajingo Pro V2 design system.
 */

import LedgerManager from './manager'

export default function GeneralLedgerPage() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <LedgerManager />
    </div>
  )
}