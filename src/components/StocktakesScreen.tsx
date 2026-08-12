import { useEffect, useMemo, useState } from 'react'
import { useStocktakes } from '../hooks/useStocktakes'
import { useStocktakeLines } from '../hooks/useStocktakeLines'

type ViewMode = 'sessions' | 'by-flavour'

function formatDiff(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}g`
}

export function StocktakesScreen() {
  const { stocktakes, loading: stocktakesLoading, error: stocktakesError } = useStocktakes()
  const { lines, loading: linesLoading, error: linesError } = useStocktakeLines()
  const [viewMode, setViewMode] = useState<ViewMode>('sessions')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loading = stocktakesLoading || linesLoading
  const error = stocktakesError ?? linesError

  useEffect(() => {
    if (!selectedId && stocktakes.length > 0) setSelectedId(stocktakes[0].id)
  }, [stocktakes, selectedId])

  const selectedStocktake = stocktakes.find((s) => s.id === selectedId) ?? null

  const selectedLines = useMemo(
    () =>
      lines
        .filter((l) => l.stocktake_id === selectedId)
        .sort((a, b) => a.difference - b.difference),
    [lines, selectedId],
  )

  const dateById = useMemo(() => new Map(stocktakes.map((s) => [s.id, s.taken_at])), [stocktakes])

  const byFlavour = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; totalDifference: number; lastDate: string; lastDifference: number }
    >()
    for (const l of lines) {
      const date = dateById.get(l.stocktake_id) ?? ''
      const prev = map.get(l.ingredient_id) ?? {
        name: l.ingredient_name,
        count: 0,
        totalDifference: 0,
        lastDate: '',
        lastDifference: 0,
      }
      prev.count += 1
      prev.totalDifference += l.difference
      if (date >= prev.lastDate) {
        prev.lastDate = date
        prev.lastDifference = l.difference
      }
      map.set(l.ingredient_id, prev)
    }
    return [...map.values()].sort((a, b) => a.totalDifference - b.totalDifference)
  }, [lines, dateById])

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Stocktakes</h2>
      </div>

      {loading && <div className="menu-grid-status">Loading…</div>}
      {!loading && error && <div className="menu-grid-status menu-grid-error">Failed to load: {error}</div>}

      {!loading && !error && stocktakes.length === 0 && (
        <div className="menu-grid-status">
          No stocktakes recorded yet. Bring me a physical count (flavour, weight, expiry) and I'll reconcile it and
          log it here.
        </div>
      )}

      {!loading && !error && stocktakes.length > 0 && (
        <>
          <div className="category-tabs">
            <button
              type="button"
              className={viewMode === 'sessions' ? 'category-tab active' : 'category-tab'}
              onClick={() => setViewMode('sessions')}
            >
              Sessions
            </button>
            <button
              type="button"
              className={viewMode === 'by-flavour' ? 'category-tab active' : 'category-tab'}
              onClick={() => setViewMode('by-flavour')}
            >
              By flavour (trend)
            </button>
          </div>

          {viewMode === 'sessions' && (
            <>
              <div className="category-tabs">
                {stocktakes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={selectedId === s.id ? 'category-tab active' : 'category-tab'}
                    onClick={() => setSelectedId(s.id)}
                  >
                    {s.taken_at}
                  </button>
                ))}
              </div>

              {selectedStocktake && (
                <>
                  {selectedStocktake.note && <p className="settings-hint">{selectedStocktake.note}</p>}

                  <div className="stat-tiles">
                    <div className="stat-tile">
                      <span className="stat-tile-label">Date</span>
                      <span className="stat-tile-value">{selectedStocktake.taken_at}</span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-tile-label">Flavours counted</span>
                      <span className="stat-tile-value">{selectedLines.length}</span>
                    </div>
                    <div className="stat-tile">
                      <span className="stat-tile-label">Net variance</span>
                      <span className="stat-tile-value">
                        {formatDiff(selectedLines.reduce((sum, l) => sum + l.difference, 0))}
                      </span>
                    </div>
                  </div>

                  <table className="menu-manager-table">
                    <thead>
                      <tr>
                        <th>Flavour</th>
                        <th>System (before)</th>
                        <th>Counted</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.ingredient_name}</td>
                          <td>{Math.round(l.system_stock_before * 10) / 10}g</td>
                          <td>{l.counted_stock}g</td>
                          <td className={l.difference < 0 ? 'ingredient-stock-low' : ''}>{formatDiff(l.difference)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}

          {viewMode === 'by-flavour' && (
            <>
              <p className="settings-hint">
                Cumulative difference across every stocktake a flavour has appeared in — consistently negative means
                it's coming up short every time, worth investigating (portioning, waste, theft) rather than just
                correcting again.
              </p>
              <table className="menu-manager-table">
                <thead>
                  <tr>
                    <th>Flavour</th>
                    <th>Times counted</th>
                    <th>Cumulative difference</th>
                    <th>Last count</th>
                    <th>Last difference</th>
                  </tr>
                </thead>
                <tbody>
                  {byFlavour.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name}</td>
                      <td>{f.count}</td>
                      <td className={f.totalDifference < 0 ? 'ingredient-stock-low' : ''}>
                        {formatDiff(f.totalDifference)}
                      </td>
                      <td>{f.lastDate}</td>
                      <td className={f.lastDifference < 0 ? 'ingredient-stock-low' : ''}>
                        {formatDiff(f.lastDifference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
