import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import { Login } from './components/Login'
import { MenuGrid } from './components/MenuGrid'
import { Ticket } from './components/Ticket'
import type { MenuItem, TicketLine } from './lib/types'
import './App.css'

function App() {
  const { session, loading, signOut } = useAuth()
  const [lines, setLines] = useState<TicketLine[]>([])

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
      <main className="app-main pos-layout">
        <MenuGrid onSelect={handleSelect} />
        <Ticket
          lines={lines}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          onClear={handleClear}
        />
      </main>
    </div>
  )
}

export default App
