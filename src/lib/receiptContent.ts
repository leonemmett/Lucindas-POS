import type { SaleItem } from './types'

export type ReceiptContent = {
  ts: Date
  tableName: string | null
  customers: number
  items: SaleItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  total: number
  paymentLabel: string
}
