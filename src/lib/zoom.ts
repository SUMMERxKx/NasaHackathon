// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The zoom every chart shares. It began as the Atmosphere Map's zoom and works on any chart with
// two continuous axes. A zoomed view is a smaller domain inside the whole chart. A log axis is
// zoomed in log space, so it stays a log axis at every zoom. A locked axis never zooms, which is
// how a chart with one category axis zooms along its value axis alone.
import { scaleLinear } from 'd3-scale'

export type Range = [number, number]
export type ZoomDomain = { x: Range; y: Range }
export type ZoomBox = { left: number; top: number; width: number; height: number }

export type ZoomAxis = {
  // The whole axis. The view never leaves it.
  full: Range
  log?: boolean
  // The narrowest view, in the axis's own space: a log ratio on a log axis, a plain span otherwise.
  minSpan: number
  // Never zoomed or panned: a category axis.
  locked?: boolean
  // How a bound is written in the address. The view is rounded to it, so a view and its address agree.
  text?: (v: number) => string
}
export type ZoomAxes = { x: ZoomAxis; y: ZoomAxis }

// Four significant figures, the default for a bound in the address.
export const fourFigures = (v: number): string => String(Number(v.toPrecision(4)))

// A linear axis from lo to hi that zooms to a hundredth of itself at most.
export function linearAxis(full: Range, extra: Partial<ZoomAxis> = {}): ZoomAxis {
  return { full, minSpan: (full[1] - full[0]) / 100, ...extra }
}

const into = (axis: ZoomAxis, v: number): number => (axis.log ? Math.log(v) : v)
const outOf = (axis: ZoomAxis, v: number): number => (axis.log ? Math.exp(v) : v)
const toSpace = (axis: ZoomAxis, r: Range): Range => [into(axis, r[0]), into(axis, r[1])]

// Fit [lo, hi] to a width between min and the whole range, keeping the anchor point where it
// was, then slide it back inside the whole range.
function fit(lo: number, hi: number, anchor: number, full: Range, min: number): Range {
  const width = Math.min(full[1] - full[0], Math.max(min, hi - lo))
  const f = hi > lo ? (anchor - lo) / (hi - lo) : 0.5
  let a = anchor - f * width
  if (a < full[0]) a = full[0]
  if (a + width > full[1]) a = full[1] - width
  return [a, a + width]
}

// One axis of a new view, from a range and an anchor in the axis's own space.
function settle(axis: ZoomAxis, r: Range, anchor: number): Range {
  if (axis.locked) return [axis.full[0], axis.full[1]]
  const f = fit(r[0], r[1], anchor, toSpace(axis, axis.full), axis.minSpan)
  return [outOf(axis, f[0]), outOf(axis, f[1])]
}

const mid = (r: Range): number => (r[0] + r[1]) / 2

export const fullDomain = (axes: ZoomAxes): ZoomDomain => ({ x: [axes.x.full[0], axes.x.full[1]], y: [axes.y.full[0], axes.y.full[1]] })

/** The domain inside the whole chart, no narrower than the limits. */
export function clampView(d: ZoomDomain, axes: ZoomAxes): ZoomDomain {
  const lx = toSpace(axes.x, d.x)
  const ly = toSpace(axes.y, d.y)
  return { x: settle(axes.x, lx, mid(lx)), y: settle(axes.y, ly, mid(ly)) }
}

/**
 * Zoom by a factor around a point of the view. fx runs 0 to 1 from the left edge and fy 0 to 1
 * from the bottom edge. A factor above 1 zooms in. The point under the pointer stays under it.
 */
export function zoomView(d: ZoomDomain, axes: ZoomAxes, fx: number, fy: number, factor: number): ZoomDomain {
  const one = (axis: ZoomAxis, r: Range, f: number): Range => {
    const [a0, a1] = toSpace(axis, r)
    const anchor = a0 + f * (a1 - a0)
    return settle(axis, [anchor - (anchor - a0) / factor, anchor + (a1 - anchor) / factor], anchor)
  }
  return { x: one(axes.x, d.x, fx), y: one(axes.y, d.y, fy) }
}

/** Pan by a drag. dx and dy are the drag as fractions of the plot, right and down positive. */
export function panView(d: ZoomDomain, axes: ZoomAxes, dx: number, dy: number): ZoomDomain {
  const one = (axis: ZoomAxis, r: Range, shift: number): Range => {
    const [a0, a1] = toSpace(axis, r)
    const s = shift * (a1 - a0)
    return settle(axis, [a0 + s, a1 + s], (a0 + a1) / 2 + s)
  }
  return { x: one(axes.x, d.x, -dx), y: one(axes.y, d.y, dy) }
}

/** The scales that draw a domain into a box: pixels are linear in each axis's own space. */
export function viewScales(box: ZoomBox, d: ZoomDomain, axes: ZoomAxes): { x: (v: number) => number; y: (v: number) => number; invertX: (px: number) => number; invertY: (py: number) => number } {
  const [x0, x1] = toSpace(axes.x, d.x)
  const [y0, y1] = toSpace(axes.y, d.y)
  const kx = box.width / (x1 - x0 || 1)
  const ky = box.height / (y1 - y0 || 1)
  return {
    x: (v) => box.left + (into(axes.x, v) - x0) * kx,
    y: (v) => box.top + box.height - (into(axes.y, v) - y0) * ky,
    invertX: (px) => outOf(axes.x, x0 + (px - box.left) / kx),
    invertY: (py) => outOf(axes.y, y0 + (box.top + box.height - py) / ky),
  }
}

