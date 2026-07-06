import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { useAuth } from './lib/AuthContext'
import { useMenuItems } from './hooks/useMenuItems'
import { useIngredients } from './hooks/useIngredients'
import { useTables } from './hooks/useTables'
import { useCurrentStaff } from './hooks/useCurrentStaff'
import { Login } from './components/Login'
import { MenuGrid } from './components/MenuGrid'
import { MenuManager } from './components/MenuManager'
import { IngredientManager } from './components/IngredientManager'
import { TableManager } from './components/TableManager'
import { LowStockDashboard } from './components/LowStockDashboard'
import { CashupsScreen } from './components/CashupsScreen'
import { SalesReport } from './components/SalesReport'
import { StaffManager } from './components/StaffManager'
import { SettingsScreen } from './components/SettingsScreen'
import { Ticket } from './components/Ticket'
import { CheckoutModal } from './components/CheckoutModal'
import { TableSelector } from './components/TableSelector'
import { useStaff } from './hooks/useStaff'
import { useReceiptsEnabled } from './hooks/useReceiptsEnabled'
import { useGramsPerBall } from './hooks/useGramsPerBall'
import { useItemPopularity } from './hooks/useItemPopularity'
import { isLowStock } from './lib/inventory'
import { nextTableNumber, tableNameForNumber } from './lib/constants'
import type { FlavorSelection, MenuItem, OpenTicketItem, TicketLine } from './lib/types'
import './App.css'

type View = 'pos' | 'menu' | 'ingredients' | 'tables' | 'low-stock' | 'cashup' | 'reports' | 'staff' | 'settings'

