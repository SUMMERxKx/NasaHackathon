// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Layout of the Atmosphere Map. Scales, the stacking rule and the coverage ring.
import { scaleLinear, scaleLog } from 'd3-scale'
import type { FuelClass, Test } from '../types.ts'
import { isAssumed } from './coverage.ts'
import { parseNumber } from './parse.ts'
import { atmToPsi } from './units.ts'
import { boxView, clampView, encodeView, magnification, panView, parseView, roundView, spiralOffset, spreadRadius as spreadFor, viewTransform as sharedTransform, zoomTicks, zoomView } from './zoom.ts'
import type { ZoomAxes, ZoomDomain } from './zoom.ts'

export const MAP_DOMAIN = { psi: [3, 80] as [number, number], o2Pct: [10, 100] as [number, number] }
export const PRESSURE_TICKS = [3, 4.3, 8.2, 10.2, 14.7, 30, 50, 80]
export const OXYGEN_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
export const STACK_RADIUS = 9
// How far apart the marks of a stack sit once it has opened: far enough to point at one.
export const STACK_SPACING = 9
export const BADGE_MIN = 20

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

// The cell NASA wrote for a coordinate, found by its header.
function rawCell(t: Test, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const key = Object.keys(t.raw).find((k) => pattern.test(k))
    if (key != null) return t.raw[key].trim()
  }
  return null
}
const OXYGEN_HEADERS = [/oxygen/i, /\bx?o2\b/i, /^o initial/i]
const PRESSURE_HEADERS = [/pressure/i, /^p(init|mean)\b/i]

// Why a test is not on the map, read from its row as NASA wrote it. Null when it is on the map.
// No value is ever invented to place it.
export function unplottedReason(t: Test): string | null {
  if (plottable(t)) return null
  const gaps = [
    ...(t.o2 == null ? [{ name: 'oxygen', cell: rawCell(t, OXYGEN_HEADERS) }] : []),
    ...(t.pressureAtm == null ? [{ name: 'pressure', cell: rawCell(t, PRESSURE_HEADERS) }] : []),
  ]
  if (gaps.every((g) => !g.cell)) return `has no ${gaps.map((g) => g.name).join(' or ')} value in NASA's table`
  const parts = gaps.map((g) => {
    if (!g.cell) return { text: `no ${g.name} value`, zero: false }
    const value = parseNumber(g.cell).value
    if (value != null && value <= 0 && /^[-+.\d\s]+$/.test(g.cell)) return { text: `a ${g.name} of ${g.cell}`, zero: true, name: g.name }
    return { text: `${g.name} written as "${g.cell}"`, zero: false }
  })
  const zero = parts.find((p) => p.zero)
  const tail = zero ? `, so it cannot be placed on the ${zero.name} axis` : ', not as a single value'
  return `has ${parts.map((p) => p.text).join(' and ')} in NASA's table${tail}`
}

export type UnplottedNote = { total: number; plotted: number; named: { test: Test; reason: string }[]; more: number }

// The line beside a map that shows a set of tests: how many are plotted and which are not, and why.
export function unplottedNote(tests: Test[], limit = 5): UnplottedNote {
  const missing = tests.filter((t) => !plottable(t))
  return {
    total: tests.length,
    plotted: tests.length - missing.length,
    named: missing.slice(0, limit).map((test) => ({ test, reason: unplottedReason(test) as string })),
    more: Math.max(0, missing.length - limit),
  }
}

