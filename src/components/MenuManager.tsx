import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MenuItemEditor } from './MenuItemEditor'
import { downloadCsv, parseCsv, toCsv } from '../lib/csv'
import type { Ingredient, MenuItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const MENU_ITEM_CSV_COLUMNS = ['name', 'category', 'price', 'ball_count', 'weight_grams', 'container', 'is_favourite']

type ImportResult = { created: number; updated: number; errors: string[] }

type MenuManagerProps = {
  menuItems: MenuItem[]
  loading: boolean
  error: string | null
  ingredients: Ingredient[]
  onChanged: () => void
}

export function MenuManager({ menuItems, loading, error, ingredients, onChanged }: MenuManagerProps) {
  const [editingItem, setEditingItem] = useState<MenuItem | null | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((item) => item.category))).sort(),
    [menuItems],
  )

  const ingredientName = (id: string) => ingredients.find((ing) => ing.id === id)?.name ?? 'Unknown'

  function handleSaved() {
    setEditingItem(undefined)
    onChanged()
  }

  async function toggleFavourite(item: MenuItem) {
    await supabase.from('menu_items').update({ is_favourite: !item.is_favourite }).eq('id', item.id)
    onChanged()
  }

  function handleDownload() {
    const rows = menuItems.map((item) => ({
      ...item,
      container: item.container_id ? ingredientName(item.container_id) : '',
    }))
    downloadCsv('menu-items.csv', toCsv(rows, MENU_ITEM_CSV_COLUMNS))
  }

  async function handleUpload(file: File) {
    setImporting(true)
    setImportResult(null)

    const rows = parseCsv(await file.text())
    const byName = new Map(menuItems.map((item) => [item.name.toLowerCase(), item]))
    const ingredientByName = new Map(ingredients.map((ing) => [ing.name.toLowerCase(), ing]))
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row.name?.trim()
      if (!name) {
        errors.push('A row is missing a name and was skipped.')
        continue
      }

      const price = Number(row.price)
      const ballCount = Number(row.ball_count || 0)
      const weightGrams = Number(row.weight_grams || 0)
      if (Number.isNaN(price) || Number.isNaN(ballCount) || Number.isNaN(weightGrams)) {
        errors.push(`"${name}": price/ball_count/weight_grams must be numbers.`)
        continue
      }

      const containerName = row.container?.trim()
      const container = containerName ? ingredientByName.get(containerName.toLowerCase()) : undefined
      if (containerName && !container) {
        errors.push(`"${name}": container "${containerName}" doesn't match any ingredient name.`)
        continue
      }

      const existing = byName.get(name.toLowerCase())
      const payload = {
        name,
        category: row.category?.trim() || 'Other',
        price,
        ball_count: ballCount,
        weight_grams: weightGrams,
        container_id: container?.id ?? null,
        is_favourite: row.is_favourite?.trim().toLowerCase() === 'true',
        recipe: existing?.recipe ?? [],
        updated_at: new Date().toISOString(),
      }

      const { error: rowError } = existing
        ? await supabase.from('menu_items').update(payload).eq('id', existing.id)
        : await supabase.from('menu_items').insert(payload)

      if (rowError) {
        errors.push(`"${name}": ${rowError.message}`)
        continue
      }
      if (existing) updated++
      else created++
    }

    setImporting(false)
    setImportResult({ created, updated, errors })
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Menu items</h2>
        <div className="menu-manager-header-actions">
          <button type="button" className="menu-manager-edit" onClick={handleDownload}>
            Download CSV
          </button>
          <button
            type="button"
            className="menu-manager-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Uploading…' : 'Upload CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="csv-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleUpload(file)
            }}
          />
          <button type="button" className="menu-manager-add" onClick={() => setEditingItem(null)}>
            + New item
          </button>
        </div>
      </div>

      {importResult && (
        <div className="menu-grid-status csv-import-result">
          Added {importResult.created}, updated {importResult.updated}
          {importResult.errors.length > 0 ? `, ${importResult.errors.length} error(s):` : '.'}
          {importResult.errors.length > 0 && (
            <ul>
              {importResult.errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading && <div className="menu-grid-status">Loading menu…</div>}
      {error && <div className="menu-grid-status menu-grid-error">Failed to load menu: {error}</div>}
      {!loading && !error && menuItems.length === 0 && (
        <div className="menu-grid-status">No menu items yet. Add your first one above.</div>
      )}

      {!loading && !error && menuItems.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Container</th>
              <th>Recipe</th>
              <th>Favourite</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{currency.format(item.price)}</td>
                <td>{item.container_id ? ingredientName(item.container_id) : '—'}</td>
                <td>
                  {item.recipe.length === 0
                    ? '—'
                    : item.recipe.map((r) => `${ingredientName(r.ingredient_id)} ×${r.qty}`).join(', ')}
                </td>
                <td>
                  <button
                    type="button"
                    className={item.is_favourite ? 'menu-favourite-star active' : 'menu-favourite-star'}
                    onClick={() => toggleFavourite(item)}
                    title={item.is_favourite ? 'Remove from Favourites tab' : 'Add to Favourites tab'}
                  >
                    {item.is_favourite ? '★' : '☆'}
                  </button>
                </td>
                <td>
                  <button type="button" className="menu-manager-edit" onClick={() => setEditingItem(item)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingItem !== undefined && (
        <MenuItemEditor
          item={editingItem}
          categories={categories}
          ingredients={ingredients}
          onClose={() => setEditingItem(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
