import { useMemo, useState } from 'react'
import { findDataIssues } from '../lib/dataHealth'
import type { Ingredient, MenuItem } from '../lib/types'

type DataHealthScreenProps = {
  menuItems: MenuItem[]
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  dismissedKeys: Set<string>
  dismissalsLoading: boolean
  onDismiss: (issueKey: string) => void
  onRestore: (issueKey: string) => void
}

export function DataHealthScreen({
  menuItems,
  ingredients,
  loading,
  error,
  dismissedKeys,
  dismissalsLoading,
  onDismiss,
  onRestore,
}: DataHealthScreenProps) {
  const [showIgnored, setShowIgnored] = useState(false)

  const allIssues = useMemo(() => findDataIssues(menuItems, ingredients), [menuItems, ingredients])
  const active = allIssues.filter((i) => !dismissedKeys.has(i.key))
  const ignored = allIssues.filter((i) => dismissedKeys.has(i.key))

  const errorCount = active.filter((i) => i.severity === 'error').length
  const warningCount = active.filter((i) => i.severity === 'warning').length

  const busy = loading || dismissalsLoading

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Alerts</h2>
      </div>

      <p className="settings-hint">
        Missing data that makes the app report the wrong thing — items that ring up free, sales that never deduct
        stock, ingredients with no cost. Anything deliberate can be ignored so it stops showing up.
      </p>

      {busy && <div className="menu-grid-status">Loading…</div>}
      {!busy && error && <div className="menu-grid-status menu-grid-error">Failed to load: {error}</div>}

      {!busy && !error && (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-tile-label">Needs fixing</span>
              <span className={`stat-tile-value ${errorCount > 0 ? 'stat-tile-danger' : ''}`}>{errorCount}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Worth checking</span>
              <span className="stat-tile-value">{warningCount}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Ignored</span>
              <span className="stat-tile-value">{ignored.length}</span>
            </div>
          </div>

          {active.length === 0 ? (
            <div className="menu-grid-status">Nothing needs attention — all prices and costs are filled in.</div>
          ) : (
            <table className="menu-manager-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Issue</th>
                  <th>What to do</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map((issue) => (
                  <tr key={issue.key}>
                    <td>{issue.subject}</td>
                    <td className={issue.severity === 'error' ? 'ingredient-stock-low' : ''}>{issue.title}</td>
                    <td>{issue.fixHint}</td>
                    <td>
                      <button type="button" className="menu-manager-edit" onClick={() => onDismiss(issue.key)}>
                        Ignore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ignored.length > 0 && (
            <>
              <button
                type="button"
                className="menu-manager-edit"
                onClick={() => setShowIgnored((prev) => !prev)}
              >
                {showIgnored ? 'Hide' : 'Show'} ignored ({ignored.length})
              </button>

              {showIgnored && (
                <table className="menu-manager-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Issue</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ignored.map((issue) => (
                      <tr key={issue.key}>
                        <td>{issue.subject}</td>
                        <td>{issue.title}</td>
                        <td>
                          <button type="button" className="menu-manager-edit" onClick={() => onRestore(issue.key)}>
                            Un-ignore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
