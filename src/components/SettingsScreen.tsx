type SettingsScreenProps = {
  receiptsEnabled: boolean
  loading: boolean
  onSaveReceiptsEnabled: (next: boolean) => void
}

export function SettingsScreen({ receiptsEnabled, loading, onSaveReceiptsEnabled }: SettingsScreenProps) {
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
    </div>
  )
}
