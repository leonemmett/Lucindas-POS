import { useCardLabels } from '../hooks/useCardLabels'
import { paymentLabel } from '../lib/payments'
import type { Sale } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type SaleDetailsModalProps = {
  sale: Sale
  staffName: string | null
  onClose: () => void
}

export function SaleDetailsModal({ sale, staffName, onClose }: SaleDetailsModalProps) {
  const { card1Label, card2Label } = useCardLabels()
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>Sale details</h2>
        <p className="login-subtitle">
          {new Date(sale.ts).toLocaleString('es-MX')}
          {sale.table_name ? ` · ${sale.table_name}` : ' · Counter'}
        </p>

        <ul className="sale-items-list">
          {sale.items.map((item, i) => (
            <li key={i} className="ticket-line-info">
              <span>
                {item.qty} × {item.name}
              </span>
              <span>{currency.format(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="checkout-summary">
          <div className="checkout-row">
            <span>Subtotal</span>
            <span>{currency.format(sale.subtotal)}</span>
          </div>
          <div className="checkout-row">
            <span>Discount {sale.discount_percent > 0 ? `(${sale.discount_percent}%)` : ''}</span>
            <span>{currency.format(sale.discount_amount)}</span>
          </div>
          <div className="checkout-row checkout-total">
            <span>Total</span>
            <span>{currency.format(sale.total)}</span>
          </div>
          <div className="checkout-row">
            <span>Payment</span>
            <span>{paymentLabel(sale.payment, card1Label, card2Label)}</span>
          </div>
          <div className="checkout-row">
            <span>Customers</span>
            <span>{sale.customers}</span>
          </div>
          <div className="checkout-row">
            <span>Staff</span>
            <span>{staffName ?? '—'}</span>
          </div>
          {sale.note && (
            <div className="checkout-row">
              <span>Note</span>
              <span>{sale.note}</span>
            </div>
          )}
        </div>

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
