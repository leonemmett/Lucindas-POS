import { useMemo, useState } from 'react'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import { isEmptied, isExpired, isExpiringSoon } from '../lib/inventory'
import { useExpiryAlertWindowDays } from '../hooks/useExpiryAlertWindowDays'
import type { Ingredient, IngredientBatch } from '../lib/types'

type Filter = 'expired' | 'soon' | 'all'

type ExpiryDashboardProps = {
  batches: IngredientBatch[]
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  onChanged: () => void
}

export function ExpiryDashboard({ batches, ingredients, loading, error, onChanged }: ExpiryDashboardProps) {
  const windowDays = useExpiryAlertWindowDays()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('soon')
  const [editingBatch, setEditingBatch] = useState<IngredientBatch | null | undefined>(undefined)

  const nameById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.name])), [ingredients])

  const active = useMemo(() => batches.filter((b) => !isEmptied(b)), [batches])

  const visible = useMemo(() => {
    let list = active
    if (filter === 'expired') list = list.filter((b) => isExpired(b))
    if (filter === 'soon') list = list.filter((b) => isExpiringSoon(b, windowDays) && !isExpired(b))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((b) => (nameById.get(b.ingredient_id) ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
  }, [active, filter, search, nameById, windowDays])

  const expiredCount = useMemo(() => active.filter((b) => isExpired(b)).length, [active])
  const soonCount = useMemo(
    () => active.filter((b) => isExpiringSoon(b, windowDays) && !isExpired(b)).length,
    [active, windowDays],
  )

  function handleSaved() {
    setEditingBatch(undefined)
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Expiry</h2>
        <div className="menu-manager-header-actions">
          <button type="button" className="menu-manager-add" onClick={() => setEditingBatch(null)}>
            + New container
          </button>
        </div>
      </div>

      {loading && <div className="menu-grid-status">Loading containers…</div>}

      {!loading && error && (
        <div className="menu-grid-status menu-grid-error">
          Failed to load containers: {error}
          <button type="button" className="menu-manager-add" onClick={onChanged}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="ingredient-toolbar">
            <input
              type="search"
              className="ingredient-search"
              placeholder="Search flavour…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="category-tabs">
              {(['expired', 'soon', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? 'category-tab active' : 'category-tab'}
                  onClick={() => setFilter(f)}
                >
                  {f === 'expired' ? `Expired (${expiredCount})` : f === 'soon' ? `Expiring soon (${soonCount})` : 'All containers'}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 && <div className="menu-grid-status">Nothing to show.</div>}

          {visible.length > 0 && (
            <table className="menu-manager-table">
              <thead>
                <tr>
                  <th>Flavour</th>
                  <th>Weight (g)</th>
                  <th>Expiry date</th>
                  <th>Received</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => {
                  const expired = isExpired(b)
                  const soon = !expired && isExpiringSoon(b, windowDays)
                  return (
                    <tr key={b.id}>
                      <td>{nameById.get(b.ingredient_id) ?? 'Unknown'}</td>
                      <td>{b.weight_grams}</td>
                      <td className={expired ? 'ingredient-stock-low' : soon ? 'ingredient-stock-warning' : ''}>
                        {b.expiry_date}
                      </td>
                      <td>{b.received_at.slice(0, 10)}</td>
                      <td>
                        <button type="button" className="menu-manager-edit" onClick={() => setEditingBatch(b)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {editingBatch !== undefined && (
        <IngredientBatchEditor
          batch={editingBatch}
          ingredients={ingredients}
          onClose={() => setEditingBatch(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
