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
// How far apart the marks of a stack sit once it has opened: far enough to point at one.
export const STACK_SPACING = 9
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
  // A mark that can be pointed at on its own: a test alone at its point, or one of an opened stack.
  single: boolean
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
  radius: number
  // Zoomed in far enough that its tests are spread out and each one can be pointed at.
  open: boolean
}

export function mapScales(box: MapBox, domain: MapDomain = MAP_DOMAIN) {
  const x = scaleLog().domain(domain.psi).range([box.left, box.left + box.width]).clamp(false)
  const y = scaleLinear().domain(domain.o2Pct).range([box.top + box.height, box.top]).clamp(false)
  return { x, y }
}

export const plottable = (t: Test): boolean => t.o2 != null && t.pressureAtm != null

// The radius a stack needs for its marks to sit STACK_SPACING apart.
export const spreadRadius = (n: number): number => STACK_SPACING * Math.sqrt(n / Math.PI)

// A stack keeps its 9 pixels on the whole map. Zoomed in, it grows with the zoom until its
// marks are spread out, and from then on each of its tests is a mark of its own.
export function stackRadius(n: number, magnification = 1): { radius: number; open: boolean } {
  const full = Math.max(STACK_RADIUS, spreadRadius(n))
  const radius = Math.min(STACK_RADIUS * Math.max(1, magnification), full)
  return { radius, open: magnification > 1 + 1e-6 && radius >= spreadRadius(n) - 1e-6 }
}

// The tests grouped by the point they share, in the order the map draws them.
export function pointGroups(tests: Test[]): Map<string, Test[]> {
  const groups = new Map<string, Test[]>()
  for (const t of tests) {
    if (!plottable(t)) continue
    const key = `${(t.o2 as number).toFixed(4)}|${(t.pressureAtm as number).toFixed(4)}`
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }
  return groups
}

