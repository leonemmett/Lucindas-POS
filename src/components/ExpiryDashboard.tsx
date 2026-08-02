import { useMemo, useState } from 'react'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import { isEmptied, expiryTier } from '../lib/inventory'
import { useExpiryAlertThresholds } from '../hooks/useExpiryAlertThresholds'
import type { Ingredient, IngredientBatch } from '../lib/types'

type Filter = 'red' | 'amber' | 'all'

type ExpiryDashboardProps = {
  batches: IngredientBatch[]
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  onChanged: () => void
}

export function ExpiryDashboard({ batches, ingredients, loading, error, onChanged }: ExpiryDashboardProps) {
  const { amberDays, redDays } = useExpiryAlertThresholds()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('red')
  const [editingBatch, setEditingBatch] = useState<IngredientBatch | null | undefined>(undefined)

  const nameById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.name])), [ingredients])

  const active = useMemo(() => batches.filter((b) => !isEmptied(b)), [batches])

  const visible = useMemo(() => {
    let list = active
    if (filter === 'red') list = list.filter((b) => expiryTier(b, amberDays, redDays) === 'red')
    if (filter === 'amber') list = list.filter((b) => expiryTier(b, amberDays, redDays) === 'amber')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((b) => (nameById.get(b.ingredient_id) ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
  }, [active, filter, search, nameById, amberDays, redDays])

  const redCount = useMemo(
    () => active.filter((b) => expiryTier(b, amberDays, redDays) === 'red').length,
    [active, amberDays, redDays],
  )
  const amberCount = useMemo(
    () => active.filter((b) => expiryTier(b, amberDays, redDays) === 'amber').length,
    [active, amberDays, redDays],
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
              {(['red', 'amber', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? 'category-tab active' : 'category-tab'}
                  onClick={() => setFilter(f)}
                >
                  {f === 'red'
                    ? `Red · ≤${redDays}d (${redCount})`
                    : f === 'amber'
                      ? `Amber · ≤${amberDays}d (${amberCount})`
                      : 'All containers'}
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
                  const tier = expiryTier(b, amberDays, redDays)
                  return (
                    <tr key={b.id}>
                      <td>{nameById.get(b.ingredient_id) ?? 'Unknown'}</td>
                      <td>{b.weight_grams}</td>
                      <td className={tier === 'red' ? 'ingredient-stock-low' : tier === 'amber' ? 'ingredient-stock-warning' : ''}>
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
