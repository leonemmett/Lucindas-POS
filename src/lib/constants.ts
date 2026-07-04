export const MAX_TABLES = 8

const TABLE_NAME_PATTERN = /^Table (\d+)$/

export function tableNameForNumber(n: number): string {
  return `Table ${n}`
}

export function nextTableNumber(tables: { name: string }[]): number | null {
  const used = new Set(
    tables
      .map((t) => TABLE_NAME_PATTERN.exec(t.name)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number),
  )
  for (let n = 1; n <= MAX_TABLES; n++) {
    if (!used.has(n)) return n
  }
  return null
}