// Every test is its own mark. Tests that share a position sit in a tight spiral capped at 9 pixels,
// which opens up as the map is zoomed in.
export function layoutMap(tests: Test[], box: MapBox, domain: MapDomain = MAP_DOMAIN): { marks: MapMark[]; stacks: MapStack[] } {
  const magnification = zoomMagnification(domain)
  const { x, y } = mapScales(box, domain)
  const groups = pointGroups(tests)
  const marks: MapMark[] = []
  const stacks: MapStack[] = []
  for (const [key, list] of groups) {
    const cx = x(atmToPsi(list[0].pressureAtm as number))
    const cy = y((list[0].o2 as number) * 100)
    const n = list.length
    const { radius, open } = stackRadius(n, magnification)
    list.forEach((t, k) => {
      const r = n === 1 ? 0 : radius * Math.sqrt((k + 0.5) / n)
      const a = k * GOLDEN_ANGLE
      marks.push({
        testId: t.id,
        accession: t.accession,
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
        fuelClass: t.fuelClass,
        hollow: isAssumed(t),
        stackKey: n > 1 ? key : null,
        single: n === 1 || open,
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
        radius,
        open,
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

// The same shapes placed at a point, so many marks can be drawn as one path.
const f1 = (v: number): string => (Math.round(v * 10) / 10).toString()
const SHAPES_AT: Record<FuelClass, (x: number, y: number, r: number) => string> = {
  solid: (x, y, r) => `M${f1(x - r)},${f1(y)}a${f1(r)},${f1(r)} 0 1,0 ${f1(2 * r)},0a${f1(r)},${f1(r)} 0 1,0 ${f1(-2 * r)},0`,
  liquid: (x, y, r) => `M${f1(x)},${f1(y - r * 1.25)}l${f1(r * 1.1)},${f1(r * 1.25)}l${f1(-r * 1.1)},${f1(r * 1.25)}l${f1(-r * 1.1)},${f1(-r * 1.25)}z`,
  gas: (x, y, r) => `M${f1(x)},${f1(y - r * 1.2)}l${f1(r * 1.15)},${f1(r * 2.1)}h${f1(-r * 2.3)}z`,
  aerosol: (x, y, r) => `M${f1(x - r * 0.9)},${f1(y - r * 0.9)}h${f1(r * 1.8)}v${f1(r * 1.8)}h${f1(-r * 1.8)}z`,
  unknown: (x, y, r) => `M${f1(x - r)},${f1(y - r)}l${f1(2 * r)},${f1(2 * r)}m0,${f1(-2 * r)}l${f1(-2 * r)},${f1(2 * r)}`,
}
export const markPathAt = (fuelClass: FuelClass, x: number, y: number, r: number): string => (SHAPES_AT[fuelClass] ?? SHAPES_AT.unknown)(x, y, r)

export const FUEL_CLASSES: { id: FuelClass; label: string; shape: string }[] = [
  { id: 'solid', label: 'Solid', shape: 'circle' },
  { id: 'liquid', label: 'Liquid', shape: 'diamond' },
  { id: 'gas', label: 'Gas', shape: 'triangle' },
  { id: 'aerosol', label: 'Smoke and aerosol', shape: 'square' },
  { id: 'unknown', label: 'Unknown', shape: 'cross' },
]

// ---- zoom -------------------------------------------------------------------
// The zoomed view is a smaller domain. Pressure is zoomed in log space, so the log axis stays a
// log axis at every zoom, and oxygen in plain percent. The view never leaves the whole map.

// The narrowest view: 3 percent of pressure and one point of oxygen.
export const MIN_PSI_RATIO = 1.03
export const MIN_O2_SPAN = 1

// Fit [lo, hi] to a width between min and the whole range, keeping the anchor point where it
// was, then slide it back inside the whole range.
function fit(lo: number, hi: number, anchor: number, full: [number, number], min: number): [number, number] {
  const width = Math.min(full[1] - full[0], Math.max(min, hi - lo))
  const f = hi > lo ? (anchor - lo) / (hi - lo) : 0.5
  let a = anchor - f * width
  if (a < full[0]) a = full[0]
  if (a + width > full[1]) a = full[1] - width
  return [a, a + width]
}

function fromLogs(l: [number, number]): [number, number] {
  return [Math.exp(l[0]), Math.exp(l[1])]
}

function domainFrom(l: [number, number], o: [number, number], lAnchor: number, oAnchor: number, full: MapDomain): MapDomain {
  const fl: [number, number] = [Math.log(full.psi[0]), Math.log(full.psi[1])]
  return {
    psi: fromLogs(fit(l[0], l[1], lAnchor, fl, Math.log(MIN_PSI_RATIO))),
    o2Pct: fit(o[0], o[1], oAnchor, full.o2Pct, MIN_O2_SPAN),
  }
}

/** The domain inside the whole map, no narrower than the limits. */
export function clampDomain(d: MapDomain, full: MapDomain = MAP_DOMAIN): MapDomain {
  const l: [number, number] = [Math.log(d.psi[0]), Math.log(d.psi[1])]
  return domainFrom(l, d.o2Pct, (l[0] + l[1]) / 2, (d.o2Pct[0] + d.o2Pct[1]) / 2, full)
}

/**
 * Zoom by a factor around a point of the view. fx runs 0 to 1 from the left edge and fy 0 to 1
 * from the bottom edge. A factor above 1 zooms in. The test under that point stays under it.
 */
export function zoomAt(d: MapDomain, fx: number, fy: number, factor: number, full: MapDomain = MAP_DOMAIN): MapDomain {
  const l0 = Math.log(d.psi[0])
  const l1 = Math.log(d.psi[1])
  const la = l0 + fx * (l1 - l0)
  const oa = d.o2Pct[0] + fy * (d.o2Pct[1] - d.o2Pct[0])
  const l: [number, number] = [la - (la - l0) / factor, la + (l1 - la) / factor]
  const o: [number, number] = [oa - (oa - d.o2Pct[0]) / factor, oa + (d.o2Pct[1] - oa) / factor]
  return domainFrom(l, o, la, oa, full)
}

/** Pan by a drag. dx and dy are the drag as fractions of the plot, right and down positive. */
export function panBy(d: MapDomain, dx: number, dy: number, full: MapDomain = MAP_DOMAIN): MapDomain {
  const l0 = Math.log(d.psi[0])
  const l1 = Math.log(d.psi[1])
  const shiftL = -dx * (l1 - l0)
  const shiftO = dy * (d.o2Pct[1] - d.o2Pct[0])
  const l: [number, number] = [l0 + shiftL, l1 + shiftL]
  const o: [number, number] = [d.o2Pct[0] + shiftO, d.o2Pct[1] + shiftO]
  return domainFrom(l, o, (l[0] + l[1]) / 2, (o[0] + o[1]) / 2, full)
}

/** The domain inside a box drawn on the plot, from two corners in pixels. */
export function boxDomain(d: MapDomain, box: MapBox, a: { x: number; y: number }, b: { x: number; y: number }, full: MapDomain = MAP_DOMAIN): MapDomain {
  const { x, y } = mapScales(box, d)
  const psi = [x.invert(Math.min(a.x, b.x)), x.invert(Math.max(a.x, b.x))]
  const o2 = [y.invert(Math.max(a.y, b.y)), y.invert(Math.min(a.y, b.y))]
  const l: [number, number] = [Math.log(psi[0]), Math.log(psi[1])]
  const o: [number, number] = [o2[0], o2[1]]
  return domainFrom(l, o, (l[0] + l[1]) / 2, (o[0] + o[1]) / 2, full)
}

/** How many times the view is magnified against the whole map, on its less zoomed axis. */
export function zoomMagnification(d: MapDomain, full: MapDomain = MAP_DOMAIN): number {
  const kx = Math.log(full.psi[1] / full.psi[0]) / Math.log(d.psi[1] / d.psi[0])
  const ky = (full.o2Pct[1] - full.o2Pct[0]) / (d.o2Pct[1] - d.o2Pct[0])
  return Math.max(1, Math.min(kx, ky))
}

/**
 * The pixel transform that takes the view drawn for one domain to where it sits for another.
 * It lets a zoom or pan gesture move the drawn marks at once, and lay them out again only when
 * the gesture rests. On a log axis this is still exact, because pixels are linear in log psi.
 */
export function viewTransform(from: MapDomain, to: MapDomain, box: MapBox): { kx: number; ky: number; tx: number; ty: number } {
  const { x, y } = mapScales(box, from)
  const x0 = x(to.psi[0])
  const x1 = x(to.psi[1])
  const top = y(to.o2Pct[1])
  const bottom = y(to.o2Pct[0])
  const kx = box.width / (x1 - x0)
  const ky = box.height / (bottom - top)
  return { kx, ky, tx: box.left - kx * x0, ty: box.top - ky * top }
}

// The zoom as it is written in the address: pressure range, then oxygen range.
const psiText = (v: number): string => String(Number(v.toPrecision(4)))
const o2Text = (v: number): string => String(Number(v.toFixed(2)))

export function encodeZoom(d: MapDomain): string {
  return `${psiText(d.psi[0])}-${psiText(d.psi[1])}_${o2Text(d.o2Pct[0])}-${o2Text(d.o2Pct[1])}`
}

/** A zoom from the address. Anything broken or outside the map is read as no zoom. */
export function parseZoom(text: string | null, full: MapDomain = MAP_DOMAIN): MapDomain | null {
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(text ?? '')
  if (!m) return null
  const [p0, p1, o0, o1] = m.slice(1).map(Number)
  if (!(p0 < p1 && o0 < o1) || p0 <= 0) return null
  return roundDomain(clampDomain({ psi: [p0, p1], o2Pct: [o0, o1] }, full))
}

/** The domain as the address will hold it, so a view and its address always agree. */
export function roundDomain(d: MapDomain): MapDomain {
  return { psi: [Number(psiText(d.psi[0])), Number(psiText(d.psi[1]))], o2Pct: [Number(o2Text(d.o2Pct[0])), Number(o2Text(d.o2Pct[1]))] }
}

export const sameDomain = (a: MapDomain, b: MapDomain): boolean => encodeZoom(a) === encodeZoom(b)

const tidy = (t: number): number => Number(t.toPrecision(6))

/**
 * Pressure ticks. The named pressures while at least three of them are in view, then round
 * numbers, so a zoomed axis always carries labels.
 */
export function pressureTicks(d: MapDomain, narrow = false): number[] {
  const named = PRESSURE_TICKS.filter((t) => t >= d.psi[0] - 1e-6 && t <= d.psi[1] + 1e-6 && (!narrow || [3, 8.2, 14.7, 30, 80].includes(t)))
  if (named.length >= 3) return named
  return scaleLinear().domain(d.psi).ticks(narrow ? 3 : 5).map(tidy)
}

/** Oxygen ticks: every ten percent while at least three are in view, then round numbers. */
export function oxygenTicks(d: MapDomain): number[] {
  const tens = OXYGEN_TICKS.filter((t) => t >= d.o2Pct[0] - 1e-6 && t <= d.o2Pct[1] + 1e-6)
  if (tens.length >= 3) return tens
  return scaleLinear().domain(d.o2Pct).ticks(5).map(tidy)
}
