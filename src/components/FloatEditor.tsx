import { useState } from 'react'
import { DenominationTable } from './DenominationTable'

type FloatEditorProps = {
  composition: Record<string, number>
  onClose: () => void
  onSave: (composition: Record<string, number>) => Promise<void>
}

export function FloatEditor({ composition, onClose, onSave }: FloatEditorProps) {
  const [values, setValues] = useState<Record<string, number>>(composition)
  const [submitting, setSubmitting] = useState(false)

  function handleChange(denom: number, qty: number) {
    setValues((prev) => ({ ...prev, [denom]: qty }))
  }

  async function handleSave() {
    setSubmitting(true)
    await onSave(values)
    setSubmitting(false)
    onClose()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>Till float</h2>
        <p className="login-subtitle">
          The fixed change fund left in the till overnight. Subtracted from each day's count to get actual cash
          takings.
        </p>
        <DenominationTable values={values} onChange={handleChange} qtyLabel="Fixed qty" />
        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="checkout-confirm" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save float'}
          </button>
        </div>
      </div>
    </div>
  )
}
