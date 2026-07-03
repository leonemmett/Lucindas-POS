import type { Table } from '../lib/types'

type TableSelectorProps = {
  tables: Table[]
  selectedTableId: string | null
  occupiedTableIds: Set<string>
  disabled: boolean
  onSelect: (tableId: string | null) => void
}

export function TableSelector({ tables, selectedTableId, occupiedTableIds, disabled, onSelect }: TableSelectorProps) {
  return (
    <div className="table-selector">
      <button
        type="button"
        className={selectedTableId === null ? 'table-tab active' : 'table-tab'}
        disabled={disabled}
        onClick={() => onSelect(null)}
      >
        Counter
      </button>
      {tables.map((table) => (
        <button
          key={table.id}
          type="button"
          className={table.id === selectedTableId ? 'table-tab active' : 'table-tab'}
          disabled={disabled}
          onClick={() => onSelect(table.id)}
        >
          {table.name}
          {occupiedTableIds.has(table.id) && <span className="table-tab-dot" />}
        </button>
      ))}
    </div>
  )
}
