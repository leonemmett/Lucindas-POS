import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { useAuth } from './lib/AuthContext'
import { useMenuItems } from './hooks/useMenuItems'
import { useTables } from './hooks/useTables'
import { Login } from './components/Login'
import { MenuGrid } from './components/MenuGrid'
import { Ticket } from './components/Ticket'
import { CheckoutModal } from './components/CheckoutModal'
import { TableSelector } from './components/TableSelector'
import type { MenuItem, OpenTicketItem, TicketLine } from './lib/types'
import './App.css'

function App() {
  const { session, loading, signOut } = useAuth()
  const { menuItems, loading: menuLoading, error: menuError } = useMenuItems()
  const { tables } = useTables()

  const [lines, setLines] = useState<TicketLine[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set())
  const [tableSwitching, setTableSwitching] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [saleComplete, setSaleComplete] = useState(false)

  const subtotal = lines.reduce((sum, line) => sum + line.menuItem.price * line.qty, 0)
  const selectedTableName = tables.find((t) => t.id === selectedTableId)?.name ?? null

  function reconstructLines(items: OpenTicketItem[]): TicketLine[] {
    return items.flatMap((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menu_item_id)
      if (!menuItem) return []
      return [{ key: crypto.randomUUID(), menuItem, qty: item.qty }]
    })
  }

  async function refreshOccupiedTables() {
    const { data } = await supabase.from('open_tickets').select('table_id')
    setOccupiedTableIds(new Set((data ?? []).map((row) => row.table_id as string)))
  }

  useEffect(() => {
    refreshOccupiedTables()
  }, [])

  async function persistTable(tableId: string, currentLines: TicketLine[]) {
    if (currentLines.length === 0) {
      await supabase.from('open_tickets').delete().eq('table_id', tableId)
      return
    }
    const items: OpenTicketItem[] = currentLines.map((line) => ({
      menu_item_id: line.menuItem.id,
      qty: line.qty,
    }))
    await supabase
      .from('open_tickets')
      .upsert({ table_id: tableId, items, updated_at: new Date().toISOString() })
  }

  // Autosave the active table's ticket so it survives a refresh without requiring a table switch.
  useEffect(() => {
    if (!selectedTableId) return
    const timeout = setTimeout(() => {
      persistTable(selectedTableId, lines).then(refreshOccupiedTables)
    }, 600)
    return () => clearTimeout(timeout)
  }, [lines, selectedTableId])

  async function handleSelectTable(tableId: string | null) {
    if (tableId === selectedTableId || tableSwitching) return
    setTableSwitching(true)

    if (selectedTableId) {
      await persistTable(selectedTableId, lines)
    }

    let newLines: TicketLine[] = []
    if (tableId) {
      const { data } = await supabase.from('open_tickets').select('items').eq('table_id', tableId).maybeSingle()
      newLines = reconstructLines((data?.items as OpenTicketItem[]) ?? [])
    }

    setSelectedTableId(tableId)
    setLines(newLines)
    await refreshOccupiedTables()
    setTableSwitching(false)
  }

  function handleSelect(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((line) => line.menuItem.id === item.id)
      if (existing) {
        return prev.map((line) =>
          line.menuItem.id === item.id ? { ...line, qty: line.qty + 1 } : line,
        )
      }
      return [...prev, { key: crypto.randomUUID(), menuItem: item, qty: 1 }]
    })
  }

  function handleIncrement(key: string) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, qty: line.qty + 1 } : line)))
  }

  function handleDecrement(key: string) {
    setLines((prev) =>
      prev
        .map((line) => (line.key === key ? { ...line, qty: line.qty - 1 } : line))
        .filter((line) => line.qty > 0),
    )
  }

  function handleRemove(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  function handleClear() {
    setLines([])
  }

  async function handleCheckoutComplete() {
    if (selectedTableId) {
      await supabase.from('open_tickets').delete().eq('table_id', selectedTableId)
      await refreshOccupiedTables()
    }
    setLines([])
    setCheckoutOpen(false)
    setSaleComplete(true)
    setTimeout(() => setSaleComplete(false), 3000)
  }

  if (loading) {
    return <div className="app-loading" />
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Lucinda's POS</h1>
        <div className="app-header-user">
          <span>{session.user.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {saleComplete && <div className="sale-complete-banner">Sale complete</div>}

      <TableSelector
        tables={tables}
        selectedTableId={selectedTableId}
        occupiedTableIds={occupiedTableIds}
        disabled={tableSwitching || checkoutOpen}
        onSelect={handleSelectTable}
      />

      <main className="app-main pos-layout">
        <MenuGrid menuItems={menuItems} loading={menuLoading} error={menuError} onSelect={handleSelect} />
        <Ticket
          lines={lines}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          onClear={handleClear}
          onCharge={() => setCheckoutOpen(true)}
        />
      </main>

      {checkoutOpen && (
        <CheckoutModal
          lines={lines}
          subtotal={subtotal}
          tableName={selectedTableName}
          onClose={() => setCheckoutOpen(false)}
          onComplete={handleCheckoutComplete}
        />
      )}
    </div>
  )
}

export default App
