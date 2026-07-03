import { useMemo, useState } from 'react'
import { IngredientEditor } from './IngredientEditor'
import { isLowStock } from '../lib/inventory'
import type { Ingredient } from '../lib/types'

type LowStockDashboardProps = {
  ingredients: Ingredient[]
  loading: boolean
  onChanged: () => void
}

export function LowStockDashboard({ ingredients, loading, onChanged }: LowStockDashboardProps) {
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null | undefined>(undefined)

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

      {!loading && totalLow === 0 && (
        <div className="menu-grid-status">Everything's stocked up.</div>
      )}

      {!loading && outOfStock.length > 0 && (
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
                    <button type="button" className="menu-manager-edit" onClick={() => setEditingIngredient(ing)}>
                      Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && runningLow.length > 0 && (
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
                    <button type="button" className="menu-manager-edit" onClick={() => setEditingIngredient(ing)}>
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
          onClose={() => setEditingIngredient(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
