// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The normalized dataset as CSV. The build writes the whole file and the app writes per-investigation files.
import type { Test } from '../types.ts'

export const CSV_COLUMNS = [
  'id', 'accession', 'investigation', 'table', 'row', 'label', 'fuel', 'fuel_class', 'o2_fraction', 'o2_source',
  'pressure_atm', 'pressure_source', 'flow_cm_s', 'n2_fraction', 'co2_fraction', 'he_fraction', 'outcome',
  'droplet_d0_mm', 'extinction_diameter_mm', 'burning_rate_mm2_s', 'burn_time_s', 'listed_flame_temperature_k', 'flags',
]

const cell = (value: unknown): string => {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Assumed values are marked in the source columns. They are never presented as measured.
export function testsToCsv(tests: Test[], names: Record<string, string>): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const t of tests) {
    const row = [
      t.id, t.accession, names[t.accession], t.table, t.rowIndex, t.label, t.fuel, t.fuelClass, t.o2, t.o2Source,
      t.pressureAtm, t.pressureSource, t.flowCmS, t.diluent?.n2, t.diluent?.co2, t.diluent?.he, t.outcome,
      t.extra.d0, t.extra.dExt, t.extra.K, t.extra.burnTime, t.extra.tad, (t.flags || []).join(' '),
    ]
    lines.push(row.map(cell).join(','))
  }
  return lines.join('\n') + '\n'
}

// The file name for a filtered view names its filter, such as ember-BASS-II-tests.csv.
// With no filter it is the plotted set, and the whole dataset keeps its own file.
export function viewCsvName(filters: (string | null | undefined)[]): string {
  const slug = filters
    .filter((f): f is string => Boolean(f && f.trim()))
    .join('-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return `ember-${slug || 'plotted'}-tests.csv`
}
