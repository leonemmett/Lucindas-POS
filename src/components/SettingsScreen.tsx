import { useEffect, useState } from 'react'

type SettingsScreenProps = {
  receiptsEnabled: boolean
  loading: boolean
  onSaveReceiptsEnabled: (next: boolean) => void
  amberDays: number
  redDays: number
  expiryLoading: boolean
  onSaveAmberDays: (next: number) => void
  onSaveRedDays: (next: number) => void
}

export function SettingsScreen({
  receiptsEnabled,
  loading,
  onSaveReceiptsEnabled,
  amberDays,
  redDays,
  expiryLoading,
  onSaveAmberDays,
  onSaveRedDays,
}: SettingsScreenProps) {
  const [amberInput, setAmberInput] = useState(String(amberDays))
  const [redInput, setRedInput] = useState(String(redDays))

  useEffect(() => setAmberInput(String(amberDays)), [amberDays])
  useEffect(() => setRedInput(String(redDays)), [redDays])

  function commitAmber() {
    const next = Number(amberInput)
    if (Number.isFinite(next) && next > 0) onSaveAmberDays(next)
    else setAmberInput(String(amberDays))
  }

  function commitRed() {
    const next = Number(redInput)
    if (Number.isFinite(next) && next > 0) onSaveRedDays(next)
    else setRedInput(String(redDays))
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Settings</h2>
      </div>

      {loading ? (
        <div className="menu-grid-status">Loading…</div>
      ) : (
        <div className="cashup-section settings-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={receiptsEnabled}
              onChange={(e) => onSaveReceiptsEnabled(e.target.checked)}
            />
            Print receipt after checkout
          </label>
          <p className="settings-hint">
            When off, checkout completes immediately without offering a receipt.
          </p>
        </div>
      )}

      {expiryLoading ? (
        <div className="menu-grid-status">Loading…</div>
      ) : (
        <div className="cashup-section settings-section">
          <label htmlFor="settings-amber-days">Amber expiry warning (days)</label>
          <input
            id="settings-amber-days"
            type="number"
            min={1}
            value={amberInput}
            onChange={(e) => setAmberInput(e.target.value)}
            onBlur={commitAmber}
          />
          <label htmlFor="settings-red-days">Red expiry warning (days)</label>
          <input
            id="settings-red-days"
            type="number"
            min={1}
            value={redInput}
            onChange={(e) => setRedInput(e.target.value)}
            onBlur={commitRed}
          />
          <p className="settings-hint">
            Containers (gelato or any other tracked ingredient) show amber once they're this many days from
            expiry, and red once they're within the red window — red always wins.
          </p>
        </div>
      )}
    </div>
  )
}
