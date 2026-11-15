// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The zoom every chart shares, taken from the Atmosphere Map. Ctrl or Command with the wheel, or a
// trackpad pinch, zooms around the pointer, and a plain wheel still scrolls the page. A drag pans a
// zoomed chart, Shift and a drag zooms to a box, and the zoom buttons and the reset sit in the
// chart's toolbar. A gesture moves the drawn layers by one transform and the chart is laid out
// again only once it rests. ZoomChart is the whole thing for a plain SVG chart.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { boxView, clampView, encodeView, fullDomain, magnification, panView, roundView, sameView, viewScales, viewTransform, zoomView } from '../lib/zoom.ts'
import type { ZoomAxes, ZoomBox, ZoomDomain } from '../lib/zoom.ts'
import { ChartFrame } from './ChartFrame.tsx'
import type { FrameSize } from './ChartFrame.tsx'

// A zoom button doubles or halves the view. The address catches up once a gesture has rested.
export const ZOOM_STEP = 2
const ADDRESS_DELAY = 250
const SETTLE_DELAY = 160
export const ZOOM_HINT = 'Hold Ctrl or Command and scroll to zoom, or pinch'

const axesKey = (axes: ZoomAxes): string => `${encodeView(fullDomain(axes), axes)}|${axes.x.log ? 1 : 0}${axes.y.log ? 1 : 0}${axes.x.locked ? 1 : 0}${axes.y.locked ? 1 : 0}`

/**
 * The view a chart shows. It follows `base`, which is the zoom from the address or the chart's
 * resting view, and it moves first when the chart is zoomed, so the address is written once a
 * gesture rests rather than on every step of it. Without onZoom the view is the chart's own.
 */
export function useZoomState({ axes, base, onZoom }: { axes: ZoomAxes; base?: ZoomDomain | null; onZoom?: (next: ZoomDomain | null) => void }) {
  const full = useMemo(() => fullDomain(axes), [axesKey(axes)]) // eslint-disable-line react-hooks/exhaustive-deps
  const start = base ?? full
  const startKey = `${axesKey(axes)}#${encodeView(start, axes)}`
  const [view, setView] = useState<ZoomDomain>(start)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ axes, onZoom })
  latest.current = { axes, onZoom }
  // Before paint, so a chart whose axes just changed never shows a frame of the old view, which
  // would flash the reset button and move the card.
  useLayoutEffect(() => {
    if (pending.current) clearTimeout(pending.current)
    pending.current = null
    setView((v) => (sameView(v, start, axes) ? v : start))
    // The key stands for the domain, so the effect runs only when the address or the chart changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey])
  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current)
  }, [])
  const zoomTo = useCallback((next: ZoomDomain | null, delay = 0) => {
    const { axes: a } = latest.current
    const whole = fullDomain(a)
    const target = next ? roundView(clampView(next, a), a) : whole
    setView((v) => (sameView(v, target, a) ? v : target))
    if (pending.current) clearTimeout(pending.current)
    const write = () => {
      pending.current = null
      latest.current.onZoom?.(sameView(target, whole, a) ? null : target)
    }
    if (delay > 0) pending.current = setTimeout(write, delay)
    else write()
  }, [])
  const whole = sameView(view, full, axes)
  const deepest = sameView(zoomView(view, axes, 0.5, 0.5, ZOOM_STEP), view, axes)
  return { view, zoomTo, whole, deepest }
}

/**
 * A zoom kept in the address under one key, for a chart whose screen already keeps its state there.
 * Writing it replaces the entry and keeps the scroll, as every other control on those screens does.
 */
export function useZoomParam<T>(key: string, parse: (text: string | null) => T | null, encode: (value: T) => string): [T | null, (next: T | null) => void] {
  const [params, setParams] = useSearchParams()
  const text = params.get(key)
  const value = useMemo(() => parse(text), [text]) // eslint-disable-line react-hooks/exhaustive-deps
  const write = useCallback(
    (next: T | null) =>
      setParams(
        (current) => {
          const p = new URLSearchParams(current)
          if (next == null) p.delete(key)
          else p.set(key, encode(next))
          return p
        },
        { replace: true, preventScrollReset: true },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams, key],
  )
  return [value, write]
}

