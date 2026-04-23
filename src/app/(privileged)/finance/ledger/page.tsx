/**
 * General Ledger Page — V2 DajingoListView
 * ==========================================
 * Thin wrapper rendering the full-featured LedgerManager component.
 */

import { LedgerGateway } from './LedgerGateway'

export default function GeneralLedgerPage() {
  return (
    <div className="flex flex-col h-full md:p-6">
      <LedgerGateway />
    </div>
  )
}