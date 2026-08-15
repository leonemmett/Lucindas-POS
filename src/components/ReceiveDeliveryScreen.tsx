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

type Received = { name: string; amount: number; unit: string; newTotal: number; isNew?: boolean }

const UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'bag', label: 'Bags' },
]

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

  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('pcs')
  const [newCost, setNewCost] = useState('')

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
    setAddingNew(false)
    setNewName('')
    setNewUnit('pcs')
    setNewCost('')
  }

  async function handleCreateAndReceive() {
    const name = newName.trim()
    const qty = Number(amount)
    if (!name) {
      setSubmitError('Give the new item a name.')
      return
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setSubmitError('Enter how many arrived.')
      return
    }
    if (ingredients.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      setSubmitError(`"${name}" already exists — search for it in the list instead of adding a duplicate.`)
      return
    }
    const cost = newCost.trim() ? Number(newCost) : 0
    if (Number.isNaN(cost) || cost < 0) {
      setSubmitError('Cost must be a number.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    // low_threshold 0 means "don't alert on this" (see lib/inventory.ts) —
    // the right default for something brand new, since nobody has decided
    // yet what a sensible reorder level is. An admin can set one later.
    const { data: created, error: createError } = await supabase
      .from('ingredients')
      .insert({
        name,
        unit: newUnit,
        stock: expiryDate ? 0 : qty,
        low_threshold: 0,
        cost_per_unit: cost,
        is_flavour: false,
        is_container: false,
      })
      .select()
      .single()

    if (createError) {
      setSubmitting(false)
      setSubmitError(createError.message)
      return
    }

    // With an expiry date the quantity belongs on a batch row instead, and
    // the sync trigger derives stock from it — hence stock: 0 above, so the
    // amount isn't counted twice.
    if (expiryDate) {
      const { error: batchError } = await supabase.from('ingredient_batches').insert({
        ingredient_id: created.id,
        weight_grams: qty,
        expiry_date: expiryDate,
      })
      if (batchError) {
        setSubmitting(false)
        setSubmitError(batchError.message)
        return
      }
      onBatchesChanged()
    } else {
      onChanged()
    }

    setRecent((prev) => [{ name, amount: qty, unit: newUnit, newTotal: qty, isNew: true }, ...prev])
    setSubmitting(false)
    resetForm()
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
                    {r.unit === 'pcs' ? ` ${r.unit}` : r.unit}){r.isNew ? ' — new item' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!selected && !addingNew && (
            <>
              <div className="ingredient-toolbar">
                <input
                  type="search"
                  className="ingredient-search"
                  placeholder="Search for what arrived…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="menu-manager-add"
                  onClick={() => {
                    setAddingNew(true)
                    setNewName(search.trim())
                    setAmount('')
                    setExpiryDate('')
                    setSubmitError(null)
                  }}
                >
                  + New item
                </button>
              </div>

              {visible.length === 0 ? (
                <div className="menu-grid-status">
                  Nothing matches "{search.trim()}" — use "+ New item" if this is something you've never had before.
                </div>
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

          {addingNew && (
            <section className="cashup-section">
              <h3>New item</h3>
              <p className="settings-hint">
                For something the shop has never stocked before. It'll be created and this delivery added straight
                away — an admin can set a low-stock alert level or link it to a menu item's recipe afterwards.
              </p>

              <label htmlFor="new-name">Name</label>
              <input
                id="new-name"
                type="text"
                className="fixed-cost-input"
                placeholder="e.g. Pistachio Paste"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />

              <label htmlFor="new-unit">Measured in</label>
              <select
                id="new-unit"
                className="fixed-cost-input"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>

              <label htmlFor="new-amount">
                How many arrived? ({newUnit === 'pcs' ? 'pieces' : newUnit})
              </label>
              <input
                id="new-amount"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <label htmlFor="new-cost">Cost per {newUnit === 'pcs' ? 'piece' : newUnit} (optional)</label>
              <input
                id="new-cost"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                placeholder="0.00"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />

              <label htmlFor="new-expiry">Expiry date (optional)</label>
              <input
                id="new-expiry"
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
                  onClick={handleCreateAndReceive}
                  disabled={submitting || !newName.trim() || !amount}
                >
                  {submitting ? 'Adding…' : 'Create & add to stock'}
                </button>
              </div>
            </section>
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
