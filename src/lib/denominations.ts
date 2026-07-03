// Standard MXN bills and coins in circulation, largest first.
export const MXN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

export function sumDenominations(counts: Record<string, number> | null | undefined): number {
  if (!counts) return 0
  return Object.entries(counts).reduce((sum, [denom, qty]) => sum + Number(denom) * (qty || 0), 0)
}
