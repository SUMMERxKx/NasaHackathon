// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Selections behind the Lab charts. The charts and the drill panel both call these.
import type { Test } from '../types.ts'
import { diluentFamily, dropletValues, extinctionRatio } from './droplet.ts'
import type { DiluentFamily } from './droplet.ts'
import { median } from './stats.ts'
import { formatPercent } from './units.ts'

export const FLEX = 'PSI-69'
export const SAFFIRE_2 = 'PSI-99'
export const LAB_FUELS = ['Methanol', 'Heptane'] as const
export const DILUENT_FAMILIES: DiluentFamily[] = ['nitrogen only', 'carbon dioxide', 'helium', 'carbon dioxide plus helium']

export const flexTests = (tests: Test[]): Test[] => tests.filter((t) => t.accession === FLEX)

// Lab tool 1: FLEX tests of this fuel and diluent family within 0.03 oxygen fraction.
export function dropletSelection(tests: Test[], fuel: string, o2: number, family: DiluentFamily) {
  const list = flexTests(tests).filter(
    (t) =>
      t.fuel === fuel &&
      t.o2 != null &&
      Math.abs(t.o2 - o2) <= 0.03 + 1e-9 &&
      diluentFamily(t) === family &&
      typeof t.extra.K === 'number' &&
      (t.extra.K as number) > 0,
  )
  const d0 = list.map((t) => t.extra.d0).filter((v): v is number => typeof v === 'number')
  return {
    tests: list,
    enough: list.length >= 3,
    k: median(list.map((t) => t.extra.K as number)),
    d0: median(d0),
  }
}

// The two lines the droplet chart shows when no FLEX test with all four values matches its inputs.
// The second line points to the input that can find one: the slider while this fuel and gas have
// a test at some other oxygen level, and the fuel or gas when they have none.
export function dropletEmptyState(tests: Test[], fuel: string, o2: number, family: DiluentFamily, matched: number): [string, string] {
  const first = matched === 0 ? `No FLEX tests at ${formatPercent(o2)} oxygen.` : `No FLEX test at ${formatPercent(o2)} oxygen has all four values.`
  const elsewhere = flexTests(tests).some((t) => t.fuel === fuel && diluentFamily(t) === family && typeof t.extra.K === 'number' && t.extra.K > 0 && dropletValues(t) != null)
  return [first, elsewhere ? 'Move the slider to see tests.' : 'Pick another fuel or gas to see tests.']
}

export const dropletKey = (fuel: string, o2: number, family: DiluentFamily): string =>
  `${fuel}|${Math.round(o2 * 1000) / 1000}|${family}`

export function parseDropletKey(key: string): { fuel: string; o2: number; family: DiluentFamily } | null {
  const [fuel, o2, family] = key.split('|')
  const value = Number(o2)
  if (!fuel || !Number.isFinite(value) || !DILUENT_FAMILIES.includes(family as DiluentFamily)) return null
  return { fuel, o2: value, family: family as DiluentFamily }
}

export const EXTINCTION_BINS = [0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38]

export type ExtinctionPoint = { testId: string; o2: number; ratio: number; family: DiluentFamily }
export type ExtinctionBin = { key: string; fuel: string; index: number; min: number; max: number; testIds: string[]; median: number | null }

export function extinctionPoints(tests: Test[], fuel: string): ExtinctionPoint[] {
  const out: ExtinctionPoint[] = []
  for (const t of flexTests(tests)) {
    if (t.fuel !== fuel || t.o2 == null) continue
    const d0 = t.extra.d0
    const dExt = t.extra.dExt
    if (typeof d0 !== 'number' || typeof dExt !== 'number' || d0 <= 0) continue
    out.push({ testId: t.id, o2: t.o2, ratio: extinctionRatio(d0, dExt), family: diluentFamily(t) })
  }
  return out
}

// Lab tool 2: binned medians of the extinction ratio, with the tests in each bin.
export function extinctionBins(tests: Test[], fuel: string): ExtinctionBin[] {
  const points = extinctionPoints(tests, fuel)
  const bins: ExtinctionBin[] = []
  for (let i = 0; i < EXTINCTION_BINS.length - 1; i += 1) {
    const min = EXTINCTION_BINS[i]
    const max = EXTINCTION_BINS[i + 1]
    const last = i === EXTINCTION_BINS.length - 2
    const inside = points.filter((p) => p.o2 >= min - 1e-9 && (last ? p.o2 <= max + 1e-9 : p.o2 < max - 1e-9))
    bins.push({ key: `${fuel}|${i}`, fuel, index: i, min, max, testIds: inside.map((p) => p.testId), median: median(inside.map((p) => p.ratio)) })
  }
  return bins
}

// A thickness written with a leading zero and no decimal point, such as "037 mm" in the SAFFIRE-2
// table, is kept exactly as NASA wrote it and flagged. The likely reading is returned only to be
// shown as unconfirmed. It is never stored or used as a measurement.
export function ambiguousThickness(text: string): string | null {
  const m = /^0(\d+)\s*(mm|cm)$/i.exec(text.trim())
  return m ? `0.${m[1]} ${m[2]}` : null
}

export type BurnPair = { testId: string; label: string; material: string; thickness: string; thicknessLikely: string | null; flow: number | null; ug: number | null; g1: number | null; ugRaw: string; g1Raw: string; mixed: boolean }

// Lab tool 3: for each Saffire-II sample, the microgravity and the normal gravity burn length.
export function burnLengthPairs(tests: Test[]): BurnPair[] {
  return tests
    .filter((t) => t.accession === SAFFIRE_2)
    .map((t) => ({
      testId: t.id,
      label: t.label,
      material: t.fuel ?? 'Not stated',
      thickness: String(t.extra.thickness ?? ''),
      thicknessLikely: ambiguousThickness(String(t.extra.thickness ?? '')),
      flow: t.flowCmS,
      ug: typeof t.extra.ugBurnLengthCm === 'number' ? t.extra.ugBurnLengthCm : null,
      g1: typeof t.extra.g1BurnLengthCm === 'number' ? t.extra.g1BurnLengthCm : null,
      ugRaw: String(t.extra.ugBurnLengthRaw ?? ''),
      g1Raw: String(t.extra.g1BurnLengthRaw ?? ''),
      mixed: /&/.test(t.fuel ?? ''),
    }))
}
