import type { TicketLine } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type TicketProps = {
  lines: TicketLine[]
  onIncrement: (key: string) => void
  onDecrement: (key: string) => void
  onRemove: (key: string) => void
  onClear: () => void
  onSetDiscount: (key: string, percent: number) => void
  onCharge: () => void
}

function lineAmounts(line: TicketLine) {
  const lineSubtotal = line.menuItem.price * line.qty
  const pct = line.discountPercent ?? 0
  const discount = lineSubtotal * (pct / 100)
  return { lineSubtotal, pct, discount, lineTotal: lineSubtotal - discount }
}

export function Ticket({ lines, onIncrement, onDecrement, onRemove, onClear, onSetDiscount, onCharge }: TicketProps) {
  const subtotal = lines.reduce((sum, line) => sum + lineAmounts(line).lineSubtotal, 0)
  const discountTotal = lines.reduce((sum, line) => sum + lineAmounts(line).discount, 0)
  const total = subtotal - discountTotal

  return (
    <div className="ticket-panel">
      <div className="ticket-header">
        <h2>Current order</h2>
        {lines.length > 0 && (
          <button type="button" className="ticket-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="ticket-empty">Tap a menu item to add it here.</p>
      ) : (
        <ul className="ticket-lines">
          {lines.map((line) => {
            const { pct, discount, lineTotal } = lineAmounts(line)
            return (
              <li key={line.key} className="ticket-line">
                <div className="ticket-line-info">
                  <span className="ticket-line-name">
                    {line.menuItem.name}
                    {line.flavors && line.flavors.length > 0 && (
                      <span className="ticket-line-flavors"> — {line.flavors.map((f) => f.name).join(', ')}</span>
                    )}
                  </span>
                  <span className="ticket-line-price">{currency.format(lineTotal)}</span>
                </div>
                <div className="ticket-line-controls">
                  <button type="button" onClick={() => onDecrement(line.key)} aria-label={`Decrease ${line.menuItem.name}`}>
                    −
                  </button>
                  <span className="ticket-line-qty">{line.qty}</span>
                  <button type="button" onClick={() => onIncrement(line.key)} aria-label={`Increase ${line.menuItem.name}`}>
                    +
                  </button>
                  <button
                    type="button"
                    className="ticket-line-remove"
                    onClick={() => onRemove(line.key)}
                    aria-label={`Remove ${line.menuItem.name}`}
                  >
                    ×
                  </button>
                </div>
                <div className="ticket-line-discount">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pct}
                    aria-label={`Discount % for ${line.menuItem.name}`}
                    onChange={(e) => onSetDiscount(line.key, Number(e.target.value))}
                  />
                  <span>% off{discount > 0 ? ` (-${currency.format(discount)})` : ''}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="ticket-footer">
        <div className="ticket-subtotal">
          <span>Subtotal</span>
          <span>{currency.format(subtotal)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="ticket-subtotal">
            <span>Discount</span>
            <span>-{currency.format(discountTotal)}</span>
          </div>
        )}
        <div className="ticket-subtotal ticket-total">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </div>
        <button type="button" className="ticket-charge" disabled={lines.length === 0} onClick={onCharge}>
          Charge
        </button>
      </div>
    </div>
  )
}
