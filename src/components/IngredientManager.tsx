import { useMemo, useState } from 'react'
import { IngredientEditor } from './IngredientEditor'
import type { Ingredient } from '../lib/types'

type Filter = 'all' | 'flavour' | 'container' | 'low'

type IngredientManagerProps = {
  ingredients: Ingredient[]
  loading: boolean
  onChanged: () => void
}

export function IngredientManager({ ingredients, loading, onChanged }: IngredientManagerProps) {
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    let list = ingredients
    if (filter === 'flavour') list = list.filter((i) => i.is_flavour)
    if (filter === 'container') list = list.filter((i) => i.is_container)
    if (filter === 'low') list = list.filter((i) => i.stock <= i.low_threshold)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    return list
  }, [ingredients, filter, search])

  function handleSaved() {
    setEditingIngredient(undefined)
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Ingredients</h2>
        <button type="button" className="menu-manager-add" onClick={() => setEditingIngredient(null)}>
          + New ingredient
        </button>
      </div>

      <div className="ingredient-toolbar">
        <input
          type="search"
          className="ingredient-search"
          placeholder="Search ingredients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="category-tabs">
          {(['all', 'flavour', 'container', 'low'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'category-tab active' : 'category-tab'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'flavour' ? 'Flavours' : f === 'container' ? 'Containers' : 'Low stock'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="menu-grid-status">Loading ingredients…</div>}

      {!loading && visible.length === 0 && (
        <div className="menu-grid-status">No ingredients match.</div>
      )}

      {!loading && visible.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>Low threshold</th>
              <th>Cost/unit</th>
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ing) => {
              const isLow = ing.stock <= ing.low_threshold
              return (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td>{ing.unit}</td>
                  <td className={isLow ? 'ingredient-stock-low' : ''}>{ing.stock}</td>
                  <td>{ing.low_threshold}</td>
                  <td>{ing.cost_per_unit}</td>
                  <td>
                    {ing.is_flavour && <span className="ingredient-flag">Flavour</span>}
                    {ing.is_container && <span className="ingredient-flag">Container</span>}
                  </td>
                  <td>
                    <button type="button" className="menu-manager-edit" onClick={() => setEditingIngredient(ing)}>
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editingIngredient !== undefined && (
        <IngredientEditor
          ingredient={editingIngredient}
          onClose={() => setEditingIngredient(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