/** The domain inside a box drawn on the plot, from two corners in pixels. */
export function boxView(d: ZoomDomain, axes: ZoomAxes, box: ZoomBox, a: { x: number; y: number }, b: { x: number; y: number }): ZoomDomain {
  const s = viewScales(box, d, axes)
  const lx = toSpace(axes.x, [s.invertX(Math.min(a.x, b.x)), s.invertX(Math.max(a.x, b.x))])
  const ly = toSpace(axes.y, [s.invertY(Math.max(a.y, b.y)), s.invertY(Math.min(a.y, b.y))])
  return { x: settle(axes.x, lx, mid(lx)), y: settle(axes.y, ly, mid(ly)) }
}

/** How many times the view is magnified against the whole chart, on its less zoomed axis. */
export function magnification(d: ZoomDomain, axes: ZoomAxes): number {
  const k = (axis: ZoomAxis, r: Range): number => {
    const [f0, f1] = toSpace(axis, axis.full)
    const [v0, v1] = toSpace(axis, r)
    return (f1 - f0) / (v1 - v0)
  }
  const ks = [axes.x.locked ? null : k(axes.x, d.x), axes.y.locked ? null : k(axes.y, d.y)].filter((v): v is number => v != null)
  return Math.max(1, ...(ks.length > 0 ? [Math.min(...ks)] : []))
}

/**
 * The pixel transform that takes the view drawn for one domain to where it sits for another. It
 * lets a gesture move what is drawn at once, and lay it out again only when the gesture rests.
 * On a log axis this is still exact, because pixels are linear in the log.
 */
export function viewTransform(from: ZoomDomain, to: ZoomDomain, box: ZoomBox, axes: ZoomAxes): { kx: number; ky: number; tx: number; ty: number } {
  const s = viewScales(box, from, axes)
  const x0 = s.x(to.x[0])
  const x1 = s.x(to.x[1])
  const top = s.y(to.y[1])
  const bottom = s.y(to.y[0])
  const kx = box.width / (x1 - x0)
  const ky = box.height / (bottom - top)
  return { kx, ky, tx: box.left - kx * x0, ty: box.top - ky * top }
}

const textOf = (axis: ZoomAxis): ((v: number) => string) => axis.text ?? fourFigures

/** The view as the address holds it: x range, then y range. */
export function encodeView(d: ZoomDomain, axes: ZoomAxes): string {
  const tx = textOf(axes.x)
  const ty = textOf(axes.y)
  return `${tx(d.x[0])}-${tx(d.x[1])}_${ty(d.y[0])}-${ty(d.y[1])}`
}

/** The view rounded as the address will hold it. */
export function roundView(d: ZoomDomain, axes: ZoomAxes): ZoomDomain {
  const tx = textOf(axes.x)
  const ty = textOf(axes.y)
  return { x: [Number(tx(d.x[0])), Number(tx(d.x[1]))], y: [Number(ty(d.y[0])), Number(ty(d.y[1]))] }
}

/** A view from the address. Anything broken is read as no zoom, and anything wide is clamped. */
export function parseView(text: string | null, axes: ZoomAxes): ZoomDomain | null {
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(text ?? '')
  if (!m) return null
  const [x0, x1, y0, y1] = m.slice(1).map(Number)
  if (!(x0 < x1 && y0 < y1)) return null
  if ((axes.x.log && x0 <= 0) || (axes.y.log && y0 <= 0)) return null
  return roundView(clampView({ x: [x0, x1], y: [y0, y1] }, axes), axes)
}

export const sameView = (a: ZoomDomain, b: ZoomDomain, axes: ZoomAxes): boolean => encodeView(a, axes) === encodeView(b, axes)

const tidy = (t: number): number => Number(t.toPrecision(6))

/**
 * The ticks of a zoomed axis: the chart's own ticks while at least three of them are in view,
 * then round numbers, so a zoomed axis always carries labels.
 */
export function zoomTicks(own: number[], r: Range, count = 5): number[] {
  const inView = own.filter((t) => t >= r[0] - 1e-6 && t <= r[1] + 1e-6)
  if (inView.length >= 3) return inView
  return scaleLinear().domain(r).ticks(count).map(tidy)
}

// ---- points that share a place ---------------------------------------------
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// The radius a group of n points needs for each to sit `spacing` pixels from its neighbours.
export const spreadRadius = (n: number, spacing: number): number => spacing * Math.sqrt(n / Math.PI)

/** The offset of the k-th of n points on a sunflower spiral of the given radius. */
export function spiralOffset(k: number, n: number, radius: number): { dx: number; dy: number } {
  if (n <= 1 || radius <= 0) return { dx: 0, dy: 0 }
  const r = radius * Math.sqrt((k + 0.5) / n)
  const a = k * GOLDEN_ANGLE
  return { dx: r * Math.cos(a), dy: r * Math.sin(a) }
}

/**
 * Offsets for points that sit on exactly the same value. On the whole chart they stay as drawn.
 * Zoomed in, each group opens into a spiral, and from twice the magnification on each of its
 * points is `spacing` pixels from the next, so each one can be pointed at alone.
 */
export function spreadPoints(keys: string[], zoom: number, spacing = 9): { dx: number; dy: number }[] {
  const groups = new Map<string, number[]>()
  keys.forEach((key, i) => {
    const list = groups.get(key)
    if (list) list.push(i)
    else groups.set(key, [i])
  })
  const out = keys.map(() => ({ dx: 0, dy: 0 }))
  const grow = Math.min(1, Math.max(0, zoom - 1))
  if (grow <= 0) return out
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const radius = spreadRadius(list.length, spacing) * grow
    list.forEach((index, k) => {
      out[index] = spiralOffset(k, list.length, radius)
    })
  }
  return out
}
