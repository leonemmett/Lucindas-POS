import { useMemo, useState } from 'react'
import { IngredientEditor } from './IngredientEditor'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import { isLowStock } from '../lib/inventory'
import type { Ingredient, IngredientBatch } from '../lib/types'

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

  const batchTrackedIds = useMemo(() => new Set(batches.map((b) => b.ingredient_id)), [batches])

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

  const outOfStock = useMemo(
    () =>
      ingredients
        .filter((i) => isLowStock(i) && i.stock <= 0)
        .sort((a, b) => a.stock - b.stock),
    [ingredients],
  )

  const runningLow = useMemo(() => {
    const deficitRatio = (i: Ingredient) => (i.low_threshold - i.stock) / i.low_threshold
    return ingredients.filter((i) => isLowStock(i) && i.stock > 0).sort((a, b) => deficitRatio(b) - deficitRatio(a))
  }, [ingredients])

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

      {!loading && !error && totalLow === 0 && (
        <div className="menu-grid-status">Everything's stocked up.</div>
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
