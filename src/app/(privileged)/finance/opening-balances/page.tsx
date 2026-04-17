'use client'

/**
 * Opening Balances Page — V2 DajingoListView
 * =============================================
 * Independent page for managing opening balance journal entries.
 * Route: /finance/opening-balances
 */

import OpeningBalancesManager from './manager'

export default function OpeningBalancesPage() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <OpeningBalancesManager />
    </div>
  )
}