/** The zoom buttons and the reset, in the toolbar style every chart shares. */
export function ZoomControls({
  view,
  axes,
  zoomTo,
  whole,
  deepest,
  label = 'Chart zoom',
  noun = 'chart',
  reset = 'Reset to all',
}: {
  view: ZoomDomain
  axes: ZoomAxes
  zoomTo: (next: ZoomDomain | null) => void
  whole: boolean
  deepest: boolean
  label?: string
  noun?: string
  reset?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      <button type="button" className="chip" onClick={() => zoomTo(zoomView(view, axes, 0.5, 0.5, ZOOM_STEP))} disabled={deepest} aria-label="Zoom in" title={`Zoom in. Or hold Ctrl or Command and scroll over the ${noun}, or pinch.`}>
        <ZoomIn size={13} aria-hidden="true" />
      </button>
      <button type="button" className="chip" onClick={() => zoomTo(zoomView(view, axes, 0.5, 0.5, 1 / ZOOM_STEP))} disabled={whole} aria-label="Zoom out" title="Zoom out">
        <ZoomOut size={13} aria-hidden="true" />
      </button>
      {!whole ? (
        <button type="button" className="chip chip-on" onClick={() => zoomTo(null)}>
          <RotateCcw size={13} aria-hidden="true" /> {reset}
        </button>
      ) : null}
    </div>
  )
}

type Gesture =
  | { kind: 'pan'; startX: number; startY: number; moved: boolean; next: ZoomDomain | null; cursor: string }
  | { kind: 'box'; startX: number; startY: number; moved: boolean; endX: number; endY: number; cursor: string }
  | { kind: 'wheel'; next: ZoomDomain }
  | null

export type ZoomLayers = {
  // Drawn in the chart's own pixels, so a layer takes the whole transform.
  svg?: RefObject<SVGGElement | null>[]
  // Drawn in the chart's pixels and moved along x only, such as labels that sit above the plot.
  svgX?: RefObject<SVGGElement | null>[]
  // HTML laid out from the corner of the plot rather than of the chart.
  html?: RefObject<HTMLElement | null>[]
}

/**
 * The gestures of a zoomable chart. The caller feeds pointer events in, with their place in the
 * chart's pixels, and each handler says whether the zoom took the event.
 */
