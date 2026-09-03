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
    lines.push(`${item.qty} x ${item.name} — ${currency.format(item.price * item.qty)}`)
    if (item.flavors && item.flavors.length > 0) {
      lines.push(`   ${item.flavors.map((f) => f.name).join(', ')}`)
    }
  }

  lines.push('')
  lines.push(`Subtotal: ${currency.format(input.subtotal)}`)
  if (input.discountAmount > 0) {
    lines.push(`Discount (${input.discountPercent}%): -${currency.format(input.discountAmount)}`)
  }
  lines.push(`Total: ${currency.format(input.total)}`)
  lines.push(`Payment: ${input.paymentLabel}`)
  lines.push('')
  lines.push('Thank you!')

  return lines.join('\n')
}
