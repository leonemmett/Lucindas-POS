import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FlavorSearchSelect } from './FlavorSearchSelect'
import type { Ingredient, IngredientBatch } from '../lib/types'

type IngredientBatchEditorProps = {
  batch: IngredientBatch | null
  ingredients: Ingredient[]
  initialIngredientId?: string
  onClose: () => void
  onSaved: () => void
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function IngredientBatchEditor({
  batch,
  ingredients,
  initialIngredientId,
  onClose,
  onSaved,
}: IngredientBatchEditorProps) {
  const [ingredientId, setIngredientId] = useState(batch?.ingredient_id ?? initialIngredientId ?? '')
  const [weightGrams, setWeightGrams] = useState(batch?.weight_grams ?? 0)
  const [expiryDate, setExpiryDate] = useState(batch?.expiry_date ?? '')
  const [receivedAt, setReceivedAt] = useState(batch?.received_at?.slice(0, 10) ?? todayDateString())
  const [note, setNote] = useState(batch?.note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = {
      ingredient_id: ingredientId,
      weight_grams: weightGrams,
      expiry_date: expiryDate || null,
      received_at: new Date(receivedAt).toISOString(),
      note: note.trim() || null,
    }

    const { error } = batch
      ? await supabase.from('ingredient_batches').update(payload).eq('id', batch.id)
      : await supabase.from('ingredient_batches').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  async function handleDelete() {
    if (!batch) return
    if (!confirm('Delete this container? This can\'t be undone.')) return

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('ingredient_batches').delete().eq('id', batch.id)
    setSubmitting(false)

    if (error) {
      setError(
        error.code === '23503'
          ? 'This container has sales recorded against it and can’t be deleted — mark it emptied instead.'
          : error.message,
      )
      return
    }

    onSaved()
  }

  async function handleMarkEmptied() {
    if (!batch) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase
      .from('ingredient_batches')
      .update({ emptied_at: new Date().toISOString() })
      .eq('id', batch.id)
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card menu-editor">
        <h2>{batch ? 'Edit container' : 'New container'}</h2>

        <label htmlFor="batch-ingredient">Flavour / ingredient</label>
        <FlavorSearchSelect id="batch-ingredient" flavours={ingredients} value={ingredientId} onChange={setIngredientId} />

        <div className="menu-editor-row">
          <div>
            <label htmlFor="batch-weight">Weight (g)</label>
            <input
              id="batch-weight"
              type="number"
              step="0.01"
              value={weightGrams}
              onChange={(e) => setWeightGrams(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="batch-expiry">Expiry date (optional)</label>
            <input
              id="batch-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="batch-received">Received</label>
            <input
              id="batch-received"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <label htmlFor="batch-note">Note (optional)</label>
        <input id="batch-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. supplier, batch code" />

        {batch?.emptied_at && <p className="menu-grid-status">Marked emptied on {new Date(batch.emptied_at).toLocaleDateString()}.</p>}

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {batch && !batch.emptied_at && (
            <button type="button" className="menu-manager-edit" onClick={handleMarkEmptied} disabled={submitting}>
              Mark emptied
            </button>
          )}
          {batch && (
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
            disabled={submitting || !ingredientId || weightGrams <= 0}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
