// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// What the NASA tables say about a flame near a chosen atmosphere. Pure lookups, no drawing.
// The fireball's inputs and its three readout numbers both come from here.
import type { Test } from '../types.ts'
import { distance } from './coverage.ts'
import type { Point } from './coverage.ts'
import { diluentFamily } from './droplet.ts'
import { median } from './stats.ts'

export const FLEX = 'PSI-69'
export const ACME_TAD_TABLES = ['PSI-10', 'PSI-159']
// "Near this oxygen" means within 3 points of oxygen for FLEX, the window the Lab also uses.
export const FLEX_O2_WINDOW = 0.03
export const TAD_O2_WINDOW = 0.05

export type FlameLookup = {
  flexNear: Test[]
  burningRate: { value: number | null; tests: Test[]; interpolated: boolean }
  extinction: { ended: Test[]; of: Test[] }
  flameTemperature: { value: number | null; tests: Test[] }
  dropletsInRange: Test[]
  nearestDroplet: { test: Test; distance: number } | null
}

const near = (t: Test, o2: number, window: number): boolean => t.o2 != null && Math.abs(t.o2 - o2) <= window + 1e-9
const isInverse = (t: Test): boolean => t.flags?.includes('oxidizer-stream') ?? false
// CFI-G marks its cool flames in the column "Cool flame?" with a value that starts with yes.
export const isCoolFlame = (t: Test): boolean => /^yes/i.test(String(t.extra.coolFlame ?? ''))
const hasK = (t: Test): boolean => typeof t.extra.K === 'number' && (t.extra.K as number) > 0

// The median burning rate of nitrogen-diluted FLEX tests at each tested oxygen level.
function rateByLevel(flex: Test[]): { o2: number; value: number }[] {
  const levels = new Map<number, number[]>()
  for (const t of flex) {
    if (t.o2 == null || !hasK(t) || diluentFamily(t) !== 'nitrogen only') continue
    const key = Math.round(t.o2 * 100) / 100
    levels.set(key, [...(levels.get(key) ?? []), t.extra.K as number])
  }
  return [...levels.entries()].map(([o2, list]) => ({ o2, value: median(list) as number })).sort((a, b) => a.o2 - b.o2)
}

export function flameLookup(tests: Test[], point: Point): FlameLookup {
  const flex = tests.filter((t) => t.accession === FLEX)
  const flexNear = flex.filter((t) => near(t, point.o2, FLEX_O2_WINDOW))
  const outcomeTests = flexNear.filter((t) => diluentFamily(t) === 'nitrogen only')
  const rateTests = outcomeTests.filter(hasK)
  let rate = median(rateTests.map((t) => t.extra.K as number))
  let interpolated = false
  if (rate == null) {
    // No nitrogen-diluted test within 3 points. Draw the value on a straight line between
    // the nearest tested oxygen levels on each side. The readout says "between tested levels".
    const levels = rateByLevel(flex)
    const below = [...levels].reverse().find((l) => l.o2 <= point.o2)
    const above = levels.find((l) => l.o2 >= point.o2)
    if (below && above && above.o2 > below.o2) {
      rate = below.value + ((point.o2 - below.o2) / (above.o2 - below.o2)) * (above.value - below.value)
      interpolated = true
    }
  }
  // Tad is a calculated adiabatic flame temperature. Inverse flames are left out, because their
  // oxygen value is the burner stream and not the surrounding gas, and so are cool flames, because
  // for them the column describes a hot flame that never happened.
  const tadTests = tests.filter(
    (t) =>
      ACME_TAD_TABLES.includes(t.accession) &&
      typeof t.extra.tad === 'number' &&
      !isInverse(t) &&
      !isCoolFlame(t) &&
      near(t, point.o2, TAD_O2_WINDOW),
  )
  const droplets = tests.filter((t) => t.fuelClass === 'liquid')
  const ranged = droplets
    .map((test) => ({ test, distance: distance(test, point) }))
    .filter((d): d is { test: Test; distance: number } => d.distance != null)
    .sort((a, b) => a.distance - b.distance || (a.test.id < b.test.id ? -1 : 1))
  return {
    flexNear,
    burningRate: { value: rate, tests: rateTests, interpolated },
    // The same nitrogen-only tests as the burn rate, so the two tiles count the same kind of row.
    extinction: { ended: outcomeTests.filter((t) => t.outcome === 'Extinction'), of: outcomeTests },
    flameTemperature: { value: median(tadTests.map((t) => t.extra.tad as number)), tests: tadTests },
    dropletsInRange: ranged.filter((d) => d.distance <= 1).map((d) => d.test),
    nearestDroplet: ranged[0] ?? null,
  }
}
