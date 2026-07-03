import { MXN_DENOMINATIONS, sumDenominations } from '../lib/denominations'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type DenominationTableProps = {
  values: Record<string, number>
  onChange: (denom: number, qty: number) => void
  qtyLabel?: string
}

export function DenominationTable({ values, onChange, qtyLabel = 'Count' }: DenominationTableProps) {
  const total = sumDenominations(values)

  return (
    <div className="denom-table">
      <div className="denom-table-header">
        <span>Denomination</span>
        <span>{qtyLabel}</span>
        <span>Total</span>
      </div>
      {MXN_DENOMINATIONS.map((denom) => {
        const qty = values[denom] ?? 0
        return (
          <div className="denom-row" key={denom}>
            <span>{currency.format(denom)}</span>
            <input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => onChange(denom, Number(e.target.value))}
            />
            <span>{currency.format(denom * qty)}</span>
          </div>
        )
      })}
      <div className="denom-table-total">
        <span>Total</span>
        <span>{currency.format(total)}</span>
      </div>
    </div>
  )
}
