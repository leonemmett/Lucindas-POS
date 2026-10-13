import type { ReceiptContent } from './receiptContent'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// Plain-text fallback for when a branded PDF can't be generated/uploaded
// (e.g. offline) — still usable as a WhatsApp message or email body.
export function formatReceiptText(input: ReceiptContent): string {
  const lines: string[] = []
  lines.push(`Lucinda's`)
  lines.push(input.ts.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }))
  lines.push(
    `${input.tableName ?? 'Counter'} · ${input.customers} guest${input.customers === 1 ? '' : 's'}`,
  )
  lines.push('')

  for (const item of input.items) {
    const itemDiscount = item.discount_amount ?? 0
    const itemTakeawayFee = item.takeaway_fee ?? 0
    const itemTotal = item.price * item.qty - itemDiscount + itemTakeawayFee
    lines.push(`${item.qty} x ${item.name} — ${currency.format(itemTotal)}`)
    if (item.flavors && item.flavors.length > 0) {
      lines.push(`   ${item.flavors.map((f) => f.name).join(', ')}`)
    }
    if (itemDiscount > 0) {
      lines.push(`   ${item.discount_percent}% off (-${currency.format(itemDiscount)})`)
    }
    if (itemTakeawayFee > 0) {
      lines.push(`   Take away (+${currency.format(itemTakeawayFee)})`)
    }
  }

  lines.push('')
  lines.push(`Subtotal: ${currency.format(input.subtotal)}`)
  if (input.discountAmount > 0) {
    lines.push(`Discount (${input.discountPercent}%): -${currency.format(input.discountAmount)}`)
  }
  const takeawayFeeTotal = input.items.reduce((sum, i) => sum + (i.takeaway_fee ?? 0), 0)
  if (takeawayFeeTotal > 0) {
    lines.push(`Take away fee: ${currency.format(takeawayFeeTotal)}`)
  }
  lines.push(`Total: ${currency.format(input.total)}`)
  lines.push(`Payment: ${input.paymentLabel}`)
  lines.push('')
  lines.push('Thank you!')

  return lines.join('\n')
}
