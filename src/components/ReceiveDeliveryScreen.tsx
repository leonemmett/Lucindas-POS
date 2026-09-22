import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { IngredientBatchEditor } from './IngredientBatchEditor'
import { categorizeIngredient, INGREDIENT_CATEGORIES } from '../lib/inventory'
import type { Ingredient, IngredientBatch, MenuItem } from '../lib/types'

type ReceiveDeliveryScreenProps = {
  ingredients: Ingredient[]
  batches: IngredientBatch[]
  menuItems: MenuItem[]
  loading: boolean
  error: string | null
  onChanged: () => void
  onBatchesChanged: () => void
  onMenuItemsChanged: () => void
}

type Received = {
  name: string
  amount: number
  unit: string
  newTotal: number
  isNew?: boolean
  addedToMenu?: boolean
}

const UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'bag', label: 'Bags' },
]

export function ReceiveDeliveryScreen({
  ingredients,
  batches,
  menuItems,
  loading,
  error,
  onChanged,
  onBatchesChanged,
  onMenuItemsChanged,
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
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newSalePrice, setNewSalePrice] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const [editingDetailsFor, setEditingDetailsFor] = useState<Ingredient | null>(null)
  const [editItemCategory, setEditItemCategory] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editSalePrice, setEditSalePrice] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [batchEditorFor, setBatchEditorFor] = useState<{ ingredient: Ingredient; batch: IngredientBatch | null } | null>(
    null,
  )
  const [addingBatch, setAddingBatch] = useState(false)

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((item) => item.category))).sort(),
    [menuItems],
  )

  const batchTrackedIds = useMemo(() => new Set(batches.map((b) => b.ingredient_id)), [batches])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? ingredients.filter((i) => i.name.toLowerCase().includes(q)) : ingredients
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50)
  }, [ingredients, search])

  const selected = ingredients.find((i) => i.id === selectedId) ?? null

  // Same name-match convention CSV import uses to line up rows — a packaged
  // item's ingredient and its menu item share a name, so there's no explicit
  // link to manage; this just finds the other half of the same product.
  function findLinkedMenuItem(ing: Ingredient) {
    return menuItems.find((m) => m.name.toLowerCase() === ing.name.toLowerCase()) ?? null
  }

  // Soonest-expiring first, undated batches last — the same order sales are
  // deducted from (see deduct_ingredient_stock), so the list on screen reads
  // top-to-bottom in the order it'll actually be sold down.
  function activeBatchesFor(ing: Ingredient) {
    return batches
      .filter((b) => b.ingredient_id === ing.id && !b.emptied_at)
      .sort((a, b) => {
        if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date)
        if (a.expiry_date) return -1
        if (b.expiry_date) return 1
        return a.received_at.localeCompare(b.received_at)
      })
  }

  function openEditBatch(ing: Ingredient, batch: IngredientBatch) {
    setBatchEditorFor({ ingredient: ing, batch })
  }

  async function openAddBatch(ing: Ingredient) {
    // Same conversion handleReceive() already does: an ingredient with no
    // batch rows yet has its stock as one plain number, and the moment a
    // batch row exists for it, ingredients.stock becomes trigger-derived
    // from the sum of its batches — so the pre-existing stock has to be
    // captured as its own (dateless, expiry-unknown) batch first, or it
    // would simply vanish once the new dated batch takes over.
    if (!batchTrackedIds.has(ing.id) && ing.stock > 0) {
      setAddingBatch(true)
      setEditError(null)
      const { error: preserveError } = await supabase.from('ingredient_batches').insert({
        ingredient_id: ing.id,
        weight_grams: ing.stock,
        expiry_date: null,
        note: 'Stock on hand before expiry tracking started — expiry unknown',
      })
      setAddingBatch(false)
      if (preserveError) {
        setEditError(preserveError.message)
        return
      }
      onBatchesChanged()
    }
    setBatchEditorFor({ ingredient: ing, batch: null })
  }

  function openEditDetails(ing: Ingredient) {
    const linked = findLinkedMenuItem(ing)
    setEditingDetailsFor(ing)
    setEditItemCategory(ing.category ?? categorizeIngredient(ing))
    setEditCost(String(ing.cost_per_unit))
    setEditSalePrice(linked ? String(linked.price) : '')
    setEditCategory(linked?.category ?? '')
    setEditError(null)
  }

  function closeEditDetails() {
    setEditingDetailsFor(null)
    setEditItemCategory('')
    setEditCost('')
    setEditSalePrice('')
    setEditCategory('')
    setEditError(null)
  }

  async function handleSaveDetails() {
    if (!editingDetailsFor) return
    const cost = editCost.trim() ? Number(editCost) : 0
    if (Number.isNaN(cost) || cost < 0) {
      setEditError('Cost must be a number.')
      return
    }
    const salePrice = editSalePrice.trim() ? Number(editSalePrice) : null
    if (salePrice !== null && (Number.isNaN(salePrice) || salePrice < 0)) {
      setEditError('Sale price must be a number.')
      return
    }

    setEditSubmitting(true)
    setEditError(null)

    const { error: costError } = await supabase
      .from('ingredients')
      .update({
        cost_per_unit: cost,
        category: editItemCategory || null,
        is_container: editItemCategory === 'Containers & Cups',
        is_milk: editItemCategory === 'Milk',
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingDetailsFor.id)
    if (costError) {
      setEditSubmitting(false)
      setEditError(costError.message)
      return
    }
    onChanged()

    // Leaving sale price blank means "don't touch the menu side" — it's
    // pre-filled from the linked item when one exists, so a blank only
    // happens here if there was never a linked item to begin with.
    if (salePrice !== null) {
      const linked = findLinkedMenuItem(editingDetailsFor)
      const category = editCategory.trim() || 'Other'

      if (linked) {
        const { error: menuError } = await supabase
          .from('menu_items')
          .update({ price: salePrice, category, updated_at: new Date().toISOString() })
          .eq('id', linked.id)
        if (menuError) {
          setEditSubmitting(false)
          setEditError(`Cost saved, but updating the menu item failed: ${menuError.message}`)
          return
        }
      } else {
        const { error: menuError } = await supabase.from('menu_items').insert({
          name: editingDetailsFor.name,
          category,
          price: salePrice,
          recipe: [{ ingredient_id: editingDetailsFor.id, qty: 1 }],
        })
        if (menuError) {
          setEditSubmitting(false)
          setEditError(`Cost saved, but adding it to the menu failed: ${menuError.message}`)
          return
        }
      }
      onMenuItemsChanged()
    }

    setEditSubmitting(false)
    closeEditDetails()
  }

  function resetForm() {
    setSelectedId(null)
    setAmount('')
    setExpiryDate('')
    setSubmitError(null)
    setAddingNew(false)
    setNewName('')
    setNewUnit('pcs')
    setNewItemCategory('')
    setNewCost('')
    setNewSalePrice('')
    setNewCategory('')
  }

  async function handleCreateAndReceive() {
    const name = newName.trim()
    const qty = Number(amount)
    if (!name) {
      setSubmitError('Give the new item a name.')
      return
    }
    if (!newItemCategory) {
      setSubmitError('Choose a category.')
      return
    }
    // Containers (cups, cones, lids…) don't go off, so they're the one
    // category exempt from requiring an expiry date — everything else does.
    if (newItemCategory !== 'Containers & Cups' && !expiryDate) {
      setSubmitError('Enter an expiry date.')
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
    const salePrice = newSalePrice.trim() ? Number(newSalePrice) : null
    if (salePrice !== null && (Number.isNaN(salePrice) || salePrice < 0)) {
      setSubmitError('Sale price must be a number.')
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
        category: newItemCategory,
        is_flavour: false,
        is_container: newItemCategory === 'Containers & Cups',
        is_milk: newItemCategory === 'Milk',
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

    // A sale price means this is something customers buy directly (e.g. a new
    // packaged drink), not just a raw ingredient — so it also needs a menu
    // item, linked back via a one-line recipe the same way existing packaged
    // items (Coca-Cola, Sprite, etc.) decrement their can/bottle per sale.
    if (salePrice !== null) {
      const { error: menuError } = await supabase.from('menu_items').insert({
        name,
        category: newCategory.trim() || 'Other',
        price: salePrice,
        recipe: [{ ingredient_id: created.id, qty: 1 }],
      })
      if (menuError) {
        setSubmitting(false)
        setSubmitError(`Item was received, but adding it to the menu failed: ${menuError.message}`)
        return
      }
      onMenuItemsChanged()
    }

    setRecent((prev) => [
      { name, amount: qty, unit: newUnit, newTotal: qty, isNew: true, addedToMenu: salePrice !== null },
      ...prev,
    ])
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
                    {r.addedToMenu ? ', added to menu' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!selected && !addingNew && !editingDetailsFor && (
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
                    setNewItemCategory('')
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
                        <td>
                          <button type="button" className="menu-manager-edit" onClick={() => openEditDetails(ing)}>
                            Edit details
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

              <label htmlFor="new-item-category">Category</label>
              <select
                id="new-item-category"
                className="fixed-cost-input"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
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

              <label htmlFor="new-expiry">
                Expiry date{newItemCategory === 'Containers & Cups' ? ' (optional)' : ''}
              </label>
              <input
                id="new-expiry"
                type="date"
                className="fixed-cost-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
              {newItemCategory && newItemCategory !== 'Containers & Cups' && (
                <p className="settings-hint">Required for anything that can go off.</p>
              )}

              <label htmlFor="new-sale-price">Sale price (optional)</label>
              <input
                id="new-sale-price"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                placeholder="0.00"
                value={newSalePrice}
                onChange={(e) => setNewSalePrice(e.target.value)}
              />

              {newSalePrice.trim() && (
                <>
                  <label htmlFor="new-category">Menu category (optional)</label>
                  <input
                    id="new-category"
                    list="new-item-category-options"
                    className="fixed-cost-input"
                    placeholder="Other"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <datalist id="new-item-category-options">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <p className="settings-hint">
                    A sale price adds this to the menu too, so it can be sold straight away — otherwise it's just
                    tracked as stock.
                  </p>
                </>
              )}

              {submitError && <p className="checkout-error">{submitError}</p>}

              <div className="checkout-actions">
                <button type="button" className="checkout-cancel" onClick={resetForm} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="checkout-confirm"
                  onClick={handleCreateAndReceive}
                  disabled={
                    submitting ||
                    !newName.trim() ||
                    !amount ||
                    !newItemCategory ||
                    (newItemCategory !== 'Containers & Cups' && !expiryDate)
                  }
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

          {editingDetailsFor && (
            <section className="cashup-section">
              <h3>{editingDetailsFor.name}</h3>
              <p className="settings-hint">
                Fix up category, cost, sale price and expiry dates after the fact — the same details required when
                logging a brand new item.
              </p>

              <label htmlFor="edit-item-category">Category</label>
              <select
                id="edit-item-category"
                className="fixed-cost-input"
                value={editItemCategory}
                onChange={(e) => setEditItemCategory(e.target.value)}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label htmlFor="edit-cost">Cost per {editingDetailsFor.unit === 'pcs' ? 'piece' : editingDetailsFor.unit}</label>
              <input
                id="edit-cost"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                placeholder="0.00"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                autoFocus
              />

              <label htmlFor="edit-sale-price">Sale price</label>
              <input
                id="edit-sale-price"
                type="number"
                inputMode="decimal"
                className="fixed-cost-input"
                placeholder="Not sold on the menu"
                value={editSalePrice}
                onChange={(e) => setEditSalePrice(e.target.value)}
              />

              {editSalePrice.trim() && (
                <>
                  <label htmlFor="edit-category">Category</label>
                  <input
                    id="edit-category"
                    list="edit-item-category-options"
                    className="fixed-cost-input"
                    placeholder="Other"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  />
                  <datalist id="edit-item-category-options">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <p className="settings-hint">
                    {findLinkedMenuItem(editingDetailsFor)
                      ? "Updates the existing menu item's price and category."
                      : "This item isn't on the menu yet — setting a sale price adds it."}
                  </p>
                </>
              )}

              <h4 className="low-stock-section-title">Expiry dates</h4>
              <p className="settings-hint">
                Different deliveries of the same item can expire on different dates — each stays its own entry below
                rather than being merged into one. Sales are always taken from whichever entry expires soonest, so
                the oldest stock naturally sells down first without anyone having to manage that by hand.
              </p>

              {activeBatchesFor(editingDetailsFor).length === 0 ? (
                <p className="menu-grid-status">
                  {editingDetailsFor.stock > 0
                    ? "This item's stock doesn't have an expiry date tracked yet."
                    : 'No stock on hand.'}
                </p>
              ) : (
                <table className="menu-manager-table">
                  <thead>
                    <tr>
                      <th>Expiry date</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatchesFor(editingDetailsFor).map((b) => (
                      <tr key={b.id}>
                        <td>{b.expiry_date ?? 'No expiry set'}</td>
                        <td>
                          {Math.round(b.weight_grams * 10) / 10} {editingDetailsFor.unit}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="menu-manager-edit"
                            onClick={() => openEditBatch(editingDetailsFor, b)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <button
                type="button"
                className="menu-manager-add"
                onClick={() => openAddBatch(editingDetailsFor)}
                disabled={addingBatch}
              >
                {addingBatch ? 'Adding…' : '+ Add expiry date'}
              </button>

              {editError && <p className="checkout-error">{editError}</p>}

              <div className="checkout-actions">
                <button type="button" className="checkout-cancel" onClick={closeEditDetails} disabled={editSubmitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="checkout-confirm"
                  onClick={handleSaveDetails}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving…' : 'Save details'}
                </button>
              </div>
            </section>
          )}

          {batchEditorFor && (
            <IngredientBatchEditor
              batch={batchEditorFor.batch}
              ingredients={ingredients}
              initialIngredientId={batchEditorFor.ingredient.id}
              onClose={() => setBatchEditorFor(null)}
              onSaved={() => {
                setBatchEditorFor(null)
                onBatchesChanged()
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
