// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The zoom every chart shares: the maths behind the wheel, the pan, the box and the address.
import { describe, expect, it } from 'vitest'
import { MAP_DOMAIN, boxDomain, encodeZoom, mapAxes, panBy, toView, zoomAt } from './mapLayout.ts'
import {
  boxView,
  clampView,
  encodeView,
  fullDomain,
  linearAxis,
  magnification,
  panView,
  parseView,
  roundView,
  sameView,
  spreadPoints,
  viewScales,
  viewTransform,
  zoomTicks,
  zoomView,
} from './zoom.ts'
import type { ZoomAxes } from './zoom.ts'

const LINEAR: ZoomAxes = { x: linearAxis([0, 40]), y: linearAxis([0, 1.05]) }
const LOG: ZoomAxes = { x: { full: [3, 80], log: true, minSpan: Math.log(1.03) }, y: linearAxis([10, 100]) }
const ROWS: ZoomAxes = { x: linearAxis([0, 50]), y: { full: [0, 1], minSpan: 1, locked: true } }
const box = { left: 46, top: 10, width: 400, height: 300 }

describe('shared zoom', () => {
  it('keeps the point under the pointer where it was, on a linear and a log axis', () => {
    for (const axes of [LINEAR, LOG]) {
      const whole = fullDomain(axes)
      const before = viewScales(box, whole, axes)
      const px = box.left + 0.3 * box.width
      const py = box.top + 0.4 * box.height
      const at = { x: before.invertX(px), y: before.invertY(py) }
      const next = zoomView(whole, axes, 0.3, 0.6, 3)
      const after = viewScales(box, next, axes)
      expect(after.x(at.x)).toBeCloseTo(px, 6)
      expect(after.y(at.y)).toBeCloseTo(py, 6)
      expect(magnification(next, axes)).toBeCloseTo(3, 9)
    }
  })

  it('zooms a log axis in log space, so it stays evenly spaced in the log', () => {
    const next = zoomView(fullDomain(LOG), LOG, 0.5, 0.5, 2)
    const whole = Math.log(80 / 3)
    expect(Math.log(next.x[1] / next.x[0])).toBeCloseTo(whole / 2, 9)
    // The centre of the view stays the geometric centre of the whole axis.
    expect(Math.sqrt(next.x[0] * next.x[1])).toBeCloseTo(Math.sqrt(3 * 80), 6)
  })

  it('never leaves the whole chart and never zooms past its limit', () => {
    let d = fullDomain(LINEAR)
    for (let i = 0; i < 40; i += 1) d = zoomView(d, LINEAR, 1, 0, 3)
    expect(d.x[1] - d.x[0]).toBeCloseTo(0.4, 9)
    expect(d.x[1]).toBeCloseTo(40, 9)
    expect(d.y[0]).toBeCloseTo(0, 9)
    const out = zoomView(d, LINEAR, 0.5, 0.5, 1 / 1000)
    expect(sameView(out, fullDomain(LINEAR), LINEAR)).toBe(true)
  })

  it('pans by a drag and stops at the edge without changing the zoom', () => {
    const d = zoomView(fullDomain(LINEAR), LINEAR, 0.5, 0.5, 4)
    const moved = panView(d, LINEAR, -0.25, 0.25)
    expect(moved.x[0]).toBeCloseTo(d.x[0] + 0.25 * (d.x[1] - d.x[0]), 9)
    expect(moved.y[0]).toBeCloseTo(d.y[0] + 0.25 * (d.y[1] - d.y[0]), 9)
    const pushed = panView(d, LINEAR, 10, -10)
    expect(pushed.x[0]).toBeCloseTo(0, 9)
    expect(pushed.y[0]).toBeCloseTo(0, 9)
    expect(magnification(pushed, LINEAR)).toBeCloseTo(4, 9)
  })

  it('zooms to a box drawn either way round', () => {
    const whole = fullDomain(LINEAR)
    const s = viewScales(box, whole, LINEAR)
    const a = { x: s.x(10), y: s.y(0.8) }
    const b = { x: s.x(20), y: s.y(0.4) }
    for (const d of [boxView(whole, LINEAR, box, a, b), boxView(whole, LINEAR, box, b, a)]) {
      expect(d.x[0]).toBeCloseTo(10, 6)
      expect(d.x[1]).toBeCloseTo(20, 6)
      expect(d.y[0]).toBeCloseTo(0.4, 6)
      expect(d.y[1]).toBeCloseTo(0.8, 6)
    }
  })

  it('never moves a locked category axis', () => {
    const whole = fullDomain(ROWS)
    const s = viewScales(box, whole, ROWS)
    const zoomed = zoomView(whole, ROWS, 0.2, 0.9, 5)
    expect(zoomed.y).toEqual([0, 1])
    expect(zoomed.x[1] - zoomed.x[0]).toBeCloseTo(10, 9)
    expect(panView(zoomed, ROWS, 0.1, 0.5).y).toEqual([0, 1])
    expect(boxView(whole, ROWS, box, { x: s.x(5), y: box.top + 20 }, { x: s.x(15), y: box.top + 40 }).y).toEqual([0, 1])
    // The magnification counts the value axis alone.
    expect(magnification(zoomed, ROWS)).toBeCloseTo(5, 9)
    const t = viewTransform(whole, zoomed, box, ROWS)
    expect(t.ky).toBeCloseTo(1, 9)
    expect(t.ty).toBeCloseTo(0, 9)
  })

  it('moves what is drawn for one view onto where it sits in the next', () => {
    for (const axes of [LINEAR, LOG]) {
      const from = zoomView(fullDomain(axes), axes, 0.4, 0.3, 2)
      const to = zoomView(from, axes, 0.7, 0.2, 3)
      const { kx, ky, tx, ty } = viewTransform(from, to, box, axes)
      const a = viewScales(box, from, axes)
      const b = viewScales(box, to, axes)
      const vx = (to.x[0] + to.x[1]) / 2
      const vy = (to.y[0] + to.y[1]) / 2
      expect(kx * a.x(vx) + tx).toBeCloseTo(b.x(vx), 6)
      expect(ky * a.y(vy) + ty).toBeCloseTo(b.y(vy), 6)
    }
  })

  it('writes a view to the address and reads it back the same', () => {
    const d = roundView(zoomView(fullDomain(LINEAR), LINEAR, 0.58, 0.12, 6.3), LINEAR)
    const text = encodeView(d, LINEAR)
    const back = parseView(text, LINEAR)
    expect(back).not.toBeNull()
    expect(encodeView(back!, LINEAR)).toBe(text)
    expect(parseView('moon', LINEAR)).toBeNull()
    expect(parseView('20-10_0-1', LINEAR)).toBeNull()
    expect(parseView(null, LINEAR)).toBeNull()
    expect(parseView('0-10_0-1', LOG)).toBeNull()
    // A view wider than the chart is read as the whole chart.
    expect(sameView(parseView('0-500_0-9', LINEAR)!, clampView(fullDomain(LINEAR), LINEAR), LINEAR)).toBe(true)
  })

  it('gives the map exactly the zoom it had', () => {
    const axes = mapAxes()
    const d = zoomAt(MAP_DOMAIN, 0.31, 0.77, 5.5)
    expect(encodeView(toView(d), axes)).toBe(encodeZoom(d))
    expect(toView(panBy(d, 0.1, -0.2))).toEqual(panView(toView(d), axes, 0.1, -0.2))
    const a = { x: 100, y: 80 }
    const b = { x: 220, y: 200 }
    const viaMap = toView(boxDomain(MAP_DOMAIN, box, a, b))
    const viaShared = boxView(toView(MAP_DOMAIN), axes, box, a, b)
    expect(viaMap.x[0]).toBeCloseTo(viaShared.x[0], 9)
    expect(viaMap.y[1]).toBeCloseTo(viaShared.y[1], 9)
  })

  it('keeps the chart own ticks while three are in view, then uses round numbers', () => {
    const own = [0, 10, 20, 30, 40]
    expect(zoomTicks(own, [0, 40])).toEqual(own)
    expect(zoomTicks(own, [5, 35])).toEqual([10, 20, 30])
    const fine = zoomTicks(own, [12, 14])
    expect(fine.length).toBeGreaterThanOrEqual(3)
    expect(fine.every((t) => t >= 12 && t <= 14)).toBe(true)
  })

  it('leaves stacked points as drawn on the whole chart and spreads them once zoomed in', () => {
    const keys = ['a', 'a', 'a', 'a', 'a', 'b', 'c', 'c']
    expect(spreadPoints(keys, 1).every((o) => o.dx === 0 && o.dy === 0)).toBe(true)
    const open = spreadPoints(keys, 2, 9)
    // A point alone never moves.
    expect(open[5]).toEqual({ dx: 0, dy: 0 })
    // Every point of a stack sits apart from the others, far enough to point at one.
    const stack = open.slice(0, 5)
    for (let i = 0; i < stack.length; i += 1) {
      for (let j = i + 1; j < stack.length; j += 1) {
        expect(Math.hypot(stack[i].dx - stack[j].dx, stack[i].dy - stack[j].dy)).toBeGreaterThan(4)
      }
    }
    expect(Math.hypot(open[6].dx - open[7].dx, open[6].dy - open[7].dy)).toBeGreaterThan(4)
    // Halfway there, the stack is half open.
    const half = spreadPoints(keys, 1.5, 9)
    expect(Math.hypot(half[4].dx, half[4].dy)).toBeCloseTo(Math.hypot(open[4].dx, open[4].dy) / 2, 9)
  })
})
