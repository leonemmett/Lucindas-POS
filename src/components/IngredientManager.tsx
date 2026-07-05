import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { IngredientEditor } from './IngredientEditor'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import { isLowStock } from '../lib/inventory'
import { downloadCsv, parseCsv, toCsv } from '../lib/csv'
import type { Ingredient } from '../lib/types'

type Filter = 'all' | 'flavour' | 'container' | 'low'

const INGREDIENT_CSV_COLUMNS = ['name', 'unit', 'stock', 'low_threshold', 'cost_per_unit', 'is_flavour', 'is_container']

type ImportResult = { created: number; updated: number; errors: string[] }

type IngredientManagerProps = {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  onChanged: () => void
}

export function IngredientManager({ ingredients, loading, error, onChanged }: IngredientManagerProps) {
  const { isAdmin } = useCurrentStaff()
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    let list = ingredients
    if (filter === 'flavour') list = list.filter((i) => i.is_flavour)
    if (filter === 'container') list = list.filter((i) => i.is_container)
    if (filter === 'low') list = list.filter(isLowStock)
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

  function handleDownload() {
    downloadCsv('ingredients.csv', toCsv(ingredients, INGREDIENT_CSV_COLUMNS))
  }

  async function handleUpload(file: File) {
    setImporting(true)
    setImportResult(null)

    const rows = parseCsv(await file.text())
    const byName = new Map(ingredients.map((ing) => [ing.name.toLowerCase(), ing]))
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row.name?.trim()
      if (!name) {
        errors.push('A row is missing a name and was skipped.')
        continue
      }

      const stock = Number(row.stock)
      const lowThreshold = Number(row.low_threshold)
      const costPerUnit = Number(row.cost_per_unit)
      if (Number.isNaN(stock) || Number.isNaN(lowThreshold) || Number.isNaN(costPerUnit)) {
        errors.push(`"${name}": stock/low_threshold/cost_per_unit must be numbers.`)
        continue
      }

      const payload = {
        name,
        unit: row.unit?.trim() || 'unit',
        stock,
        low_threshold: lowThreshold,
        cost_per_unit: costPerUnit,
        is_flavour: row.is_flavour?.trim().toLowerCase() === 'true',
        is_container: row.is_container?.trim().toLowerCase() === 'true',
      }

      const existing = byName.get(name.toLowerCase())
      const { error: rowError } = existing
        ? await supabase.from('ingredients').update(payload).eq('id', existing.id)
        : await supabase.from('ingredients').insert(payload)

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
        <h2>Ingredients</h2>
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
          <button type="button" className="menu-manager-add" onClick={() => setEditingIngredient(null)}>
            + New ingredient
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

      {!loading && error && (
        <div className="menu-grid-status menu-grid-error">
          Failed to load ingredients: {error}
          <button type="button" className="menu-manager-add" onClick={onChanged}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="menu-grid-status">No ingredients match.</div>
      )}

      {!loading && !error && visible.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>Low threshold</th>
              {isAdmin && <th>Cost/unit</th>}
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ing) => {
              const isLow = isLowStock(ing)
              return (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td>{ing.unit}</td>
                  <td className={isLow ? 'ingredient-stock-low' : ''}>{ing.stock}</td>
                  <td>{ing.low_threshold}</td>
                  {isAdmin && <td>{ing.cost_per_unit}</td>}
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
