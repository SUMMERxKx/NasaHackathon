// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Moon Base region of the Atmosphere Map, from the challenge statement:
// oxygen at 30 percent or more and pressure at 10.2 psi or less.
import type { Test } from '../types.ts'
import { atmToPsi } from './units.ts'

export const MOON_REGION = {
  minO2: 0.3,
  maxPressurePsi: 10.2,
  // Tests just outside the pressure line, within 5 percent of it, are reported as on the edge.
  edgeMaxPressurePsi: 10.2 * 1.05,
}

const statesBoth = (t: Test): boolean =>
  t.o2 != null && t.pressureAtm != null && t.o2Source === 'table' && t.pressureSource === 'table'

// Pressures are compared at one decimal of a psi, the precision of the line itself.
const psi1 = (t: Test): number => Math.round(atmToPsi(t.pressureAtm as number) * 10) / 10

export function inMoonRegion(t: Test): boolean {
  return statesBoth(t) && (t.o2 as number) >= MOON_REGION.minO2 - 1e-9 && psi1(t) <= MOON_REGION.maxPressurePsi
}

export function onMoonEdge(t: Test): boolean {
  if (!statesBoth(t) || (t.o2 as number) < MOON_REGION.minO2 - 1e-9) return false
  const p = psi1(t)
  return p > MOON_REGION.maxPressurePsi && p <= MOON_REGION.edgeMaxPressurePsi
}
