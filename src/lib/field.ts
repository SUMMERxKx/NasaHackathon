// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The coverage field: the Evidence Coverage score evaluated at any point of the map.
// It uses the same formula as the dial, so the two cannot disagree. A test checks it.
import type { MethodConstants, Test } from '../types.ts'
import { DEFAULT_METHOD, PILLARS, isAssumed, pillarFactor } from './coverage.ts'
import type { PillarLookup, Point } from './coverage.ts'

export type FieldGroup = { o2: number; lnP: number; w: [number, number, number] }

// Tests that share a position are added up once, which makes the field cheap to draw.
export function fieldGroups(tests: Test[], lookup: PillarLookup, m: MethodConstants = DEFAULT_METHOD): FieldGroup[] {
  const map = new Map<string, FieldGroup>()
  for (const t of tests) {
    if (t.o2 == null || t.pressureAtm == null || t.pressureAtm <= 0) continue
    const key = `${t.o2}|${t.pressureAtm}`
    let group = map.get(key)
    if (!group) {
      group = { o2: t.o2, lnP: Math.log(t.pressureAtm), w: [0, 0, 0] }
      map.set(key, group)
    }
    const a = isAssumed(t) ? 0.5 : 1
    PILLARS.forEach((pillar, i) => {
      ;(group as FieldGroup).w[i] += a * pillarFactor(lookup[t.accession], pillar, m)
    })
  }
  return [...map.values()]
}

export function overallFromGroups(groups: FieldGroup[], point: Point, m: MethodConstants = DEFAULT_METHOD): number {
  const lnP = Math.log(point.pressureAtm)
  const n = [0, 0, 0]
  for (const g of groups) {
    const dx = (g.o2 - point.o2) / m.o2Scale
    const dp = (g.lnP - lnP) / m.pressureScale
    const d2 = dx * dx + dp * dp
    if (d2 > 60) continue
    const e = Math.exp(-0.5 * d2)
    n[0] += g.w[0] * e
    n[1] += g.w[1] * e
    n[2] += g.w[2] * e
  }
  let overall = 0
  PILLARS.forEach((pillar, i) => {
    overall += m.pillarWeights[pillar] * 100 * (1 - Math.exp(-n[i] / m.saturation))
  })
  return overall
}
