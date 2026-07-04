import type { Table } from '../lib/types'

type TableSelectorProps = {
  tables: Table[]
  selectedTableId: string | null
  occupiedTableIds: Set<string>
  disabled: boolean
  onSelect: (tableId: string | null) => void
}

export function TableSelector({ tables, selectedTableId, occupiedTableIds, disabled, onSelect }: TableSelectorProps) {
  const activeTables = tables.filter((t) => occupiedTableIds.has(t.id))
  const availableTables = tables.filter((t) => !occupiedTableIds.has(t.id))

  return (
    <div className="table-selector">
      <div className="table-selector-row">
        <button
          type="button"
          className={selectedTableId === null ? 'table-tab active' : 'table-tab'}
          disabled={disabled}
          onClick={() => onSelect(null)}
        >
          Counter
        </button>
        {activeTables.map((table) => (
          <button
            key={table.id}
            type="button"
            className={table.id === selectedTableId ? 'table-tab active' : 'table-tab'}
            disabled={disabled}
            onClick={() => onSelect(table.id)}
          >
            {table.name}
          </button>
        ))}
      </div>

      {availableTables.length > 0 && (
        <div className="table-selector-row table-selector-available">
          <span className="table-selector-label">Open a table:</span>
          {availableTables.map((table) => (
            <button
              key={table.id}
              type="button"
              className="table-tab table-tab-available"
              disabled={disabled}
              onClick={() => onSelect(table.id)}
            >
              + {table.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
