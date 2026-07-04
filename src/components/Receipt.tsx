import type { SaleItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type ReceiptProps = {
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

export function Receipt({
  ts,
  tableName,
  customers,
  items,
  subtotal,
  discountPercent,
  discountAmount,
  total,
  paymentLabel,
}: ReceiptProps) {
  return (
    <div className="receipt-print-area">
      <div className="receipt">
        <div className="receipt-header">
          <h2>Lucinda&rsquo;s</h2>
          <p>{ts.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <p>
            {tableName ?? 'Counter'} &middot; {customers} guest{customers === 1 ? '' : 's'}
          </p>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-items">
          {items.map((item, i) => (
            <div className="receipt-line" key={i}>
              <span>
                {item.qty} &times; {item.name}
              </span>
              <span>{currency.format(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="receipt-divider" />

        <div className="receipt-line">
          <span>Subtotal</span>
          <span>{currency.format(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="receipt-line">
            <span>Discount ({discountPercent}%)</span>
            <span>-{currency.format(discountAmount)}</span>
          </div>
        )}
        <div className="receipt-line receipt-total">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </div>
        <div className="receipt-line">
          <span>Payment</span>
          <span>{paymentLabel}</span>
        </div>

        <div className="receipt-divider" />

        <p className="receipt-footer">Thank you!</p>
      </div>
    </div>
  )
}
