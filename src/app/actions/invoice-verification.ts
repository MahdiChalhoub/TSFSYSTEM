'use server'

/**
 * INVOICE VERIFICATION ACTIONS
 * ==============================
 * Server actions for 3-way matching and invoice verification workflow
 */

import { fetchWithAuth } from '@/lib/api-client'
import type {
  InvoiceListItem,
  InvoiceDetail,
  VerifyResponse,
  RejectRequest,
  RejectResponse,
  HoldRequest,
  HoldResponse,
  UploadDocumentResponse,
} from '@/types/invoice-verification'

const API_BASE = '/api/pos/invoice-verification'

/**
 * Get all invoices pending verification
 */
export async function getInvoicesPendingVerification(): Promise<{
  count: number
  invoices: InvoiceListItem[]
}> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch invoices')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching invoices:', error)
    throw error
  }
}

/**
 * Get detailed invoice with 3-way comparison
 */
export async function getInvoiceDetail(invoiceId: number): Promise<InvoiceDetail> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/${invoiceId}/`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch invoice detail')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching invoice detail:', error)
    throw error
  }
}

/**
 * Verify invoice (run 3-way match and approve if valid)
 */
export async function verifyInvoice(invoiceId: number): Promise<VerifyResponse> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/${invoiceId}/verify/`, {
      method: 'POST',
    })
    const data = await response.json()

    if (!response.ok) {
      // Return the error data with success: false
      return {
        success: false,
        message: data.message || 'Verification failed',
        violations: data.violations,
        invoice_status: data.invoice_status,
        payment_blocked: data.payment_blocked,
      }
    }

    return data
  } catch (error) {
    console.error('Error verifying invoice:', error)
    throw error
  }
}

/**
 * Reject invoice with reason
 */
export async function rejectInvoice(
  invoiceId: number,
  request: RejectRequest
): Promise<RejectResponse> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/${invoiceId}/reject/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to reject invoice')
    }

    return await response.json()
  } catch (error) {
    console.error('Error rejecting invoice:', error)
    throw error
  }
}

/**
 * Put invoice on hold
 */
export async function holdInvoice(
  invoiceId: number,
  request?: HoldRequest
): Promise<HoldResponse> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/${invoiceId}/hold/`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to put invoice on hold')
    }

    return await response.json()
  } catch (error) {
    console.error('Error holding invoice:', error)
    throw error
  }
}

/**
 * Upload scanned invoice document
 */
export async function uploadInvoiceDocument(
  invoiceId: number,
  file: File
): Promise<UploadDocumentResponse> {
  try {
    const formData = new FormData()
    formData.append('document', file)

    const response = await fetchWithAuth(
      `${API_BASE}/${invoiceId}/upload-document/`,
      {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
        headers: {},
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload document')
    }

    return await response.json()
  } catch (error) {
    console.error('Error uploading document:', error)
    throw error
  }
}
