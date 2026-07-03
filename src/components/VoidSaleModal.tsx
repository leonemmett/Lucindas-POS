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
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAuthorize() {
    setSubmitting(true)
    setError(null)

    const { data: originalSessionData } = await supabase.auth.getSession()
    const originalSession = originalSessionData.session

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword,
    })

    if (signInError) {
      setSubmitting(false)
      setError('Incorrect admin email or password.')
      return
    }

    const { data: staffRow } = await supabase
      .from('staff')
      .select('is_admin')
      .eq('email', adminEmail.trim())
      .maybeSingle()

    if (!staffRow?.is_admin) {
      if (originalSession) await supabase.auth.setSession(originalSession)
      setSubmitting(false)
      setError('That account is not authorized as an admin.')
      return
    }

    const { error: voidError } = await supabase.rpc('void_sale', {
      p_sale_id: sale.id,
      p_reason: reason.trim() || null,
    })

    if (originalSession) await supabase.auth.setSession(originalSession)

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
        <p className="login-subtitle">Requires admin authorization. Restores any stock this sale deducted.</p>

        <label htmlFor="void-reason">Reason</label>
        <textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />

        <div className="void-admin-auth">
          <p className="void-admin-auth-label">Admin authorization</p>
          <label htmlFor="admin-email">Admin email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="off"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
          <label htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="off"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="menu-editor-delete"
            onClick={handleAuthorize}
            disabled={submitting || !reason.trim() || !adminEmail.trim() || !adminPassword}
          >
            {submitting ? 'Authorizing…' : 'Authorize & void'}
          </button>
        </div>
      </div>
    </div>
  )
}
