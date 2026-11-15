// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Small statistics helpers shared by the app, the build scripts and the tests.

export function quantile(values: number[], q: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  const high = Math.ceil(position)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

export const median = (values: number[]): number | null => quantile(values, 0.5)

export function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    out[k] = (out[k] || 0) + 1
  }
  return out
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out
}

// Sorts accessions such as PSI-9 and PSI-100 by their number.
export function byAccession(a: string, b: string): number {
  return Number(a.split('-')[1]) - Number(b.split('-')[1])
}
