import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCardLabels } from '../hooks/useCardLabels'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import type { PaymentMethod, TicketLine } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type CheckoutModalProps = {
  lines: TicketLine[]
  subtotal: number
  tableName: string | null
  onClose: () => void
  onComplete: () => void
}

export function CheckoutModal({ lines, subtotal, tableName, onClose, onComplete }: CheckoutModalProps) {
  const { card1Label, card2Label } = useCardLabels()
  const staffId = useCurrentStaff()

  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [customers, setCustomers] = useState(1)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const discountAmount = useMemo(() => subtotal * (discountPercent / 100), [subtotal, discountPercent])
  const total = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount])

  const paymentOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card1', label: card1Label },
    { value: 'card2', label: card2Label },
    { value: 'transfer', label: 'Transfer' },
  ]

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)

    const items = lines.map((line) => ({
      menu_item_id: line.menuItem.id,
      name: line.menuItem.name,
      price: line.menuItem.price,
      qty: line.qty,
    }))

    const { error } = await supabase.rpc('record_sale', {
      p_table_name: tableName,
      p_items: items,
      p_subtotal: subtotal,
      p_discount_percent: discountPercent,
      p_discount_amount: discountAmount,
      p_total: total,
      p_payment: payment,
      p_note: note.trim() || null,
      p_customers: customers,
      p_staff_id: staffId,
    })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onComplete()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>Checkout{tableName ? ` — ${tableName}` : ''}</h2>

        <div className="checkout-summary">
          <div className="checkout-row">
            <span>Subtotal</span>
            <span>{currency.format(subtotal)}</span>
          </div>
          <div className="checkout-row">
            <span>Discount</span>
            <span>{currency.format(discountAmount)}</span>
          </div>
          <div className="checkout-row checkout-total">
            <span>Total</span>
            <span>{currency.format(total)}</span>
          </div>
        </div>

        <label htmlFor="discount">Discount %</label>
        <input
          id="discount"
          type="number"
          min={0}
          max={100}
          value={discountPercent}
          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
        />

        <label>Payment method</label>
        <div className="payment-options">
          {paymentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={payment === option.value ? 'payment-option active' : 'payment-option'}
              onClick={() => setPayment(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label htmlFor="customers">Customers</label>
        <div className="customers-stepper">
          <button type="button" onClick={() => setCustomers((n) => Math.max(1, n - 1))}>
            −
          </button>
          <span>{customers}</span>
          <button type="button" onClick={() => setCustomers((n) => n + 1)}>
            +
          </button>
        </div>

        <label htmlFor="note">Note (optional)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="checkout-confirm" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Charging…' : `Charge ${currency.format(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
