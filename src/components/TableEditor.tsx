import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Table } from '../lib/types'

type TableEditorProps = {
  table: Table | null
  onClose: () => void
  onSaved: () => void
}

export function TableEditor({ table, onClose, onSaved }: TableEditorProps) {
  const [name, setName] = useState(table?.name ?? '')
  const [sortOrder, setSortOrder] = useState(table?.sort_order ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = { name: name.trim(), sort_order: sortOrder }

    const { error } = table
      ? await supabase.from('tables').update(payload).eq('id', table.id)
      : await supabase.from('tables').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  async function handleDelete() {
    if (!table) return
    if (!confirm(`Delete "${table.name}"? This can't be undone.`)) return

    setSubmitting(true)
    setError(null)

    // A table can be "open" in the POS with an empty cart (nothing ordered
    // yet) — that's not a real open order, so clear its (empty) ticket row
    // before deleting rather than blocking on the foreign key.
    const { data: openTicket } = await supabase
      .from('open_tickets')
      .select('items')
      .eq('table_id', table.id)
      .maybeSingle()

    if (openTicket && Array.isArray(openTicket.items) && openTicket.items.length > 0) {
      setSubmitting(false)
      setError('This table has an open order and can’t be deleted until it’s cleared or charged.')
      return
    }

    if (openTicket) {
      await supabase.from('open_tickets').delete().eq('table_id', table.id)
    }

    const { error } = await supabase.from('tables').delete().eq('id', table.id)
    setSubmitting(false)

    if (error) {
      setError(
        error.code === '23503'
          ? 'This table has an open order and can’t be deleted until it’s cleared or charged.'
          : error.message,
      )
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>{table ? 'Edit table' : 'New table'}</h2>

        <label htmlFor="table-name">Name</label>
        <input id="table-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label htmlFor="table-sort">Sort order</label>
        <input
          id="table-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {table && (
            <button type="button" className="menu-editor-delete" onClick={handleDelete} disabled={submitting}>
              Delete
            </button>
          )}
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="checkout-confirm"
            onClick={handleSave}
            disabled={submitting || !name.trim()}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
