import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TableEditor } from './TableEditor'
import { MAX_TABLES, nextTableNumber, tableNameForNumber } from '../lib/constants'
import type { Table } from '../lib/types'

type TableManagerProps = {
  tables: Table[]
  loading: boolean
  error: string | null
  onChanged: () => void
}

export function TableManager({ tables, loading, error, onChanged }: TableManagerProps) {
  const [editingTable, setEditingTable] = useState<Table | null | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const nextNumber = useMemo(() => nextTableNumber(tables), [tables])

  function handleSaved() {
    setEditingTable(undefined)
    onChanged()
  }

  async function handleQuickAdd() {
    if (nextNumber === null) return
    setCreating(true)
    setCreateError(null)
    const { error } = await supabase
      .from('tables')
      .insert({ name: tableNameForNumber(nextNumber), sort_order: nextNumber })
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
          {nextNumber === null
            ? `All ${MAX_TABLES} tables added`
            : creating
              ? 'Adding…'
              : `Add ${tableNameForNumber(nextNumber)}`}
        </button>
      </div>

      {createError && <p className="checkout-error">{createError}</p>}

      {loading && <div className="menu-grid-status">Loading tables…</div>}

      {!loading && error && (
        <div className="menu-grid-status menu-grid-error">
          Failed to load tables: {error}
          <button type="button" className="menu-manager-add" onClick={onChanged}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && tables.length === 0 && <div className="menu-grid-status">No tables yet.</div>}

      {!loading && !error && tables.length > 0 && (
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