export function useZoomGestures({
  axes,
  domain,
  box,
  onView,
  surface,
  layers,
  onStart,
  captureOnMove = false,
}: {
  axes: ZoomAxes
  domain: ZoomDomain
  box: ZoomBox
  // Given, the chart zooms. It takes each new view and how long to wait before writing the address.
  onView: ((next: ZoomDomain, delay?: number) => void) | null
  // The element whose wheel events zoom.
  surface: RefObject<SVGGraphicsElement | null>
  layers: ZoomLayers
  // A gesture has begun, so a tooltip can close.
  onStart?: () => void
  // Hold the pointer only once a drag has begun, so a plain click still reaches the mark under it.
  captureOnMove?: boolean
}) {
  const gesture = useRef<Gesture>(null)
  const boxRect = useRef<SVGRectElement>(null)
  const frame = useRef(0)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swallow = useRef(false)
  const layerRef = useRef(layers)
  layerRef.current = layers
  const startRef = useRef(onStart)
  startRef.current = onStart
  const zoomed = !sameView(domain, fullDomain(axes), axes)
  const domainKey = encodeView(domain, axes)
  const boxKey = `${box.left},${box.top},${box.width},${box.height}`
  const axesRef = useRef(axes)
  axesRef.current = axes
  const inBox = (px: number, py: number) => px >= box.left && px <= box.left + box.width && py >= box.top && py <= box.top + box.height

  // Move every drawn layer to where it sits in the next view, with one transform each and no render.
  const preview = useCallback(
    (next: ZoomDomain | null) => {
      const { svg = [], svgX = [], html = [] } = layerRef.current
      if (!next) {
        for (const r of [...svg, ...svgX]) r.current?.removeAttribute('transform')
        for (const r of html) if (r.current) r.current.style.transform = ''
        return
      }
      const { kx, ky, tx, ty } = viewTransform(domain, next, box, axesRef.current)
      for (const r of svg) r.current?.setAttribute('transform', `matrix(${kx},0,0,${ky},${tx},${ty})`)
      for (const r of svgX) r.current?.setAttribute('transform', `matrix(${kx},0,0,1,${tx},0)`)
      // HTML layers are laid out from the corner of the plot, not of the chart.
      const ox = kx * box.left + tx - box.left
      const oy = ky * box.top + ty - box.top
      for (const r of html) if (r.current) r.current.style.transform = `matrix(${kx},0,0,${ky},${ox},${oy})`
    },
    // The keys stand for the domain and the box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domainKey, boxKey],
  )
  // At most one preview a frame, of wherever the gesture has got to by then.
  const schedule = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const g = gesture.current
      const target = g?.kind === 'wheel' || g?.kind === 'pan' ? g.next : null
      if (target) preview(target)
    })
  }
  // A new view has been drawn, so the layers drop their stand-in transform before it is shown.
  useLayoutEffect(() => {
    preview(null)
  }, [preview])
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (settle.current) clearTimeout(settle.current)
      if (hintTimer.current) clearTimeout(hintTimer.current)
    },
    [],
  )
  const land = (next: ZoomDomain) => {
    if (!onView) return
    if (sameView(roundView(clampView(next, axes), axes), domain, axes)) preview(null)
    onView(next, ADDRESS_DELAY)
  }
  // The wheel zooms only with Ctrl or Command held, which is also how a trackpad pinch arrives,
  // so scrolling the page over the chart still scrolls the page.
  useEffect(() => {
    const el = surface.current
    if (!el || !onView) return
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        if (!hint) setHint(true)
        if (hintTimer.current) clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => setHint(false), 1400)
        return
      }
      const rect = (el.ownerSVGElement ?? el).getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      if (!inBox(px, py)) return
      event.preventDefault()
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      const dy = event.deltaY * scale
      const factor = Math.exp(-dy * (Math.abs(dy) < 50 ? 0.01 : 0.002))
      const g = gesture.current
      const from = g?.kind === 'wheel' ? g.next : domain
      const next = zoomView(from, axes, (px - box.left) / box.width, 1 - (py - box.top) / box.height, factor)
      gesture.current = { kind: 'wheel', next }
      startRef.current?.()
      schedule()
      if (settle.current) clearTimeout(settle.current)
      settle.current = setTimeout(() => {
        settle.current = null
        const done = gesture.current
        gesture.current = null
        if (done?.kind === 'wheel') land(done.next)
      }, SETTLE_DELAY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  /** Shift and a drag draws a box to zoom to. A plain drag pans, once the chart is zoomed in. */
  const down = (event: ReactPointerEvent<Element>, px: number, py: number): boolean => {
    swallow.current = false
    if (!onView || event.button > 0 || !inBox(px, py)) return false
    if (event.shiftKey) gesture.current = { kind: 'box', startX: px, startY: py, moved: false, endX: px, endY: py, cursor: '' }
    else if (zoomed) gesture.current = { kind: 'pan', startX: px, startY: py, moved: false, next: null, cursor: '' }
    else return false
    if (!captureOnMove) event.currentTarget.setPointerCapture(event.pointerId)
    return true
  }
  const move = (event: ReactPointerEvent<Element>, px: number, py: number): boolean => {
    const g = gesture.current
    if (!g || g.kind === 'wheel') return false
    const target = event.currentTarget as HTMLElement | SVGElement
    if (!g.moved && Math.hypot(px - g.startX, py - g.startY) > 4) {
      g.moved = true
      startRef.current?.()
      g.cursor = target.style.cursor
      target.style.cursor = g.kind === 'pan' ? 'grabbing' : 'crosshair'
      if (captureOnMove) target.setPointerCapture(event.pointerId)
    }
    if (!g.moved) return true
    if (g.kind === 'pan') {
      g.next = panView(domain, axes, (px - g.startX) / box.width, (py - g.startY) / box.height)
      schedule()
      return true
    }
    g.endX = Math.min(box.left + box.width, Math.max(box.left, px))
    g.endY = Math.min(box.top + box.height, Math.max(box.top, py))
    const r = boxRect.current
    if (r) {
      // Along a locked axis the box always spans the whole plot.
      const x0 = axes.x.locked ? box.left : Math.min(g.startX, g.endX)
      const w = axes.x.locked ? box.width : Math.abs(g.endX - g.startX)
      const y0 = axes.y.locked ? box.top : Math.min(g.startY, g.endY)
      const h = axes.y.locked ? box.height : Math.abs(g.endY - g.startY)
      r.setAttribute('x', String(x0))
      r.setAttribute('y', String(y0))
      r.setAttribute('width', String(w))
      r.setAttribute('height', String(h))
      r.setAttribute('visibility', 'visible')
    }
    return true
  }
  /** Ends a drag. True when the drag had moved, so the click it ends opens nothing. */
  const end = (event: ReactPointerEvent<Element>): boolean => {
    const g = gesture.current
    if (!g || g.kind === 'wheel') return false
    gesture.current = null
    const target = event.currentTarget as HTMLElement | SVGElement
    if (g.moved) target.style.cursor = g.cursor
    if (g.kind === 'box') boxRect.current?.setAttribute('visibility', 'hidden')
    if (!g.moved) return false
    swallow.current = true
    if (g.kind === 'pan') {
      if (g.next) land(g.next)
      return true
    }
    const wide = axes.x.locked || Math.abs(g.endX - g.startX) > 6
    const tall = axes.y.locked || Math.abs(g.endY - g.startY) > 6
    if (wide && tall && !(axes.x.locked && axes.y.locked)) {
      land(boxView(domain, axes, box, { x: g.startX, y: g.startY }, { x: g.endX, y: g.endY }))
    }
    return true
  }
  const cancel = (event: ReactPointerEvent<Element>) => {
    end(event)
    preview(null)
  }
  // The click that ends a drag opens nothing.
  const clickCapture = (event: ReactMouseEvent<Element>) => {
    if (!swallow.current) return
    swallow.current = false
    event.stopPropagation()
    event.preventDefault()
  }
  return { boxRect, hint, zoomed, down, move, end, cancel, clickCapture, preview }
}

