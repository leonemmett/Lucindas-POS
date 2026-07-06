import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Sale } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type VoidSaleModalProps = {
  sale: Sale
  onClose: () => void
  onVoided: () => void
}

export function VoidSaleModal({ sale, onClose, onVoided }: VoidSaleModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVoid() {
    setSubmitting(true)
    setError(null)

    const { error: voidError } = await supabase.rpc('void_sale', {
      p_sale_id: sale.id,
      p_reason: reason.trim() || null,
    })

    setSubmitting(false)

    if (voidError) {
      setError(voidError.message)
      return
    }

    onVoided()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>Void sale</h2>
        <p className="login-subtitle">
          {currency.format(sale.total)} · {new Date(sale.ts).toLocaleString('es-MX')}
        </p>
        <p className="login-subtitle">This can't be undone. Restores any stock this sale deducted.</p>

        <label htmlFor="void-reason">Reason</label>
        <textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="menu-editor-delete"
            onClick={handleVoid}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? 'Voiding…' : 'Void sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
