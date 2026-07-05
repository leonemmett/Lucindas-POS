import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCardLabels } from '../hooks/useCardLabels'
import { useCurrentStaff } from '../hooks/useCurrentStaff'
import { useFloatComposition } from '../hooks/useFloatComposition'
import { useSalesTotalsForDate } from '../hooks/useSalesTotalsForDate'
import { MXN_DENOMINATIONS, sumDenominations } from '../lib/denominations'
import { todayLocalDateString } from '../lib/dates'
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
  const [date, setDate] = useState(todayLocalDateString())
  const [existing, setExisting] = useState<Cashup | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  const [staffName, setStaffName] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cardTips, setCardTips] = useState(0)
  const [pettyCash, setPettyCash] = useState(0)
  const [readerCard1, setReaderCard1] = useState(0)
  const [readerCard2, setReaderCard2] = useState(0)

  const [floatEditorOpen, setFloatEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { card1Label, card2Label } = useCardLabels()
  const { staffName: defaultStaffName } = useCurrentStaff()
  const { composition: floatComposition, floatTotal, loading: floatLoading, save: saveFloat } = useFloatComposition()
  const { totals: systemTotals, loading: salesLoading } = useSalesTotalsForDate(date)

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
      setReaderCard1((row?.reader_counts as ReaderCounts | null)?.card1 ?? 0)
      setReaderCard2((row?.reader_counts as ReaderCounts | null)?.card2 ?? 0)
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

  // cardTips/pettyCash already folded into `subtotal` above — don't add them again here.
  const grandCounted = subtotal + readerCard1 + readerCard2 + systemTotals.transfer
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
  const removedValue = sumDenominations(removed)
  const addedValue = sumDenominations(added)

  async function handleSave() {
    setSubmitting(true)
    setError(null)

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
      reader_counts: { card1: readerCard1, card2: readerCard2 },
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
            <DenominationTable values={counts} onChange={handleCountChange} />

            <div className="cashup-float-row">
              <span>
                Float ({currency.format(floatTotal)})
                {Object.keys(floatComposition).length === 0 && <span className="cashup-hint"> — not configured</span>}
              </span>
              <button type="button" className="cashup-link-button" onClick={() => setFloatEditorOpen(true)}>
                Edit float
              </button>
            </div>

            {(removedValue > 0 || addedValue > 0) && (
              <div className="till-adjustments">
                <h4>Till adjustment</h4>
                <div className="till-adjustments-grid">
                  <div>
                    <span className="till-adjustments-label">Remove from till ({currency.format(removedValue)})</span>
                    {Object.keys(removed).length === 0 ? (
                      <p className="cashup-hint">Nothing to remove</p>
                    ) : (
                      <ul>
                        {MXN_DENOMINATIONS.filter((d) => removed[d]).map((d) => (
                          <li key={d}>
                            {removed[d]} × {currency.format(d)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <span className="till-adjustments-label">Add to till ({currency.format(addedValue)})</span>
                    {Object.keys(added).length === 0 ? (
                      <p className="cashup-hint">Nothing to add</p>
                    ) : (
                      <ul>
                        {MXN_DENOMINATIONS.filter((d) => added[d]).map((d) => (
                          <li key={d}>
                            {added[d]} × {currency.format(d)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                <label htmlFor="reader1">{card1Label} (reader)</label>
                <input
                  id="reader1"
                  type="number"
                  step="0.01"
                  value={readerCard1 || ''}
                  onChange={(e) => setReaderCard1(Number(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="reader2">{card2Label} (reader)</label>
                <input
                  id="reader2"
                  type="number"
                  step="0.01"
                  value={readerCard2 || ''}
                  onChange={(e) => setReaderCard2(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="checkout-summary cashup-summary">
              <div className="checkout-row">
                <span>System {card1Label}</span>
                <span>{currency.format(systemTotals.card1)}</span>
              </div>
              <div className="checkout-row">
                <span>System {card2Label}</span>
                <span>{currency.format(systemTotals.card2)}</span>
              </div>
              <div className="checkout-row">
                <span>System transfer</span>
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

      <div className="cashup-actions">
        <button type="button" className="checkout-confirm" onClick={handleSave} disabled={submitting || loading}>
          {submitting ? 'Saving…' : existing ? 'Update cashup' : 'Save cashup'}
        </button>
      </div>

      {floatEditorOpen && (
        <FloatEditor composition={floatComposition} onClose={() => setFloatEditorOpen(false)} onSave={saveFloat} />
      )}
    </div>
  )
}