export function ZoomBoxRect({ boxRect }: { boxRect: RefObject<SVGRectElement | null> }) {
  return <rect ref={boxRect} visibility="hidden" pointerEvents="none" fill="var(--ember)" fillOpacity={0.08} stroke="var(--ember)" strokeDasharray="4 3" />
}

export function ZoomHint({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="card card-solid pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-[13px]" role="status">
      {ZOOM_HINT}
    </div>
  )
}

// ---- a whole zoomable chart -------------------------------------------------

export type ZoomView = {
  size: FrameSize
  box: ZoomBox
  domain: ZoomDomain
  x: (v: number) => number
  y: (v: number) => number
  // How many times the view is magnified, for marks that spread apart as it grows.
  zoom: number
  zoomed: boolean
  inX: (v: number) => boolean
  inY: (v: number) => boolean
}

/**
 * A chart with two continuous axes that zooms like the Atmosphere Map. Its parts are drawn in
 * layers: `labels` stay put and are laid out again when a zoom rests, `grid` and `children` move
 * with the plot and are clipped to it, and `band` moves along x only and may reach above the plot.
 */
export function ZoomChart({
  title,
  description,
  aspect,
  minHeight,
  maxHeight,
  footer,
  axes,
  zoom,
  onZoom,
  reset,
  layout,
  labels,
  grid,
  band,
  children,
}: {
  title: string
  description: string
  aspect?: number
  minHeight?: number
  maxHeight?: number
  footer?: ReactNode
  axes: ZoomAxes
  // A zoom from the address, with onZoom to write it back. Without them the zoom is the chart's own.
  zoom?: ZoomDomain | null
  onZoom?: (next: ZoomDomain | null) => void
  reset?: string
  layout: (size: FrameSize, domain: ZoomDomain) => ZoomBox
  labels: (v: ZoomView) => ReactNode
  grid?: (v: ZoomView) => ReactNode
  band?: (v: ZoomView) => ReactNode
  children: (v: ZoomView) => ReactNode
}) {
  const state = useZoomState({ axes, base: zoom, onZoom })
  const controls = <ZoomControls axes={axes} reset={reset} {...state} />
  return (
    <ChartFrame title={title} description={description} aspect={aspect} minHeight={minHeight} maxHeight={maxHeight} toolbar={controls} footer={footer}>
      {(size) => (
        <ZoomPlot size={size} axes={axes} domain={state.view} onView={state.zoomTo} layout={layout} labels={labels} grid={grid} band={band}>
          {children}
        </ZoomPlot>
      )}
    </ChartFrame>
  )
}

