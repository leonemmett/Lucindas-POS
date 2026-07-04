import { useMemo, useState } from 'react'
import type { Ingredient } from '../lib/types'

type FlavorSearchSelectProps = {
  id: string
  flavours: Ingredient[]
  value: string
  onChange: (ingredientId: string) => void
}

export function FlavorSearchSelect({ id, flavours, value, onChange }: FlavorSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = flavours.find((f) => f.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flavours
    return flavours.filter((f) => f.name.toLowerCase().includes(q))
  }, [flavours, query])

  function handlePick(f: Ingredient) {
    onChange(f.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="flavor-select" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <input
        id={id}
        type="text"
        className="flavor-select-input"
        placeholder="Search flavor…"
        value={open ? query : (selected?.name ?? '')}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <ul className="flavor-select-options">
          {filtered.length === 0 ? (
            <li className="flavor-select-empty">No matches</li>
          ) : (
            filtered.map((f) => (
              <li key={f.id} onMouseDown={() => handlePick(f)}>
                {f.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
