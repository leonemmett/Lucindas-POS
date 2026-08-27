import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import type { Ingredient, IngredientBatch } from '../lib/types'

type IngredientEditorProps = {
  ingredient: Ingredient | null
  ingredients: Ingredient[]
  batches: IngredientBatch[]
  onClose: () => void
  onSaved: () => void
  onBatchesChanged: () => void
}

export function IngredientEditor({
  ingredient,
  ingredients,
  batches,
  onClose,
  onSaved,
  onBatchesChanged,
}: IngredientEditorProps) {
  const { isAdmin } = useCurrentStaff()
  const [name, setName] = useState(ingredient?.name ?? '')
  const [unit, setUnit] = useState(ingredient?.unit ?? '')
  const [stock, setStock] = useState(ingredient?.stock ?? 0)
  const [lowThreshold, setLowThreshold] = useState(ingredient?.low_threshold ?? 0)
  const [costPerUnit, setCostPerUnit] = useState(ingredient?.cost_per_unit ?? 0)
  const [isFlavour, setIsFlavour] = useState(ingredient?.is_flavour ?? false)
  const [isContainer, setIsContainer] = useState(ingredient?.is_container ?? false)
  const [isMilk, setIsMilk] = useState(ingredient?.is_milk ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingBatch, setEditingBatch] = useState<IngredientBatch | null | undefined>(undefined)

  const ownBatches = ingredient ? batches.filter((b) => b.ingredient_id === ingredient.id) : []
  const isBatchTracked = ownBatches.length > 0
  const activeBatches = ownBatches.filter((b) => !b.emptied_at)

  function handleBatchSaved() {
    setEditingBatch(undefined)
    onBatchesChanged()
  }

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = {
      name: name.trim(),
      unit: unit.trim(),
      // Batch-tracked ingredients have their stock owned by the
      // ingredient_batches sync trigger — sending a stale client-side value
      // here would just get silently overwritten by the next batch change,
      // so leave it out of the write entirely rather than fight the trigger.
      ...(isBatchTracked ? {} : { stock }),
      low_threshold: lowThreshold,
      cost_per_unit: costPerUnit,
      is_flavour: isFlavour,
      is_container: isContainer,
      is_milk: isMilk,
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

  async function handleDiscontinue() {
    if (!ingredient) return
    const stockNote =
      ingredient.stock > 0 ? ` It still has ${ingredient.stock}${ingredient.unit} in stock.` : ''
    if (
      !confirm(
        `Discontinue "${ingredient.name}"?${stockNote} It'll drop off the flavour picker and stop raising low-stock alerts, but its sales/cost history stays intact.`,
      )
    ) {
      return
    }

    setSubmitting(true)
    setError(null)
    const { error } = await supabase
      .from('ingredients')
      .update({ is_flavour: false, low_threshold: 0, updated_at: new Date().toISOString() })
      .eq('id', ingredient.id)
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
          ? 'This ingredient is still referenced elsewhere (a menu item container, or a batch/sale record) and can’t be deleted while that’s the case.'
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
            {isBatchTracked ? (
              <p id="ing-stock" className="menu-grid-status">
                {ingredient?.stock ?? 0} across {activeBatches.length} container{activeBatches.length === 1 ? '' : 's'}
              </p>
            ) : (
              <input
                id="ing-stock"
                type="number"
                step="0.01"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
              />
            )}
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
        <label className="checkbox-label">
          <input type="checkbox" checked={isMilk} onChange={(e) => setIsMilk(e.target.checked)} />
          Milk (offered as a choice on milk-based drinks)
        </label>

        {ingredient && (
          <div className="ingredient-batches-section">
            <div className="menu-manager-header">
              <h3>Containers</h3>
              <button type="button" className="menu-manager-edit" onClick={() => setEditingBatch(null)}>
                + Add container
              </button>
            </div>
            {activeBatches.length === 0 && <p className="menu-grid-status">No containers logged yet.</p>}
            {activeBatches.length > 0 && (
              <table className="menu-manager-table">
                <thead>
                  <tr>
                    <th>Weight (g)</th>
                    <th>Expiry date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeBatches
                    .slice()
                    .sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'))
                    .map((b) => (
                      <tr key={b.id}>
                        <td>{b.weight_grams}</td>
                        <td>{b.expiry_date ?? 'No expiry'}</td>
                        <td>
                          <button type="button" className="menu-manager-edit" onClick={() => setEditingBatch(b)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {ingredient && ingredient.is_flavour && (
            <button type="button" className="menu-manager-edit" onClick={handleDiscontinue} disabled={submitting}>
              Discontinue
            </button>
          )}
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

      {editingBatch !== undefined && ingredient && (
        <IngredientBatchEditor
          batch={editingBatch}
          ingredients={ingredients}
          initialIngredientId={ingredient.id}
          onClose={() => setEditingBatch(undefined)}
          onSaved={handleBatchSaved}
        />
      )}
    </div>
  )
}
