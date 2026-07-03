import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ingredient, MenuItem, RecipeEntry } from '../lib/types'

type MenuItemEditorProps = {
  item: MenuItem | null
  categories: string[]
  ingredients: Ingredient[]
  onClose: () => void
  onSaved: () => void
}

export function MenuItemEditor({ item, categories, ingredients, onClose, onSaved }: MenuItemEditorProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'Other')
  const [price, setPrice] = useState(item?.price ?? 0)
  const [ballCount, setBallCount] = useState(item?.ball_count ?? 0)
  const [weightGrams, setWeightGrams] = useState(item?.weight_grams ?? 0)
  const [containerId, setContainerId] = useState<string>(item?.container_id ?? '')
  const [recipe, setRecipe] = useState<RecipeEntry[]>(item?.recipe ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRecipeRow() {
    const firstUnused = ingredients.find((ing) => !recipe.some((r) => r.ingredient_id === ing.id))
    if (!firstUnused) return
    setRecipe((prev) => [...prev, { ingredient_id: firstUnused.id, qty: 1 }])
  }

  function updateRecipeRow(index: number, patch: Partial<RecipeEntry>) {
    setRecipe((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRecipeRow(index: number) {
    setRecipe((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSubmitting(true)
    setError(null)

    const payload = {
      name: name.trim(),
      category: category.trim() || 'Other',
      price,
      ball_count: ballCount,
      weight_grams: weightGrams,
      container_id: containerId || null,
      recipe,
      updated_at: new Date().toISOString(),
    }

    const { error } = item
      ? await supabase.from('menu_items').update(payload).eq('id', item.id)
      : await supabase.from('menu_items').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id)
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
        <h2>{item ? 'Edit item' : 'New item'}</h2>

        <label htmlFor="item-name">Name</label>
        <input id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label htmlFor="item-category">Category</label>
        <input
          id="item-category"
          list="category-options"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="menu-editor-row">
          <div>
            <label htmlFor="item-price">Price</label>
            <input
              id="item-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="item-balls">Ball count</label>
            <input
              id="item-balls"
              type="number"
              min={0}
              value={ballCount}
              onChange={(e) => setBallCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="item-weight">Weight (g)</label>
            <input
              id="item-weight"
              type="number"
              min={0}
              value={weightGrams}
              onChange={(e) => setWeightGrams(Number(e.target.value))}
            />
          </div>
        </div>

        <label htmlFor="item-container">Container</label>
        <select id="item-container" value={containerId} onChange={(e) => setContainerId(e.target.value)}>
          <option value="">None</option>
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name}
            </option>
          ))}
        </select>

        <label>Recipe</label>
        <div className="recipe-rows">
          {recipe.length === 0 && <p className="recipe-empty">No ingredients yet.</p>}
          {recipe.map((row, index) => (
            <div className="recipe-row" key={index}>
              <select
                value={row.ingredient_id}
                onChange={(e) => updateRecipeRow(index, { ingredient_id: e.target.value })}
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.qty}
                onChange={(e) => updateRecipeRow(index, { qty: Number(e.target.value) })}
              />
              <button type="button" className="recipe-row-remove" onClick={() => removeRecipeRow(index)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="recipe-add"
          onClick={addRecipeRow}
          disabled={recipe.length >= ingredients.length}
        >
          + Add ingredient
        </button>

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          {item && (
            <button type="button" className="menu-editor-delete" onClick={handleDelete} disabled={submitting}>
              Delete
            </button>
          )}
          <button type="button" className="checkout-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="checkout-confirm" onClick={handleSave} disabled={submitting || !name.trim()}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
