import { useState } from 'react'
import { TableEditor } from './TableEditor'
import type { Table } from '../lib/types'

type TableManagerProps = {
  tables: Table[]
  loading: boolean
  onChanged: () => void
}

export function TableManager({ tables, loading, onChanged }: TableManagerProps) {
  const [editingTable, setEditingTable] = useState<Table | null | undefined>(undefined)

  function handleSaved() {
    setEditingTable(undefined)
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Tables</h2>
        <button type="button" className="menu-manager-add" onClick={() => setEditingTable(null)}>
          + New table
        </button>
      </div>

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
