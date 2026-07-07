import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCardLabels } from '../hooks/useCardLabels'
import { useCashupHistory } from '../hooks/useCashupHistory'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import { useFloatComposition } from '../hooks/useFloatComposition'
import { useSalesTotalsForDate } from '../hooks/useSalesTotalsForDate'
import { MXN_DENOMINATIONS, sumDenominations } from '../lib/denominations'
import { addDaysLocal, todayLocalDateString } from '../lib/dates'
import { DenominationTable } from './DenominationTable'
import { FloatEditor } from './FloatEditor'
import type { Cashup, ReaderCounts } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function BreakdownLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="checkout-row cashup-summary-row">
      <span>{label}</span>
      <span>{currency.format(value)}</span>
    </div>
  )
}

export function CashupsScreen() {
  const [date, setDate] = useState(addDaysLocal(todayLocalDateString(), -1))
  const [existing, setExisting] = useState<Cashup | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  const [staffName, setStaffName] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cardTips, setCardTips] = useState(0)
  const [pettyCash, setPettyCash] = useState(0)
  // null = no manual correction; the reported (system) total for that card stands.
  // A number here overrides the reported total with the true terminal printout.
  const [card1Override, setCard1Override] = useState<number | null>(null)
  const [card2Override, setCard2Override] = useState<number | null>(null)

  const [floatEditorOpen, setFloatEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { card1Label, card2Label } = useCardLabels()
  const { staffName: defaultStaffName } = useCurrentStaff()
  const { composition: floatComposition, floatTotal, loading: floatLoading, save: saveFloat } = useFloatComposition()
  const { totals: systemTotals, loading: salesLoading } = useSalesTotalsForDate(date)
  const { cashups: history, loading: historyLoading, error: historyError, refetch: refetchHistory } = useCashupHistory()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadingExisting(true)
      setSaved(false)
      setError(null)
      const { data } = await supabase.from('cashups').select('*').eq('date', date).maybeSingle()
      if (cancelled) return

      const row = data as Cashup | null
      setExisting(row)
      setStaffName(row?.staff_name ?? defaultStaffName ?? '')
      setCounts(row?.counts ?? {})
      setCardTips(row?.card_tips ?? 0)
      setPettyCash(row?.petty_cash ?? 0)
      setCard1Override((row?.reader_counts as ReaderCounts | null)?.card1 ?? null)
      setCard2Override((row?.reader_counts as ReaderCounts | null)?.card2 ?? null)
      setLoadingExisting(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // defaultStaffName intentionally excluded: only used as an initial default, not a re-sync trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function handleCountChange(denom: number, qty: number) {
    setCounts((prev) => ({ ...prev, [denom]: qty }))
  }

  const totalCashInTill = sumDenominations(counts)
  // Card tips and petty cash are both cash staff removed from the till during
  // the day for legitimate reasons, so they're added back to reconstruct the
  // day's actual cash takings before comparing against system_cash.
  const subtotal = totalCashInTill - floatTotal + cardTips + pettyCash
  const cashDifference = subtotal - systemTotals.cash

  // A blank override means the reported (system) total stands as correct.
  const card1Effective = card1Override ?? systemTotals.card1
  const card2Effective = card2Override ?? systemTotals.card2

  // cardTips/pettyCash already folded into `subtotal` above — don't add them again here.
  const grandCounted = subtotal + card1Effective + card2Effective + systemTotals.transfer
  const grandSystem = systemTotals.cash + systemTotals.card1 + systemTotals.card2 + systemTotals.transfer
  const grandDifference = grandCounted - grandSystem

  // Denominations counted above the float target get pulled from the till;
  // denominations counted below get topped up so the float is restored.
  const removed: Record<string, number> = {}
  const added: Record<string, number> = {}
  for (const denom of MXN_DENOMINATIONS) {
    const countedQty = counts[denom] ?? 0
    const floatQty = floatComposition[denom] ?? 0
    if (countedQty > floatQty) removed[denom] = countedQty - floatQty
    else if (countedQty < floatQty) added[denom] = floatQty - countedQty
  }

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    setSheetSyncError(null)

    const payload = {
      date,
      staff_name: staffName.trim() || null,
      counts,
      card_tips: cardTips,
      petty_cash: pettyCash,
      subtotal,
      float_fixed_total: floatTotal,
      total_cash_in_till: totalCashInTill,
      system_cash: systemTotals.cash,
      cash_difference: cashDifference,
      reader_counts: {
        ...(card1Override !== null && { card1: card1Override }),
        ...(card2Override !== null && { card2: card2Override }),
      },
      system_card1: systemTotals.card1,
      system_card2: systemTotals.card2,
      system_transfer: systemTotals.transfer,
      grand_counted: grandCounted,
      grand_system: grandSystem,
      grand_difference: grandDifference,
      till_adjustments: { removed, added },
    }

    const { data, error } = await supabase
      .from('cashups')
      .upsert(payload, { onConflict: 'date' })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setExisting(data as Cashup)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    refetchHistory()

    // The cashup itself is already saved at this point — a sheet sync
    // failure shouldn't look like the cashup failed to save, so it gets its
    // own separate, non-blocking error rather than reusing `error` above.
    const { error: syncError } = await supabase.functions.invoke('push-cashup-to-sheet', {
      body: {
        date,
        staffName: staffName.trim() || null,
        totalCashInTill,
        floatTotal,
        cardTips,
        pettyCash,
        cashSubtotal: subtotal,
        systemCash: systemTotals.cash,
        cashDifference,
        card1: card1Effective,
        card1Overridden: card1Override !== null,
        card2: card2Effective,
        card2Overridden: card2Override !== null,
        transfer: systemTotals.transfer,
        grandCounted,
        grandSystem,
        grandDifference,
      },
    })
    if (syncError) setSheetSyncError(syncError.message)
  }

  function handleEditPast(pastDate: string) {
    setDate(pastDate)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeleteCashup(pastDate: string) {
    if (!confirm(`Delete the cashup for ${pastDate}? This can't be undone and also removes it from the Google Sheet.`)) {
      return
    }

    setDeletingDate(pastDate)
    setDeleteError(null)

    const { error: deleteDbError } = await supabase.from('cashups').delete().eq('date', pastDate)
    if (deleteDbError) {
      setDeletingDate(null)
      setDeleteError(deleteDbError.message)
      return
    }

    const { error: deleteSyncError } = await supabase.functions.invoke('push-cashup-to-sheet', {
      method: 'DELETE',
      body: { date: pastDate },
    })
    if (deleteSyncError) setDeleteError(`Deleted, but the Google Sheet sync failed: ${deleteSyncError.message}`)

    if (pastDate === date) {
      setExisting(null)
      setStaffName(defaultStaffName ?? '')
      setCounts({})
      setCardTips(0)
      setPettyCash(0)
      setCard1Override(null)
      setCard2Override(null)
    }

    setDeletingDate(null)
    refetchHistory()
  }

  const loading = loadingExisting || floatLoading

  return (
    <div className="menu-manager cashup-screen">
      <div className="menu-manager-header">
        <h2>Cashup</h2>
        <div className="cashup-date-picker">
          <label htmlFor="cashup-date">Date</label>
          <input id="cashup-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {loading && <div className="menu-grid-status">Loading…</div>}

      {!loading && (
        <div className="cashup-grid">
          <section className="cashup-section">
            <h3>Till count</h3>
            <label htmlFor="cashup-staff">Staff</label>
            <input id="cashup-staff" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
            <DenominationTable values={counts} onChange={handleCountChange} adjustments={{ added, removed }} />

            <div className="cashup-float-row">
              <span>
                Float ({currency.format(floatTotal)})
                {Object.keys(floatComposition).length === 0 && <span className="cashup-hint"> — not configured</span>}
              </span>
              <button type="button" className="cashup-link-button" onClick={() => setFloatEditorOpen(true)}>
                Edit float
              </button>
            </div>

            <div className="menu-editor-row">
              <div>
                <label htmlFor="card-tips">Card tips paid out (cash)</label>
                <input
                  id="card-tips"
                  type="number"
                  step="0.01"
                  value={cardTips || ''}
                  onChange={(e) => setCardTips(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="petty-cash">Petty cash spent</label>
                <input
                  id="petty-cash"
                  type="number"
                  step="0.01"
                  value={pettyCash || ''}
                  onChange={(e) => setPettyCash(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="checkout-summary cashup-summary">
              <BreakdownLine label="Total in till" value={totalCashInTill} />
              <BreakdownLine label="Float" value={-floatTotal} />
              <BreakdownLine label="Card tips paid out" value={cardTips} />
              <BreakdownLine label="Petty cash spent" value={pettyCash} />
              <div className="checkout-row checkout-total">
                <span>Cash subtotal</span>
                <span>{currency.format(subtotal)}</span>
              </div>
              <div className="checkout-row">
                <span>System cash sales{salesLoading ? '…' : ''}</span>
                <span>{currency.format(systemTotals.cash)}</span>
              </div>
              <div className="checkout-row checkout-total">
                <span>Cash difference</span>
                <span className={cashDifference === 0 ? '' : cashDifference > 0 ? 'cashup-diff-positive' : 'cashup-diff-negative'}>
                  {currency.format(cashDifference)}
                </span>
              </div>
            </div>
          </section>

          <section className="cashup-section">
            <h3>Cards &amp; transfer</h3>

            <div className="menu-editor-row">
              <div>
                <label htmlFor="card1-override">{card1Label} override</label>
                <input
                  id="card1-override"
                  type="number"
                  step="0.01"
                  placeholder={currency.format(systemTotals.card1)}
                  value={card1Override ?? ''}
                  onChange={(e) => setCard1Override(e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="card2-override">{card2Label} override</label>
                <input
                  id="card2-override"
                  type="number"
                  step="0.01"
                  placeholder={currency.format(systemTotals.card2)}
                  value={card2Override ?? ''}
                  onChange={(e) => setCard2Override(e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            </div>
            <p className="cashup-hint">Leave blank if the terminal printout matches the report. Enter a number to override it.</p>

            <div className="checkout-summary cashup-summary">
              <div className="checkout-row">
                <span>{card1Label}{card1Override !== null && <span className="cashup-hint"> (overridden)</span>}</span>
                <span>{currency.format(card1Effective)}</span>
              </div>
              <div className="checkout-row">
                <span>{card2Label}{card2Override !== null && <span className="cashup-hint"> (overridden)</span>}</span>
                <span>{currency.format(card2Effective)}</span>
              </div>
              <div className="checkout-row">
                <span>Transfer</span>
                <span>{currency.format(systemTotals.transfer)}</span>
              </div>
            </div>

            <div className="checkout-summary cashup-summary cashup-grand">
              <div className="checkout-row">
                <span>Grand counted</span>
                <span>{currency.format(grandCounted)}</span>
              </div>
              <div className="checkout-row">
                <span>Grand system</span>
                <span>{currency.format(grandSystem)}</span>
              </div>
              <div className="checkout-row checkout-total">
                <span>Grand difference</span>
                <span
                  className={grandDifference === 0 ? '' : grandDifference > 0 ? 'cashup-diff-positive' : 'cashup-diff-negative'}
                >
                  {currency.format(grandDifference)}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {error && <p className="checkout-error">{error}</p>}
      {saved && <p className="cashup-saved">Cashup saved for {date}.</p>}
      {sheetSyncError && <p className="checkout-error">Saved, but the Google Sheet sync failed: {sheetSyncError}</p>}

      <div className="cashup-actions">
        <button type="button" className="checkout-confirm" onClick={handleSave} disabled={submitting || loading}>
          {submitting ? 'Saving…' : existing ? 'Update cashup' : 'Save cashup'}
        </button>
      </div>

      <section className="cashup-section cashup-history">
        <h3>Past cashups</h3>

        {deleteError && <p className="checkout-error">{deleteError}</p>}

        {historyLoading && <div className="menu-grid-status">Loading…</div>}

        {!historyLoading && historyError && (
          <div className="menu-grid-status menu-grid-error">
            Failed to load history: {historyError}
            <button type="button" className="menu-manager-add" onClick={refetchHistory}>
              Retry
            </button>
          </div>
        )}

        {!historyLoading && !historyError && history.length === 0 && (
          <div className="menu-grid-status">No cashups saved yet.</div>
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <table className="menu-manager-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th>Cash difference</th>
                <th>Grand difference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className={row.date === date ? 'cashup-history-active' : ''}>
                  <td>{row.date}</td>
                  <td>{row.staff_name ?? '—'}</td>
                  <td className={(row.cash_difference ?? 0) === 0 ? '' : (row.cash_difference ?? 0) > 0 ? 'cashup-diff-positive' : 'cashup-diff-negative'}>
                    {currency.format(row.cash_difference ?? 0)}
                  </td>
                  <td className={(row.grand_difference ?? 0) === 0 ? '' : (row.grand_difference ?? 0) > 0 ? 'cashup-diff-positive' : 'cashup-diff-negative'}>
                    {currency.format(row.grand_difference ?? 0)}
                  </td>
                  <td className="cashup-history-actions">
                    <button type="button" className="menu-manager-edit" onClick={() => handleEditPast(row.date)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="menu-manager-delete"
                      onClick={() => handleDeleteCashup(row.date)}
                      disabled={deletingDate === row.date}
                    >
                      {deletingDate === row.date ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {floatEditorOpen && (
        <FloatEditor composition={floatComposition} onClose={() => setFloatEditorOpen(false)} onSave={saveFloat} />
      )}
    </div>
  )
}
