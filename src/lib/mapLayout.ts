// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Layout of the Atmosphere Map. Scales, the stacking rule and the coverage ring.
import { scaleLinear, scaleLog } from 'd3-scale'
import type { FuelClass, Test } from '../types.ts'
import { isAssumed } from './coverage.ts'
import { atmToPsi } from './units.ts'

export const MAP_DOMAIN = { psi: [3, 80] as [number, number], o2Pct: [10, 100] as [number, number] }
export const PRESSURE_TICKS = [3, 4.3, 8.2, 10.2, 14.7, 30, 50, 80]
export const OXYGEN_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
export const STACK_RADIUS = 9
export const BADGE_MIN = 20
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export type MapBox = { left: number; top: number; width: number; height: number }
export type MapDomain = { psi: [number, number]; o2Pct: [number, number] }

export type MapMark = {
  testId: string
  accession: string
  x: number
  y: number
  fuelClass: FuelClass
  hollow: boolean
  stackKey: string | null
}

export type MapStack = {
  key: string
  x: number
  y: number
  o2: number
  pressureAtm: number
  count: number
  testIds: string[]
  byAccession: Record<string, number>
  badge: boolean
}

export function mapScales(box: MapBox, domain: MapDomain = MAP_DOMAIN) {
  const x = scaleLog().domain(domain.psi).range([box.left, box.left + box.width]).clamp(false)
  const y = scaleLinear().domain(domain.o2Pct).range([box.top + box.height, box.top]).clamp(false)
  return { x, y }
}

export const plottable = (t: Test): boolean => t.o2 != null && t.pressureAtm != null

// Every test is its own mark. Tests that share a position sit in a tight spiral capped at 9 pixels.
export function layoutMap(tests: Test[], box: MapBox, domain: MapDomain = MAP_DOMAIN): { marks: MapMark[]; stacks: MapStack[] } {
  const { x, y } = mapScales(box, domain)
  const groups = new Map<string, Test[]>()
  for (const t of tests) {
    if (!plottable(t)) continue
    const key = `${(t.o2 as number).toFixed(4)}|${(t.pressureAtm as number).toFixed(4)}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const marks: MapMark[] = []
  const stacks: MapStack[] = []
  for (const [key, list] of groups) {
    const cx = x(atmToPsi(list[0].pressureAtm as number))
    const cy = y((list[0].o2 as number) * 100)
    const n = list.length
    list.forEach((t, k) => {
      const r = n === 1 ? 0 : STACK_RADIUS * Math.sqrt((k + 0.5) / n)
      const a = k * GOLDEN_ANGLE
      marks.push({
        testId: t.id,
        accession: t.accession,
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
        fuelClass: t.fuelClass,
        hollow: isAssumed(t),
        stackKey: n > 1 ? key : null,
      })
    })
    if (n > 1) {
      const byAccession: Record<string, number> = {}
      for (const t of list) byAccession[t.accession] = (byAccession[t.accession] || 0) + 1
      stacks.push({
        key,
        x: cx,
        y: cy,
        o2: list[0].o2 as number,
        pressureAtm: list[0].pressureAtm as number,
        count: n,
        testIds: list.map((t) => t.id),
        byAccession,
        badge: n >= BADGE_MIN,
      })
    }
  }
  return { marks, stacks }
}

// One unit of coverage distance is 4 points of oxygen and a factor of e^0.25 in pressure.
// On a linear oxygen axis and a log pressure axis that contour is an exact ellipse.
export function ringRadii(box: MapBox, domain: MapDomain = MAP_DOMAIN, o2Scale = 0.04, pressureScale = 0.25) {
  const rx = (box.width * pressureScale) / Math.log(domain.psi[1] / domain.psi[0])
  const ry = (box.height * (o2Scale * 100)) / (domain.o2Pct[1] - domain.o2Pct[0])
  return { rx, ry }
}

// The normoxic curve: oxygen fraction = 0.2095 atm ÷ pressure.
export function normoxicPoints(domain: MapDomain = MAP_DOMAIN, steps = 60): { psi: number; o2Pct: number }[] {
  const out: { psi: number; o2Pct: number }[] = []
  const lo = Math.log(domain.psi[0])
  const hi = Math.log(domain.psi[1])
  for (let i = 0; i <= steps; i += 1) {
    const psi = Math.exp(lo + ((hi - lo) * i) / steps)
    const o2Pct = (0.2095 * 14.696 * 100) / psi
    if (o2Pct <= domain.o2Pct[1] && o2Pct >= domain.o2Pct[0]) out.push({ psi, o2Pct })
  }
  return out
}

const SHAPES: Record<FuelClass, (r: number) => string> = {
  solid: (r) => `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`,
  liquid: (r) => `M0,${-r * 1.25}L${r * 1.1},0L0,${r * 1.25}L${-r * 1.1},0Z`,
  gas: (r) => `M0,${-r * 1.2}L${r * 1.15},${r * 0.9}L${-r * 1.15},${r * 0.9}Z`,
  aerosol: (r) => `M${-r * 0.9},${-r * 0.9}h${r * 1.8}v${r * 1.8}h${-r * 1.8}Z`,
  unknown: (r) => `M${-r},${-r}L${r},${r}M${-r},${r}L${r},${-r}`,
}

// Fuel class is shown by shape and colour together, so colour is never the only signal.
export const markPath = (fuelClass: FuelClass, r: number): string => (SHAPES[fuelClass] ?? SHAPES.unknown)(r)

export const FUEL_CLASSES: { id: FuelClass; label: string; shape: string }[] = [
  { id: 'solid', label: 'Solid', shape: 'circle' },
  { id: 'liquid', label: 'Liquid', shape: 'diamond' },
  { id: 'gas', label: 'Gas', shape: 'triangle' },
  { id: 'aerosol', label: 'Smoke and aerosol', shape: 'square' },
  { id: 'unknown', label: 'Unknown', shape: 'cross' },
]