function App() {
  const { session, loading, isCounterSession, signOut } = useAuth()
  const { menuItems, loading: menuLoading, error: menuError, refetch: refetchMenuItems } = useMenuItems()
  const { ingredients, loading: ingredientsLoading, error: ingredientsError, refetch: refetchIngredients } = useIngredients()
  const { tables, loading: tablesLoading, error: tablesError, refetch: refetchTables } = useTables()
  const { isAdmin, active, loaded: staffLoaded } = useCurrentStaff()
  const { staff, loading: staffLoading, error: staffError, refetch: refetchStaff } = useStaff()
  const { enabled: receiptsEnabled, loading: receiptsLoading, save: saveReceiptsEnabled } = useReceiptsEnabled()
  const gramsPerBall = useGramsPerBall()
  const { popularity } = useItemPopularity()

  const lowStockCount = ingredients.filter(isLowStock).length

  const [view, setView] = useState<View>('pos')
  const [lines, setLines] = useState<TicketLine[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set())
  const [tableSwitching, setTableSwitching] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [saleComplete, setSaleComplete] = useState(false)
  const [addingTable, setAddingTable] = useState(false)
  const [staffLoginOpen, setStaffLoginOpen] = useState(false)

  const subtotal = lines.reduce((sum, line) => sum + line.menuItem.price * line.qty, 0)
  const selectedTableName = tables.find((t) => t.id === selectedTableId)?.name ?? null

  useEffect(() => {
    const adminOnlyViews: View[] = ['menu', 'ingredients', 'low-stock', 'reports', 'staff', 'settings']
    if (adminOnlyViews.includes(view) && !isAdmin) setView('pos')
  }, [view, isAdmin])

  // Once a staff member signs in over the counter session, the overlay has done its job.
  useEffect(() => {
    if (!isCounterSession) setStaffLoginOpen(false)
  }, [isCounterSession])

  // Each hook's initial fetch fires on mount, which can race ahead of auth
  // resolving (especially the counter account's network sign-in on a fresh
  // visit) and never retries on its own. Refetch whenever the signed-in
  // identity actually changes so a stale, empty first fetch doesn't stick.
  const sessionUserId = session?.user.id
  useEffect(() => {
    if (!sessionUserId) return
    refetchMenuItems()
    refetchIngredients()
    refetchTables()
    refetchStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId])

  function reconstructLines(items: OpenTicketItem[]): TicketLine[] {
    return items.flatMap((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menu_item_id)
      if (!menuItem) return []
      return [{ key: crypto.randomUUID(), menuItem, qty: item.qty, flavors: item.flavors }]
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
    // A table only closes via explicit checkout (handleCheckoutComplete) — an
    // empty cart here just means "opened but nothing ordered yet", not closed.
    const items: OpenTicketItem[] = currentLines.map((line) => ({
      menu_item_id: line.menuItem.id,
      qty: line.qty,
      flavors: line.flavors,
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

    // A walk-in order started at the Counter often ends with the customer
    // sitting down before paying — moving to a fresh (not-yet-open) table
    // carries the current cart over instead of discarding it. This never
    // applies when switching between two already-open tables, since those
    // are separate in-progress orders that shouldn't get merged.
    if (selectedTableId === null && lines.length > 0 && tableId && !occupiedTableIds.has(tableId)) {
      await persistTable(tableId, lines)
      setSelectedTableId(tableId)
      await refreshOccupiedTables()
      setTableSwitching(false)
      return
    }

    if (selectedTableId) {
      await persistTable(selectedTableId, lines)
    }

    let newLines: TicketLine[] = []
    if (tableId) {
      if (occupiedTableIds.has(tableId)) {
        const { data } = await supabase.from('open_tickets').select('items').eq('table_id', tableId).maybeSingle()
        newLines = reconstructLines((data?.items as OpenTicketItem[]) ?? [])
      } else {
        // Opening a fresh table — create its row immediately so it shows as
        // active right away, even before any items are added.
        await persistTable(tableId, [])
      }
    }

    setSelectedTableId(tableId)
    setLines(newLines)
    await refreshOccupiedTables()
    setTableSwitching(false)
  }

  async function handleCloseTable(tableId: string) {
    const table = tables.find((t) => t.id === tableId)
    if (!confirm(`Close table ${table?.name ?? ''}? This clears its current order.`)) return

    await supabase.from('open_tickets').delete().eq('table_id', tableId)

    if (selectedTableId === tableId) {
      setSelectedTableId(null)
      setLines([])
    }

    await refreshOccupiedTables()
  }

  async function handleQuickAddTable() {
    const nextNumber = nextTableNumber(tables)
    if (nextNumber === null) return

    setAddingTable(true)
    const { data, error } = await supabase
      .from('tables')
      .insert({ name: tableNameForNumber(nextNumber), sort_order: nextNumber })
      .select()
      .single()
    await refetchTables()
    setAddingTable(false)

    if (error || !data) return
    await handleSelectTable(data.id)
  }

  function handleSelect(item: MenuItem, flavors?: FlavorSelection[]) {
    setLines((prev) => {
      // Flavor-customized items always get their own line — each unit needs
      // its own flavor picks, so re-tapping the tile shouldn't silently bump
      // the qty of a previously-chosen (and possibly different) combo.
      if (flavors && flavors.length > 0) {
        return [...prev, { key: crypto.randomUUID(), menuItem: item, qty: 1, flavors }]
      }
      const existing = prev.find((line) => line.menuItem.id === item.id && !line.flavors)
      if (existing) {
        return prev.map((line) =>
          line.menuItem.id === item.id && !line.flavors ? { ...line, qty: line.qty + 1 } : line,
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
      setSelectedTableId(null)
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

  if (!staffLoaded) {
    return <div className="app-loading" />
  }

  if (!active) {
    return (
      <div className="app-loading deactivated-screen">
        <div className="login-card">
          <h1>Account deactivated</h1>
          <p className="login-subtitle">Your account no longer has access. Contact an admin if this seems wrong.</p>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <img src="/logo.png" alt="" aria-hidden="true" className="app-bg-logo" />
      <header className="app-header">
        <div className="app-header-nav">
          <nav className="view-tabs">
            <button
              type="button"
              className={view === 'pos' ? 'view-tab active' : 'view-tab'}
              onClick={() => setView('pos')}
            >
              POS
            </button>
            <button
              type="button"
              className={view === 'tables' ? 'view-tab active' : 'view-tab'}
              onClick={() => setView('tables')}
            >
              Tables
            </button>
            <button
              type="button"
              className={view === 'cashup' ? 'view-tab active' : 'view-tab'}
              onClick={() => setView('cashup')}
            >
              Cashup
            </button>
            {isAdmin && (
              <button
                type="button"
                className={view === 'menu' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('menu')}
              >
                Menu
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={view === 'ingredients' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('ingredients')}
              >
                Ingredients
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={view === 'low-stock' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('low-stock')}
              >
                Low stock
                {lowStockCount > 0 && <span className="nav-badge">{lowStockCount}</span>}
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={view === 'reports' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('reports')}
              >
                Reports
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={view === 'staff' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('staff')}
              >
                Staff
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={view === 'settings' ? 'view-tab active' : 'view-tab'}
                onClick={() => setView('settings')}
              >
                Settings
              </button>
            )}
          </nav>
        </div>
        <div className="app-header-user">
          {isCounterSession ? (
            <button type="button" className="cashup-link-button" onClick={() => setStaffLoginOpen(true)}>
              Staff sign in
            </button>
          ) : (
            <>
              <span>{session.user.email}</span>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {saleComplete && <div className="sale-complete-banner">Sale complete</div>}

      {view === 'pos' && (
        <>
          <TableSelector
            tables={tables}
            selectedTableId={selectedTableId}
            occupiedTableIds={occupiedTableIds}
            disabled={tableSwitching || checkoutOpen}
            addingTable={addingTable}
            onSelect={handleSelectTable}
            onCloseTable={handleCloseTable}
            onAddTable={handleQuickAddTable}
          />

          <main className="app-main pos-layout">
            <MenuGrid
              menuItems={menuItems}
              loading={menuLoading}
              error={menuError}
              ingredients={ingredients}
              gramsPerBall={gramsPerBall}
              popularity={popularity}
              onSelect={handleSelect}
              onRetry={refetchMenuItems}
            />
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
              receiptsEnabled={receiptsEnabled}
              onClose={() => setCheckoutOpen(false)}
              onComplete={handleCheckoutComplete}
            />
          )}
        </>
      )}

      {view === 'menu' && isAdmin && (
        <main className="app-main">
          <MenuManager
            menuItems={menuItems}
            loading={menuLoading}
            error={menuError}
            ingredients={ingredients}
            onChanged={refetchMenuItems}
          />
        </main>
      )}

      {view === 'ingredients' && isAdmin && (
        <main className="app-main">
          <IngredientManager
            ingredients={ingredients}
            loading={ingredientsLoading}
            error={ingredientsError}
            onChanged={refetchIngredients}
          />
        </main>
      )}

      {view === 'tables' && (
        <main className="app-main">
          <TableManager tables={tables} loading={tablesLoading} error={tablesError} onChanged={refetchTables} />
        </main>
      )}

      {view === 'low-stock' && isAdmin && (
        <main className="app-main">
          <LowStockDashboard
            ingredients={ingredients}
            loading={ingredientsLoading}
            error={ingredientsError}
            onChanged={refetchIngredients}
          />
        </main>
      )}

      {view === 'cashup' && (
        <main className="app-main">
          <CashupsScreen />
        </main>
      )}

      {view === 'reports' && isAdmin && (
        <main className="app-main">
          <SalesReport />
        </main>
      )}

      {view === 'staff' && isAdmin && (
        <main className="app-main">
          <StaffManager staff={staff} loading={staffLoading} error={staffError} onChanged={refetchStaff} />
        </main>
      )}

      {view === 'settings' && isAdmin && (
        <main className="app-main">
          <SettingsScreen
            receiptsEnabled={receiptsEnabled}
            loading={receiptsLoading}
            onSaveReceiptsEnabled={saveReceiptsEnabled}
          />
        </main>
      )}

      {staffLoginOpen && (
        <div className="modal-overlay">
          <Login onCancel={() => setStaffLoginOpen(false)} />
        </div>
      )}
    </div>
  )
}

export default App
