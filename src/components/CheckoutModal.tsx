import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCardLabels } from '../hooks/useCardLabels'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import { paymentLabel } from '../lib/payments'
import { Receipt } from './Receipt'
import { SendReceiptControls } from './SendReceiptControls'
import type { PaymentMethod, SaleItem, TicketLine } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const TAKEAWAY_FEE = 10
const TAKEAWAY_CATEGORIES = new Set(['Sandwiches', 'Salads'])

type CheckoutModalProps = {
  lines: TicketLine[]
  subtotal: number
  tableName: string | null
  receiptsEnabled: boolean
  onClose: () => void
  onComplete: () => void
}

type CompletedSale = {
  ts: Date
  items: SaleItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  total: number
  payment: PaymentMethod
  cashGiven: number
  changeDue: number
}

export function CheckoutModal({ lines, subtotal, tableName, receiptsEnabled, onClose, onComplete }: CheckoutModalProps) {
  const { card1Label, card2Label } = useCardLabels()
  const { staffId } = useCurrentStaff()

  const [payment, setPayment] = useState<PaymentMethod>('cash')
  // Keyed by line.key — seeded from whatever discount was already set per
  // item in the Ticket panel, still adjustable here for a final tweak
  // before charging. Discount is per item, not once for the whole order, so
  // a ticket can mix e.g. one staff-freebie scoop with a regular paying item.
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((line) => [line.key, line.discountPercent ?? 0])),
  )
  // Keyed by line.key, same as discounts — each eligible item is toggled
  // eat in/take away individually, not once for the whole order, so e.g. one
  // sandwich can go to-go while the rest of the order is eaten in.
  const [lineTakeaway, setLineTakeaway] = useState<Record<string, boolean>>({})
  const [customers, setCustomers] = useState(1)
  const [note, setNote] = useState('')
  const [cashGiven, setCashGiven] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)

  function lineDiscountPercent(key: string) {
    return lineDiscounts[key] ?? 0
  }

  function isTakeawayEligible(line: TicketLine) {
    return TAKEAWAY_CATEGORIES.has(line.menuItem.category) || line.menuItem.takeaway_fee_eligible
  }

  function lineAmounts(line: TicketLine) {
    const lineSubtotal = line.menuItem.price * line.qty
    const pct = lineDiscountPercent(line.key)
    const discount = lineSubtotal * (pct / 100)
    const takeawayFee = isTakeawayEligible(line) && lineTakeaway[line.key] ? TAKEAWAY_FEE * line.qty : 0
    return { lineSubtotal, pct, discount, takeawayFee, lineTotal: lineSubtotal - discount + takeawayFee }
  }

  const discountAmount = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const pct = lineDiscounts[line.key] ?? 0
        return sum + line.menuItem.price * line.qty * (pct / 100)
      }, 0),
    [lines, lineDiscounts],
  )
  const takeawayFeeTotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (isTakeawayEligible(line) && lineTakeaway[line.key] ? TAKEAWAY_FEE * line.qty : 0),
        0,
      ),
    [lines, lineTakeaway],
  )
  const total = useMemo(
    () => subtotal - discountAmount + takeawayFeeTotal,
    [subtotal, discountAmount, takeawayFeeTotal],
  )
  // Blended rate across the whole order — stored on the sale for reporting
  // (e.g. "100% discount = staff consumption" in SalesReport), even though
  // it's derived from per-item rates rather than a single order-wide one.
  const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0
  const changeDue = cashGiven - total
  const cashInsufficient = payment === 'cash' && cashGiven < total

  function handlePaymentChange(value: PaymentMethod) {
    setPayment(value)
    if (value !== 'cash') setCashGiven(0)
  }

  function setLineDiscount(key: string, value: number) {
    setLineDiscounts((prev) => ({ ...prev, [key]: Math.min(100, Math.max(0, value)) }))
  }

  function setLineTakeawayValue(key: string, value: boolean) {
    setLineTakeaway((prev) => ({ ...prev, [key]: value }))
  }

  // Staff eating gelato for free still needs to hit record_sale so stock
  // deducts normally — a 100% discount records the consumption at $0
  // rather than skipping the sale (and inventory tracking) entirely.
  // Applies to every line at once; individual items can still be adjusted
  // afterwards for a mixed ticket.
  function handleStaffDiscount() {
    const allAt100 = lines.every((line) => lineDiscountPercent(line.key) === 100)
    setLineDiscounts(Object.fromEntries(lines.map((line) => [line.key, allAt100 ? 0 : 100])))
    if (!allAt100 && !note.trim()) setNote('Staff consumption')
  }

  const paymentOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card1', label: card1Label },
    { value: 'card2', label: card2Label },
    { value: 'transfer', label: 'Transfer' },
  ]

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)

    const items: SaleItem[] = lines.map((line) => {
      const { pct, discount, takeawayFee } = lineAmounts(line)
      return {
        menu_item_id: line.menuItem.id,
        name: line.menuItem.name,
        price: line.menuItem.price,
        qty: line.qty,
        flavors: line.flavors,
        iva_rate: line.menuItem.iva_rate,
        discount_percent: pct,
        discount_amount: discount,
        takeaway_fee: takeawayFee,
      }
    })

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

    if (!receiptsEnabled) {
      onComplete()
      return
    }

    setCompletedSale({ ts: new Date(), items, subtotal, discountPercent, discountAmount, total, payment, cashGiven, changeDue })
  }

  if (completedSale) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card checkout-modal receipt-modal">
          <Receipt
            ts={completedSale.ts}
            tableName={tableName}
            customers={customers}
            items={completedSale.items}
            subtotal={completedSale.subtotal}
            discountPercent={completedSale.discountPercent}
            discountAmount={completedSale.discountAmount}
            total={completedSale.total}
            paymentLabel={paymentLabel(completedSale.payment, card1Label, card2Label)}
            cashGiven={completedSale.payment === 'cash' ? completedSale.cashGiven : undefined}
            changeDue={completedSale.payment === 'cash' ? completedSale.changeDue : undefined}
          />
          <SendReceiptControls
            receipt={{
              ts: completedSale.ts,
              tableName,
              customers,
              items: completedSale.items,
              subtotal: completedSale.subtotal,
              discountPercent: completedSale.discountPercent,
              discountAmount: completedSale.discountAmount,
              total: completedSale.total,
              paymentLabel: paymentLabel(completedSale.payment, card1Label, card2Label),
            }}
          />
          <div className="checkout-actions no-print">
            <button type="button" className="checkout-cancel" onClick={() => window.print()}>
              Print receipt
            </button>
            <button type="button" className="checkout-confirm" onClick={onComplete}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>Checkout{tableName ? ` — ${tableName}` : ''}</h2>

        <label>Items &amp; discounts</label>
        <div className="checkout-line-items">
          {lines.map((line) => {
            const { lineSubtotal, pct, discount, lineTotal } = lineAmounts(line)
            const eligible = isTakeawayEligible(line)
            const isTakeaway = lineTakeaway[line.key] ?? false
            return (
              <div className="checkout-line-item" key={line.key}>
                <div className="ticket-line-info">
                  <span>
                    {line.qty} &times; {line.menuItem.name}
                  </span>
                  <span>{currency.format(lineTotal)}</span>
                </div>
                <div className="discount-row">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    aria-label={`Discount % for ${line.menuItem.name}`}
                    value={pct}
                    onChange={(e) => setLineDiscount(line.key, Number(e.target.value))}
                  />
                  <span className="checkout-line-discount-label">
                    % off{discount > 0 ? ` (-${currency.format(discount)} of ${currency.format(lineSubtotal)})` : ''}
                  </span>
                </div>
                {eligible && (
                  <div className="payment-options checkout-line-takeaway">
                    <button
                      type="button"
                      className={`payment-option${!isTakeaway ? ' active' : ''}`}
                      onClick={() => setLineTakeawayValue(line.key, false)}
                    >
                      Eat in
                    </button>
                    <button
                      type="button"
                      className={`payment-option${isTakeaway ? ' active' : ''}`}
                      onClick={() => setLineTakeawayValue(line.key, true)}
                    >
                      Take away (+{currency.format(TAKEAWAY_FEE * line.qty)})
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className={`staff-discount-toggle${lines.length > 0 && lines.every((l) => lineDiscountPercent(l.key) === 100) ? ' active' : ''}`}
          onClick={handleStaffDiscount}
        >
          Staff (100% off everything)
        </button>

        <div className="checkout-summary">
          <div className="checkout-row">
            <span>Subtotal</span>
            <span>{currency.format(subtotal)}</span>
          </div>
          <div className="checkout-row">
            <span>Discount</span>
            <span>{currency.format(discountAmount)}</span>
          </div>
          {takeawayFeeTotal > 0 && (
            <div className="checkout-row">
              <span>Take away fee</span>
              <span>{currency.format(takeawayFeeTotal)}</span>
            </div>
          )}
          <div className="checkout-row checkout-total">
            <span>Total</span>
            <span>{currency.format(total)}</span>
          </div>
        </div>

        <label>Payment method</label>
        <div className="payment-options">
          {paymentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`payment-option payment-option-${option.value}${payment === option.value ? ' active' : ''}`}
              onClick={() => handlePaymentChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {payment === 'cash' && (
          <div className="checkout-summary change-calculator">
            <label htmlFor="cash-given">Cash received</label>
            <input
              id="cash-given"
              type="number"
              step="0.01"
              min={0}
              value={cashGiven || ''}
              onChange={(e) => setCashGiven(Math.max(0, Number(e.target.value)))}
            />
            <div className="checkout-row checkout-total">
              <span>{changeDue < 0 ? 'Still owing' : 'Change due'}</span>
              <span className={changeDue < 0 ? 'cashup-diff-negative' : ''}>
                {currency.format(Math.abs(changeDue))}
              </span>
            </div>
          </div>
        )}

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
          <button type="button" className="checkout-confirm" onClick={handleConfirm} disabled={submitting || cashInsufficient}>
            {submitting ? 'Charging…' : `Charge ${currency.format(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
