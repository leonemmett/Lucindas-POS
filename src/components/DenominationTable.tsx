import { MXN_DENOMINATIONS, sumDenominations } from '../lib/denominations'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type DenominationAdjustments = {
  added: Record<string, number>
  removed: Record<string, number>
}

type DenominationTableProps = {
  values: Record<string, number>
  onChange: (denom: number, qty: number) => void
  qtyLabel?: string
  adjustments?: DenominationAdjustments
}

export function DenominationTable({ values, onChange, qtyLabel = 'Count', adjustments }: DenominationTableProps) {
  const total = sumDenominations(values)

  return (
    <div className={`denom-table${adjustments ? ' denom-table-adjustable' : ''}`}>
      <div className="denom-table-header">
        <span>Denomination</span>
        <span>{qtyLabel}</span>
        <span>Total</span>
        {adjustments && <span>Till</span>}
      </div>
      {MXN_DENOMINATIONS.map((denom) => {
        const qty = values[denom] ?? 0
        const addQty = adjustments?.added[denom] ?? 0
        const removeQty = adjustments?.removed[denom] ?? 0
        return (
          <div className="denom-row" key={denom}>
            <span>{currency.format(denom)}</span>
            <input
              type="number"
              min={0}
              value={qty || ''}
              onChange={(e) => onChange(denom, Number(e.target.value))}
            />
            <span>{currency.format(denom * qty)}</span>
            {adjustments && (
              <span
                className={addQty > 0 ? 'denom-adjust-add' : removeQty > 0 ? 'denom-adjust-remove' : ''}
                title={addQty > 0 ? `Add ${addQty} to the till` : removeQty > 0 ? `Remove ${removeQty} from the till` : ''}
              >
                {addQty > 0 ? `(+${addQty})` : removeQty > 0 ? `(-${removeQty})` : ''}
              </span>
            )}
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
