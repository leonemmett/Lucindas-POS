import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import type { Ingredient } from '../lib/types'

type IngredientEditorProps = {
  ingredient: Ingredient | null
  onClose: () => void
  onSaved: () => void
}

export function IngredientEditor({ ingredient, onClose, onSaved }: IngredientEditorProps) {
  const { isAdmin } = useCurrentStaff()
  const [name, setName] = useState(ingredient?.name ?? '')
  const [unit, setUnit] = useState(ingredient?.unit ?? '')
  const [stock, setStock] = useState(ingredient?.stock ?? 0)
  const [lowThreshold, setLowThreshold] = useState(ingredient?.low_threshold ?? 0)
  const [costPerUnit, setCostPerUnit] = useState(ingredient?.cost_per_unit ?? 0)
  const [isFlavour, setIsFlavour] = useState(ingredient?.is_flavour ?? false)
  const [isContainer, setIsContainer] = useState(ingredient?.is_container ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = {
      name: name.trim(),
      unit: unit.trim(),
      stock,
      low_threshold: lowThreshold,
      cost_per_unit: costPerUnit,
      is_flavour: isFlavour,
      is_container: isContainer,
      updated_at: new Date().toISOString(),
    }

    const { error } = ingredient
      ? await supabase.from('ingredients').update(payload).eq('id', ingredient.id)
      : await supabase.from('ingredients').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  async function handleDelete() {
    if (!ingredient) return
    if (!confirm(`Delete "${ingredient.name}"? This can't be undone.`)) return

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('ingredients').delete().eq('id', ingredient.id)
    setSubmitting(false)

    if (error) {
      setError(
        error.code === '23503'
          ? 'This ingredient is used as a container on a menu item and can’t be deleted while that’s the case.'
          : error.message,
      )
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card menu-editor">
        <h2>{ingredient ? 'Edit ingredient' : 'New ingredient'}</h2>

        <label htmlFor="ing-name">Name</label>
        <input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label htmlFor="ing-unit">Unit</label>
        <input id="ing-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, ml, pcs, bag…" />

        <div className="menu-editor-row">
          <div>
            <label htmlFor="ing-stock">Stock</label>
            <input
              id="ing-stock"
              type="number"
              step="0.01"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="ing-low">Low threshold</label>
            <input
              id="ing-low"
              type="number"
              min={0}
              step="0.01"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(Number(e.target.value))}
            />
          </div>
          {isAdmin && (
            <div>
              <label htmlFor="ing-cost">Cost/unit</label>
              <input
                id="ing-cost"
                type="number"
                min={0}
                step="0.0001"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <label className="checkbox-label">
          <input type="checkbox" checked={isFlavour} onChange={(e) => setIsFlavour(e.target.checked)} />
          Flavour
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={isContainer} onChange={(e) => setIsContainer(e.target.checked)} />
          Container
        </label>

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {ingredient && (
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
            disabled={submitting || !name.trim() || !unit.trim()}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