function ZoomPlot({
  size,
  axes,
  domain,
  onView,
  layout,
  labels,
  grid,
  band,
  children,
}: {
  size: FrameSize
  axes: ZoomAxes
  domain: ZoomDomain
  onView: (next: ZoomDomain, delay?: number) => void
  layout: (size: FrameSize, domain: ZoomDomain) => ZoomBox
  labels: (v: ZoomView) => ReactNode
  grid?: (v: ZoomView) => ReactNode
  band?: (v: ZoomView) => ReactNode
  children: (v: ZoomView) => ReactNode
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const surface = useRef<SVGSVGElement>(null)
  const back = useRef<SVGGElement>(null)
  const front = useRef<SVGGElement>(null)
  const across = useRef<SVGGElement>(null)
  const box = layout(size, domain)
  const gestures = useZoomGestures({ axes, domain, box, onView, surface, layers: { svg: [back, front], svgX: [across] }, captureOnMove: true })
  const s = viewScales(box, domain, axes)
  const lo = (r: [number, number]) => Math.min(r[0], r[1]) - 1e-9
  const hi = (r: [number, number]) => Math.max(r[0], r[1]) + 1e-9
  const view: ZoomView = {
    size,
    box,
    domain,
    x: s.x,
    y: s.y,
    zoom: magnification(domain, axes),
    zoomed: gestures.zoomed,
    inX: (v) => v >= lo(domain.x) && v <= hi(domain.x),
    inY: (v) => v >= lo(domain.y) && v <= hi(domain.y),
  }
  const local = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { px: event.clientX - rect.left, py: event.clientY - rect.top }
  }
  return (
    <>
      <svg
        ref={surface}
        width={size.width}
        height={size.height}
        className="absolute inset-0 select-none"
        style={{ touchAction: 'manipulation', cursor: gestures.zoomed ? 'grab' : undefined }}
        onPointerDown={(event) => {
          const { px, py } = local(event)
          gestures.down(event, px, py)
        }}
        onPointerMove={(event) => {
          const { px, py } = local(event)
          gestures.move(event, px, py)
        }}
        onPointerUp={(event) => {
          gestures.end(event)
        }}
        onPointerCancel={gestures.cancel}
        onClickCapture={gestures.clickCapture}
      >
        <defs>
          <clipPath id={`${id}-plot`}>
            <rect x={box.left} y={box.top} width={box.width} height={box.height} />
          </clipPath>
          <clipPath id={`${id}-cols`}>
            <rect x={box.left} y={0} width={box.width} height={size.height} />
          </clipPath>
        </defs>
        {labels(view)}
        {grid ? (
          <g clipPath={`url(#${id}-plot)`}>
            <g ref={back}>{grid(view)}</g>
          </g>
        ) : null}
        {band ? (
          <g clipPath={`url(#${id}-cols)`}>
            <g ref={across}>{band(view)}</g>
          </g>
        ) : null}
        <g clipPath={`url(#${id}-plot)`}>
          <g ref={front}>{children(view)}</g>
        </g>
        <ZoomBoxRect boxRect={gestures.boxRect} />
      </svg>
      <ZoomHint show={gestures.hint} />
    </>
  )
}