// The radius a stack needs for its marks to sit STACK_SPACING apart.
export const spreadRadius = (n: number): number => spreadFor(n, STACK_SPACING)

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
      const { dx, dy } = spiralOffset(k, n, radius)
      marks.push({
        testId: t.id,
        accession: t.accession,
        x: cx + dx,
        y: cy + dy,
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
// The map zooms with the zoom every chart shares (zoom.ts). Pressure is its log x axis, so the log
// axis stays a log axis at every zoom, and oxygen its plain y axis. The view never leaves the map.

// The narrowest view: 3 percent of pressure and one point of oxygen.
export const MIN_PSI_RATIO = 1.03
export const MIN_O2_SPAN = 1

// The zoom as it is written in the address: pressure range, then oxygen range.
const psiText = (v: number): string => String(Number(v.toPrecision(4)))
const o2Text = (v: number): string => String(Number(v.toFixed(2)))

/** The map's two axes for the shared zoom. */
export function mapAxes(full: MapDomain = MAP_DOMAIN): ZoomAxes {
  return {
    x: { full: full.psi, log: true, minSpan: Math.log(MIN_PSI_RATIO), text: psiText },
    y: { full: full.o2Pct, minSpan: MIN_O2_SPAN, text: o2Text },
  }
}
export const toView = (d: MapDomain): ZoomDomain => ({ x: d.psi, y: d.o2Pct })
export const fromView = (d: ZoomDomain): MapDomain => ({ psi: d.x, o2Pct: d.y })

/** The domain inside the whole map, no narrower than the limits. */
export function clampDomain(d: MapDomain, full: MapDomain = MAP_DOMAIN): MapDomain {
  return fromView(clampView(toView(d), mapAxes(full)))
}

/**
 * Zoom by a factor around a point of the view. fx runs 0 to 1 from the left edge and fy 0 to 1
 * from the bottom edge. A factor above 1 zooms in. The test under that point stays under it.
 */
export function zoomAt(d: MapDomain, fx: number, fy: number, factor: number, full: MapDomain = MAP_DOMAIN): MapDomain {
  return fromView(zoomView(toView(d), mapAxes(full), fx, fy, factor))
}

/** Pan by a drag. dx and dy are the drag as fractions of the plot, right and down positive. */
export function panBy(d: MapDomain, dx: number, dy: number, full: MapDomain = MAP_DOMAIN): MapDomain {
  return fromView(panView(toView(d), mapAxes(full), dx, dy))
}

/** The domain inside a box drawn on the plot, from two corners in pixels. */
export function boxDomain(d: MapDomain, box: MapBox, a: { x: number; y: number }, b: { x: number; y: number }, full: MapDomain = MAP_DOMAIN): MapDomain {
  return fromView(boxView(toView(d), mapAxes(full), box, a, b))
}

/** How many times the view is magnified against the whole map, on its less zoomed axis. */
export function zoomMagnification(d: MapDomain, full: MapDomain = MAP_DOMAIN): number {
  return magnification(toView(d), mapAxes(full))
}

/** The pixel transform that takes the view drawn for one domain to where it sits for another. */
export function viewTransform(from: MapDomain, to: MapDomain, box: MapBox): { kx: number; ky: number; tx: number; ty: number } {
  return sharedTransform(toView(from), toView(to), box, mapAxes())
}

export function encodeZoom(d: MapDomain): string {
  return encodeView(toView(d), mapAxes())
}

/** A zoom from the address. Anything broken or outside the map is read as no zoom. */
export function parseZoom(text: string | null, full: MapDomain = MAP_DOMAIN): MapDomain | null {
  const view = parseView(text, mapAxes(full))
  return view ? fromView(view) : null
}

/** The domain as the address will hold it, so a view and its address always agree. */
export function roundDomain(d: MapDomain): MapDomain {
  return fromView(roundView(toView(d), mapAxes()))
}

export const sameDomain = (a: MapDomain, b: MapDomain): boolean => encodeZoom(a) === encodeZoom(b)

/**
 * Pressure ticks. The named pressures while at least three of them are in view, then round
 * numbers, so a zoomed axis always carries labels.
 */
export function pressureTicks(d: MapDomain, narrow = false): number[] {
  const named = narrow ? PRESSURE_TICKS.filter((t) => [3, 8.2, 14.7, 30, 80].includes(t)) : PRESSURE_TICKS
  return zoomTicks(named, d.psi, narrow ? 3 : 5)
}

/** Oxygen ticks: every ten percent while at least three are in view, then round numbers. */
export function oxygenTicks(d: MapDomain): number[] {
  return zoomTicks(OXYGEN_TICKS, d.o2Pct)
}
