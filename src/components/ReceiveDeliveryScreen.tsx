import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ingredient, IngredientBatch } from '../lib/types'

type ReceiveDeliveryScreenProps = {
  ingredients: Ingredient[]
  batches: IngredientBatch[]
  loading: boolean
  error: string | null
  onChanged: () => void
  onBatchesChanged: () => void
}

type Received = { name: string; amount: number; unit: string; newTotal: number }

export function ReceiveDeliveryScreen({
  ingredients,
  batches,
  loading,
  error,
  onChanged,
  onBatchesChanged,
}: ReceiveDeliveryScreenProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recent, setRecent] = useState<Received[]>([])

  const batchTrackedIds = useMemo(() => new Set(batches.map((b) => b.ingredient_id)), [batches])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? ingredients.filter((i) => i.name.toLowerCase().includes(q)) : ingredients
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50)
  }, [ingredients, search])

  const selected = ingredients.find((i) => i.id === selectedId) ?? null

  function resetForm() {
    setSelectedId(null)
    setAmount('')
    setExpiryDate('')
    setSubmitError(null)
  }

  async function handleReceive() {
    if (!selected) return
    const qty = Number(amount)
    if (Number.isNaN(qty) || qty <= 0) {
      setSubmitError('Enter how many arrived.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const isBatchTracked = batchTrackedIds.has(selected.id)

    // Two different write paths, because ingredients.stock is a derived sum
    // for anything with batch rows (see the sync trigger) but a plain editable
    // number otherwise. Writing a batch to a never-batched ingredient would
    // make the trigger REPLACE its existing stock with just this delivery,
    // silently losing whatever was already on the shelf — so only take the
    // batch path when the ingredient is already batch-tracked, or when an
    // expiry date is supplied (in which case the pre-existing stock is
    // preserved as its own dateless batch first).
    if (isBatchTracked || expiryDate) {
      if (!isBatchTracked && selected.stock > 0) {
        // Preserve what's already on the shelf as its own batch before the
        // trigger takes over this ingredient's stock. Its real expiry isn't
        // known (it predates tracking), so it's left blank rather than
        // guessed at — an invented date would read as a genuine alert later.
        const { error: preserveError } = await supabase.from('ingredient_batches').insert({
          ingredient_id: selected.id,
          weight_grams: selected.stock,
          expiry_date: null,
          note: 'Stock on hand before expiry tracking started — expiry unknown',
        })
        if (preserveError) {
          setSubmitting(false)
          setSubmitError(preserveError.message)
          return
        }
      }

      const { error: batchError } = await supabase.from('ingredient_batches').insert({
        ingredient_id: selected.id,
        weight_grams: qty,
        expiry_date: expiryDate || null,
      })
      if (batchError) {
        setSubmitting(false)
        setSubmitError(batchError.message)
        return
      }
      onBatchesChanged()
    } else {
      const { error: stockError } = await supabase
        .from('ingredients')
        .update({ stock: selected.stock + qty })
        .eq('id', selected.id)
      if (stockError) {
        setSubmitting(false)
        setSubmitError(stockError.message)
        return
      }
      onChanged()
    }

    setRecent((prev) => [
      { name: selected.name, amount: qty, unit: selected.unit, newTotal: selected.stock + qty },
      ...prev,
    ])
    setSubmitting(false)
    resetForm()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Receive delivery</h2>
      </div>

      <p className="settings-hint">
        Log what arrived and it's added to whatever's already in stock. An expiry date is optional — enter it for
        anything dated (gelato tubs, milk, syrups) and leave it blank for daily items like brownies or cookies.
      </p>

      {loading && <div className="menu-grid-status">Loading ingredients…</div>}

      {!loading && error && (
        <div className="menu-grid-status menu-grid-error">
          Failed to load ingredients: {error}
          <button type="button" className="menu-manager-add" onClick={onChanged}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {recent.length > 0 && (
            <div className="menu-grid-status csv-import-result">
              Added this session:
              <ul>
                {recent.map((r, i) => (
                  <li key={i}>
                    {r.name}: +{r.amount}
                    {r.unit === 'pcs' ? '' : r.unit} (now {r.newTotal}
                    {r.unit === 'pcs' ? ` ${r.unit}` : r.unit})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!selected && (
            <>
              <div className="ingredient-toolbar">
                <input
                  type="search"
                  className="ingredient-search"
                  placeholder="Search for what arrived…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {visible.length === 0 ? (
                <div className="menu-grid-status">No ingredients match.</div>
              ) : (
                <table className="menu-manager-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>In stock</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((ing) => (
                      <tr key={ing.id}>
                        <td>{ing.name}</td>
                        <td>
                          {Math.round(ing.stock * 10) / 10} {ing.unit}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="menu-manager-edit"
                            onClick={() => {
                              setSelectedId(ing.id)
                              setAmount('')
                              setExpiryDate('')
                              setSubmitError(null)
                            }}
                          >
                            Receive
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {selected && (
            <section className="cashup-section">
              <h3>{selected.name}</h3>
              <p className="settings-hint">
                Currently {Math.round(selected.stock * 10) / 10} {selected.unit} in stock.
              </p>

              <label htmlFor="receive-amount">
                How many arrived? ({selected.unit === 'pcs' ? 'pieces' : selected.unit})
              </label>
              <input
                id="receive-amount"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />

              <label htmlFor="receive-expiry">Expiry date (optional)</label>
              <input
                id="receive-expiry"
                type="date"
                className="fixed-cost-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />

              {submitError && <p className="checkout-error">{submitError}</p>}

              <div className="checkout-actions">
                <button type="button" className="checkout-cancel" onClick={resetForm} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="checkout-confirm"
                  onClick={handleReceive}
                  disabled={submitting || !amount}
                >
                  {submitting ? 'Adding…' : 'Add to stock'}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
