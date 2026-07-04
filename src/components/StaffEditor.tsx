import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Staff } from '../lib/types'

type StaffEditorProps = {
  staffMember: Staff | null
  onClose: () => void
  onSaved: () => void
}

export function StaffEditor({ staffMember, onClose, onSaved }: StaffEditorProps) {
  const [name, setName] = useState(staffMember?.name ?? '')
  const [email, setEmail] = useState(staffMember?.email ?? '')
  const [isAdmin, setIsAdmin] = useState(staffMember?.is_admin ?? false)
  const [active, setActive] = useState(staffMember?.active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = {
      name: name.trim(),
      email: email.trim(),
      is_admin: isAdmin,
      active,
    }

    const { error } = staffMember
      ? await supabase.from('staff').update(payload).eq('id', staffMember.id)
      : await supabase.from('staff').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(error.code === '23505' ? 'A staff member with that email already exists.' : error.message)
      return
    }

    onSaved()
  }

  async function handleDelete() {
    if (!staffMember) return
    if (!confirm(`Remove "${staffMember.name}" from staff? This can't be undone.`)) return

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('staff').delete().eq('id', staffMember.id)
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>{staffMember ? 'Edit staff' : 'New staff'}</h2>

        {!staffMember && (
          <p className="cashup-hint">
            This only creates their staff profile. They still need a login created in the Supabase dashboard
            (Authentication → Users) using the same email before they can sign in.
          </p>
        )}

        <label htmlFor="staff-name">Name</label>
        <input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label htmlFor="staff-email">Email</label>
        <input
          id="staff-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Must match their login email"
        />

        <label className="checkbox-label">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Admin (can access Reports and cost/margin data, and authorize voids)
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (unchecking blocks them from using the app)
        </label>

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {staffMember && (
            <button type="button" className="menu-editor-delete" onClick={handleDelete} disabled={submitting}>
              Remove
            </button>
          )}
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="checkout-confirm"
            onClick={handleSave}
            disabled={submitting || !name.trim() || !email.trim()}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
