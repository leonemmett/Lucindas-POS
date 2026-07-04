import { useRef } from 'react'
import { MAX_TABLES } from '../lib/constants'
import type { Table } from '../lib/types'

const LONG_PRESS_MS = 550

type TableSelectorProps = {
  tables: Table[]
  selectedTableId: string | null
  occupiedTableIds: Set<string>
  disabled: boolean
  addingTable: boolean
  onSelect: (tableId: string | null) => void
  onCloseTable: (tableId: string) => void
  onAddTable: () => void
}

export function TableSelector({
  tables,
  selectedTableId,
  occupiedTableIds,
  disabled,
  addingTable,
  onSelect,
  onCloseTable,
  onAddTable,
}: TableSelectorProps) {
  const activeTables = tables.filter((t) => occupiedTableIds.has(t.id))
  const availableTables = tables.filter((t) => !occupiedTableIds.has(t.id))
  const canAddTable = tables.length < MAX_TABLES

  const pressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  function handlePressStart(tableId: string) {
    longPressFired.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      onCloseTable(tableId)
    }, LONG_PRESS_MS)
  }

  function handlePressEnd() {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function handleClick(tableId: string) {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    onSelect(tableId)
  }

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
        {canAddTable && (
          <button
            type="button"
            className="table-tab table-tab-add"
            disabled={disabled || addingTable}
            onClick={onAddTable}
            aria-label="Add table"
            title="Add table"
          >
            {addingTable ? '…' : 'Add table'}
          </button>
        )}
        {activeTables.map((table) => (
          <button
            key={table.id}
            type="button"
            className={table.id === selectedTableId ? 'table-tab active' : 'table-tab'}
            disabled={disabled}
            onPointerDown={() => handlePressStart(table.id)}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => handleClick(table.id)}
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
              {table.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
