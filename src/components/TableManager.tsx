import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TableEditor } from './TableEditor'
import type { Table } from '../lib/types'

const MAX_TABLES = 8

type TableManagerProps = {
  tables: Table[]
  loading: boolean
  onChanged: () => void
}

export function TableManager({ tables, loading, onChanged }: TableManagerProps) {
  const [editingTable, setEditingTable] = useState<Table | null | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const nextNumber = useMemo(() => {
    const usedNames = new Set(tables.map((t) => t.name))
    for (let n = 1; n <= MAX_TABLES; n++) {
      if (!usedNames.has(String(n))) return n
    }
    return null
  }, [tables])

  function handleSaved() {
    setEditingTable(undefined)
    onChanged()
  }

  async function handleQuickAdd() {
    if (nextNumber === null) return
    setCreating(true)
    setCreateError(null)
    const { error } = await supabase.from('tables').insert({ name: String(nextNumber), sort_order: nextNumber })
    setCreating(false)

    if (error) {
      setCreateError(error.message)
      return
    }

    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Tables</h2>
        <button
          type="button"
          className="menu-manager-add"
          onClick={handleQuickAdd}
          disabled={creating || nextNumber === null}
        >
          {nextNumber === null ? `All ${MAX_TABLES} tables added` : creating ? 'Adding…' : `+ Add table ${nextNumber}`}
        </button>
      </div>

      {createError && <p className="checkout-error">{createError}</p>}

      {loading && <div className="menu-grid-status">Loading tables…</div>}
      {!loading && tables.length === 0 && <div className="menu-grid-status">No tables yet.</div>}

      {!loading && tables.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Sort order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.sort_order}</td>
                <td>
                  <button type="button" className="menu-manager-edit" onClick={() => setEditingTable(t)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingTable !== undefined && (
        <TableEditor table={editingTable} onClose={() => setEditingTable(undefined)} onSaved={handleSaved} />
      )}
    </div>
  )
}
