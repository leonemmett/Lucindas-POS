import { useMemo, useState } from 'react'
import { IngredientEditor } from './IngredientEditor'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import { categorizeIngredient, isLowStock, sortIngredients, type IngredientSortBy } from '../lib/inventory'
import type { Ingredient, IngredientBatch } from '../lib/types'

type CategoryFilter = 'all' | ReturnType<typeof categorizeIngredient>
type SortBy = 'urgency' | IngredientSortBy

type LowStockDashboardProps = {
  ingredients: Ingredient[]
  batches: IngredientBatch[]
  loading: boolean
  error: string | null
  onChanged: () => void
  onBatchesChanged: () => void
}

export function LowStockDashboard({
  ingredients,
  batches,
  loading,
  error,
  onChanged,
  onBatchesChanged,
}: LowStockDashboardProps) {
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null | undefined>(undefined)
  const [restockingBatchFor, setRestockingBatchFor] = useState<Ingredient | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('urgency')

  const batchTrackedIds = useMemo(() => new Set(batches.map((b) => b.ingredient_id)), [batches])

  const allLow = useMemo(() => ingredients.filter(isLowStock), [ingredients])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ing of allLow) {
      const cat = categorizeIngredient(ing)
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return counts
  }, [allLow])

  const categoryTabs = useMemo(
    () => [...categoryCounts.keys()].sort((a, b) => (categoryCounts.get(b) ?? 0) - (categoryCounts.get(a) ?? 0)),
    [categoryCounts],
  )

  function handleRestock(ing: Ingredient) {
    if (batchTrackedIds.has(ing.id)) {
      setRestockingBatchFor(ing)
    } else {
      setEditingIngredient(ing)
    }
  }

  function handleBatchSaved() {
    setRestockingBatchFor(null)
    onBatchesChanged()
  }

  const categoryFiltered = useMemo(
    () => (categoryFilter === 'all' ? allLow : allLow.filter((i) => categorizeIngredient(i) === categoryFilter)),
    [allLow, categoryFilter],
  )

  const outOfStock = useMemo(() => {
    const list = categoryFiltered.filter((i) => i.stock <= 0)
    if (sortBy === 'urgency') return list.sort((a, b) => a.stock - b.stock)
    return sortIngredients(list, sortBy, batches)
  }, [categoryFiltered, sortBy, batches])

  const runningLow = useMemo(() => {
    const list = categoryFiltered.filter((i) => i.stock > 0)
    if (sortBy === 'urgency') {
      const deficitRatio = (i: Ingredient) => (i.low_threshold - i.stock) / i.low_threshold
      return list.sort((a, b) => deficitRatio(b) - deficitRatio(a))
    }
    return sortIngredients(list, sortBy, batches)
  }, [categoryFiltered, sortBy, batches])

  function handleSaved() {
    setEditingIngredient(undefined)
    onChanged()
  }

  const totalLow = outOfStock.length + runningLow.length

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Low stock</h2>
      </div>

      {loading && <div className="menu-grid-status">Loading…</div>}

      {!loading && error && (
        <div className="menu-grid-status menu-grid-error">
          Failed to load ingredients: {error}
          <button type="button" className="menu-manager-add" onClick={onChanged}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && allLow.length === 0 && (
        <div className="menu-grid-status">Everything's stocked up.</div>
      )}

      {!loading && !error && allLow.length > 0 && (
        <div className="category-tabs">
          <button
            type="button"
            className={categoryFilter === 'all' ? 'category-tab active' : 'category-tab'}
            onClick={() => setCategoryFilter('all')}
          >
            All ({allLow.length})
          </button>
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              className={categoryFilter === cat ? 'category-tab active' : 'category-tab'}
              onClick={() => setCategoryFilter(cat as CategoryFilter)}
            >
              {cat} ({categoryCounts.get(cat)})
            </button>
          ))}
          <label htmlFor="low-stock-sort" className="sort-select-label">
            Sort by
            <select id="low-stock-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="urgency">Most urgent first</option>
              <option value="name">Name (A–Z)</option>
              <option value="weight">Stock (highest first)</option>
              <option value="expiry">Expiry date</option>
            </select>
          </label>
        </div>
      )}

      {!loading && !error && allLow.length > 0 && totalLow === 0 && (
        <div className="menu-grid-status">Nothing low in this category.</div>
      )}

      {!loading && !error && outOfStock.length > 0 && (
        <>
          <h3 className="low-stock-section-title low-stock-out">Out of stock ({outOfStock.length})</h3>
          <table className="menu-manager-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Stock</th>
                <th>Threshold</th>
                <th>Unit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {outOfStock.map((ing) => (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td className="ingredient-stock-low">{ing.stock}</td>
                  <td>{ing.low_threshold}</td>
                  <td>{ing.unit}</td>
                  <td>
                    <button type="button" className="menu-manager-edit" onClick={() => handleRestock(ing)}>
                      Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && !error && runningLow.length > 0 && (
        <>
          <h3 className="low-stock-section-title low-stock-warning">Running low ({runningLow.length})</h3>
          <table className="menu-manager-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Stock</th>
                <th>Threshold</th>
                <th>Unit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runningLow.map((ing) => (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td className="ingredient-stock-warning">{ing.stock}</td>
                  <td>{ing.low_threshold}</td>
                  <td>{ing.unit}</td>
                  <td>
                    <button type="button" className="menu-manager-edit" onClick={() => handleRestock(ing)}>
                      Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editingIngredient !== undefined && (
        <IngredientEditor
          ingredient={editingIngredient}
          ingredients={ingredients}
          batches={batches}
          onClose={() => setEditingIngredient(undefined)}
          onSaved={handleSaved}
          onBatchesChanged={onBatchesChanged}
        />
      )}

      {restockingBatchFor && (
        <IngredientBatchEditor
          batch={null}
          ingredients={ingredients}
          initialIngredientId={restockingBatchFor.id}
          onClose={() => setRestockingBatchFor(null)}
          onSaved={handleBatchSaved}
        />
      )}
    </div>
  )
}
