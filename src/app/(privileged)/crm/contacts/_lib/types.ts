/**
 * CRM Contacts — Types
 * =====================
 */

export type Contact = Record<string, any>

export interface TypeConfig {
  key: string
  label: string
  shortLabel: string
  icon: any
  color: string
  bg: string
}
