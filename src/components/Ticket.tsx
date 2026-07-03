import type { TicketLine } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type TicketProps = {
  lines: TicketLine[]
  onIncrement: (key: string) => void
  onDecrement: (key: string) => void
  onRemove: (key: string) => void
  onClear: () => void
  onCharge: () => void
}

export function Ticket({ lines, onIncrement, onDecrement, onRemove, onClear, onCharge }: TicketProps) {
  const subtotal = lines.reduce((sum, line) => sum + line.menuItem.price * line.qty, 0)

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
          {lines.map((line) => (
            <li key={line.key} className="ticket-line">
              <div className="ticket-line-info">
                <span className="ticket-line-name">{line.menuItem.name}</span>
                <span className="ticket-line-price">
                  {currency.format(line.menuItem.price * line.qty)}
                </span>
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
            </li>
          ))}
        </ul>
      )}

      <div className="ticket-footer">
        <div className="ticket-subtotal">
          <span>Subtotal</span>
          <span>{currency.format(subtotal)}</span>
        </div>
        <button type="button" className="ticket-charge" disabled={lines.length === 0} onClick={onCharge}>
          Charge
        </button>
      </div>
    </div>
  )
}
