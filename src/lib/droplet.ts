// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The d-squared law for a burning droplet: d(t)² = d0² − K × t.
// A classical result (Godsave 1953, Spalding 1953). FLEX data: Dietrich and co-authors, Microgravity
// Science and Technology, 2014, doi 10.1007/s12217-014-9372-2.
import type { Test } from '../types.ts'
import { median, quantile } from './stats.ts'

// Burn time until the visible flame goes out at diameter dExt. Diameters in mm, K in mm² per second.
export function burnTimeToExtinction(d0: number, dExt: number, k: number): number {
  return (d0 * d0 - dExt * dExt) / k
}

/** The Lab's model end time. When NASA's extinction diameter is not smaller than the initial
 * diameter, the law gives zero or a negative time, which is not a burn time, so there is none. */
export function modelEndTime(d0: number, dExt: number, k: number): number | null {
  return dExt < d0 ? burnTimeToExtinction(d0, dExt, k) : null
}

export function burnTimeToCompletion(d0: number, k: number): number {
  return (d0 * d0) / k
}

export function diameterAt(d0: number, k: number, t: number): number {
  return Math.sqrt(Math.max(0, d0 * d0 - k * t))
}

// A ratio near 1 means the flame went out almost at once. 0 means the droplet burned away.
export function extinctionRatio(d0: number, dExt: number): number {
  return dExt / d0
}

export type DropletValues = { d0: number; dExt: number; k: number; burnTime: number }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function dropletValues(test: Test): DropletValues | null {
  const d0 = num(test.extra.d0)
  const dExt = num(test.extra.dExt)
  const k = num(test.extra.K)
  const burnTime = num(test.extra.burnTime)
  if (d0 == null || dExt == null || k == null || burnTime == null) return null
  if (d0 <= 0 || k <= 0 || burnTime <= 0) return null
  return { d0, dExt, k, burnTime }
}

export type ValidationPoint = { testId: string; predicted: number; measured: number; ratio: number }

// Predicted against measured burn time for every FLEX test that has all four values and a
// defined model end. A test whose extinction diameter is not smaller than its start diameter has
// no model burn time (modelEndTime), so it is left out instead of counted with a negative time.
export function validateDSquared(tests: Test[]): {
  points: ValidationPoint[]
  median: number | null
  q1: number | null
  q3: number | null
} {
  const points: ValidationPoint[] = []
  for (const test of tests) {
    const v = dropletValues(test)
    if (!v) continue
    const predicted = modelEndTime(v.d0, v.dExt, v.k)
    if (predicted == null) continue
    points.push({ testId: test.id, predicted, measured: v.burnTime, ratio: predicted / v.burnTime })
  }
  const ratios = points.map((p) => p.ratio)
  return { points, median: median(ratios), q1: quantile(ratios, 0.25), q3: quantile(ratios, 0.75) }
}

export type DiluentFamily = 'nitrogen only' | 'carbon dioxide' | 'helium' | 'carbon dioxide plus helium'

export function diluentFamily(test: Test): DiluentFamily {
  const co2 = test.diluent?.co2 ?? 0
  const he = test.diluent?.he ?? 0
  if (co2 > 0 && he > 0) return 'carbon dioxide plus helium'
  if (co2 > 0) return 'carbon dioxide'
  if (he > 0) return 'helium'
  return 'nitrogen only'
}

export const D_SQUARED_FORMULA = 'd(t)² = d0² − K × t. Burn time to extinction = (d0² − dExt²) ÷ K.'
