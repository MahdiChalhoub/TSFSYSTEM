import { redirect } from 'next/navigation'

/**
 * Redirect: Intra-Branch VAT → Inventory Transfer Orders
 * VAT assessment is now integrated into StockTransferOrder fields.
 */
export default function IntraBranchVATRedirect() {
  redirect('/inventory/transfer-orders')
}
