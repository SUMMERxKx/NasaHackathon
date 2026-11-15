// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Atmosphere Map. Every test is a mark on oxygen against pressure, beside the habitat.
// Given onZoom it zooms with the zoom every chart shares (zoom.tsx): Ctrl or Command with the
// wheel, or a trackpad pinch, zooms around the pointer, a drag pans a zoomed map, Shift and a drag
// zooms to a box, and the zoom buttons and the reset sit in the map's toolbar. A gesture moves the
// drawn layers by one transform and the marks are laid out again only once it rests.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import type { DrillPath, Habitat, Scenario, Test } from '../types.ts'
import { fieldGroups, overallFromGroups } from '../lib/field.ts'
import {
  MAP_DOMAIN,
  STACK_RADIUS,
  encodeZoom,
  fromView,
  layoutMap,
  mapAxes,
  mapScales,
  markPath,
  markPathAt,
  normoxicPoints,
  oxygenTicks,
  plottable,
  pointGroups,
  pressureTicks,
  ringRadii,
  sameDomain,
  toView,
} from '../lib/mapLayout.ts'
import type { MapBox, MapDomain, MapMark, MapStack } from '../lib/mapLayout.ts'
import { inScope } from '../lib/mapScope.ts'
import type { ScopeStep } from '../lib/mapScope.ts'
import { MOON_REGION, moonCounts } from '../lib/regions.ts'
import { atmToPsi, formatNumber, formatPercent, psiToAtm } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useDrill, useScenario } from '../state/hooks.ts'
import { LIMITS, fromHabitat, matchPreset } from '../state/scenario.ts'
import { ChartFrame } from './ChartFrame.tsx'
import type { FrameSize } from './ChartFrame.tsx'
import { oxygenText, pressureText } from './DrillPanel.tsx'
import { drillProps, usePrefersReducedMotion } from './ui.tsx'
import { ZoomBoxRect, ZoomControls, ZoomHint, useZoomGestures, useZoomState } from './zoom.tsx'
import type { ZoomDomain } from '../lib/zoom.ts'

export const MOON_DOMAIN: MapDomain = { psi: [3, 17], o2Pct: [22, 100] }
const MAP_AXES = mapAxes()

type Hover =
  | { kind: 'mark'; mark: MapMark; x: number; y: number }
  | { kind: 'stack'; stack: MapStack; x: number; y: number }
  | { kind: 'preset'; habitat: Habitat; x: number; y: number }
  | null

let introPlayed = false

// The marks as ink only: one path for each investigation, fuel class and fill, so laying the map
// out again after a zoom touches a few dozen elements, not two thousand.
const MarkInk = memo(function MarkInk({
  marks,
  colorOf,
  radius,
  intro,
  order,
}: {
  marks: MapMark[]
  colorOf: ((mark: MapMark) => string) | null
  radius: number
  intro: boolean
  order: Record<string, number>
}) {
  const buckets = new Map<string, { accession: string; fuelClass: MapMark['fuelClass']; hollow: boolean; color: string; d: string[] }>()
  for (const mark of marks) {
    const key = `${mark.accession}|${mark.fuelClass}|${mark.hollow ? 1 : 0}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { accession: mark.accession, fuelClass: mark.fuelClass, hollow: mark.hollow, color: colorOf ? colorOf(mark) : `var(--fuel-${mark.fuelClass})`, d: [] }
      buckets.set(key, bucket)
    }
    bucket.d.push(markPathAt(mark.fuelClass, mark.x, mark.y, radius))
  }
  return (
    <g aria-hidden="true">
      {[...buckets].map(([key, b]) => {
        const cross = b.fuelClass === 'unknown'
        return (
          <path
            key={key}
            d={b.d.join('')}
            fill={b.hollow || cross ? 'var(--bg)' : b.color}
            fillOpacity={b.hollow ? 0.4 : cross ? 0 : 0.9}
            stroke={b.color}
            strokeWidth={b.hollow || cross ? 1.2 : 0.5}
            className={`mark ${intro ? 'mark-arrive' : ''}`}
            style={intro ? { animationDelay: `${order[b.accession] ?? 0}ms` } : undefined}
          />
        )
      })}
    </g>
  )
})

type Target = { key: string; path: DrillPath; label: string }

// What the keyboard and a screen reader reach: each test alone at its point and each stack, in the
// order the map draws them. They carry no geometry, so a zoom never redraws them. The ring that
// shows keyboard focus is drawn from the layout instead.
const MarkTargets = memo(function MarkTargets({ targets, open, onFocusKey }: { targets: Target[]; open: (path: DrillPath) => void; onFocusKey: (key: string | null) => void }) {
  return (
    <g>
      {targets.map((t) => (
        <g
          key={t.key}
          className="drillable"
          tabIndex={-1}
          data-nav=""
          {...drillProps(t.path, t.label, open)}
          onFocus={(event) => onFocusKey(event.currentTarget.matches(':focus-visible') ? t.key : null)}
          onBlur={() => onFocusKey(null)}
        />
      ))}
    </g>
  )
})

function CoverageField({ box, domain, size, tests, layerRef }: { box: MapBox; domain: MapDomain; size: FrameSize; tests: Test[]; layerRef: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { lookup } = useData()
  const groups = useMemo(() => fieldGroups(tests, lookup), [tests, lookup])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const cols = 96
    const rows = 60
    canvas.width = cols
    canvas.height = rows
    const context = canvas.getContext('2d')
    if (!context) return
    const { x, y } = mapScales({ left: 0, top: 0, width: cols, height: rows }, domain)
    const image = context.createImageData(cols, rows)
    const probe = document.createElement('span')
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--field').trim()
    document.body.appendChild(probe)
    const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [255, 179, 92]
    probe.remove()
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const psi = x.invert(c + 0.5)
        const o2 = y.invert(r + 0.5) / 100
        const score = overallFromGroups(groups, { o2, pressureAtm: psiToAtm(psi) })
        const i = (r * cols + c) * 4
        image.data[i] = rgb[0]
        image.data[i + 1] = rgb[1]
        image.data[i + 2] = rgb[2]
        image.data[i + 3] = Math.round(Math.min(1, score / 100) ** 1.3 * 150)
      }
    }
    context.putImageData(image, 0, 0)
  }, [groups, domain])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
      <div ref={layerRef} className="h-full w-full" style={{ transformOrigin: '0 0' }}>
        <canvas ref={ref} className="h-full w-full" style={{ filter: 'blur(6px)', opacity: size.width > 0 ? 1 : 0, transition: 'opacity var(--t-emphasis)' }} />
      </div>
    </div>
  )
}

export function AtmosphereMap({
  tests,
  scope = null,
  compact = false,
  colorOf,
  showField = false,
  zoomMoon = false,
  zoom = null,
  onZoom,
  showRegion = true,
  showRing = true,
  showPresets = true,
  dragRing = false,
  title,
  toolbar,
  footer,
}: {
  tests: Test[]
  // The map filter the tests were chosen by. Its Moon Base counts and every drill it opens keep to it.
  scope?: ScopeStep | null
  compact?: boolean
  colorOf?: (accession: string) => string
  showField?: boolean
  zoomMoon?: boolean
  // A zoom from the address. It wins over the Moon zoom.
  zoom?: MapDomain | null
  // Given, the map zooms, and reports each resting view here, or null for the whole map.
  onZoom?: (next: MapDomain | null) => void
  showRegion?: boolean
  showRing?: boolean
  showPresets?: boolean
  dragRing?: boolean
  title: string
  toolbar?: ReactNode
  footer?: ReactNode
}) {
  const data = useData()
  const plotted = useMemo(() => tests.filter(plottable), [tests])
  const solidHigh = useMemo(() => plotted.filter((t) => t.fuelClass === 'solid' && (t.o2 as number) >= 0.3).length, [plotted])
  const description = `${title}. ${plotted.length} tests plotted on oxygen against pressure. ${
    solidHigh === 0 ? 'No solid fuel test at or above 30 percent oxygen.' : `${solidHigh} solid fuel tests at or above 30 percent oxygen.`
  } Hollow marks rest on an assumed value.`

  // The view the map shows. It follows the address, and it moves first when the map is zoomed,
  // so the address is written once a gesture rests rather than on every step of it.
  const base = zoom ?? (zoomMoon ? MOON_DOMAIN : MAP_DOMAIN)
  const zoomState = useZoomState({ axes: MAP_AXES, base: toView(base), onZoom: onZoom ? (next) => onZoom(next ? fromView(next) : null) : undefined })
  const view = useMemo(() => fromView(zoomState.view), [zoomState.view])
  const zoomable = Boolean(onZoom)
  const controls = zoomable ? <ZoomControls axes={MAP_AXES} label="Map zoom" noun="map" reset="Reset to all tests" {...zoomState} /> : null
  const bar = controls ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {controls}
      {toolbar}
    </div>
  ) : (
    toolbar
  )
  return (
    <ChartFrame title={title} description={description} aspect={compact ? 0.62 : 0.72} minHeight={compact ? 220 : 320} maxHeight={compact ? 340 : 620} squareOnPhone={!compact} toolbar={bar} footer={footer}>
      {(size) => (
        <MapBody
          size={size}
          tests={plotted}
          allTests={data.tests}
          scope={scope}
          compact={compact}
          colorOf={colorOf}
          showField={showField}
          domain={view}
          onView={zoomable ? zoomState.zoomTo : null}
          showRegion={showRegion}
          showRing={showRing}
          showPresets={showPresets}
          dragRing={dragRing}
        />
      )}
    </ChartFrame>
  )
}

function MapBody({
  size,
  tests,
  allTests,
  scope,
  compact,
  colorOf,
  showField,
  domain,
  onView,
  showRegion,
  showRing,
  showPresets,
  dragRing,
}: {
  size: FrameSize
  tests: Test[]
  allTests: Test[]
  scope: ScopeStep | null
  compact: boolean
  colorOf?: (accession: string) => string
  showField: boolean
  domain: MapDomain
  onView: ((next: ZoomDomain, delay?: number) => void) | null
  showRegion: boolean
  showRing: boolean
  showPresets: boolean
  dragRing: boolean
}) {
  const { invByAcc, testById, habitats } = useData()
  const { scenario, setScenario } = useScenario()
  const { open: openPath } = useDrill()
  // Every drill the map opens is counted within its filter. A single test is just that test.
  // The function is read through a ref, so writing the address never redraws the marks.
  const opener = useRef({ openPath, scope })
  opener.current = { openPath, scope }
  const open = useCallback((path: DrillPath) => {
    const { openPath: go, scope: within } = opener.current
    go(within && path[0].kind !== 'test' ? [path[0], within, ...path.slice(1)] : path)
  }, [])
  const reduced = usePrefersReducedMotion()
  const [hover, setHoverState] = useState<Hover>(null)
  const [pinned, setPinned] = useState<Hover>(null)
  // The ring's place while it is dragged. It is kept outside React state and written straight to
  // the ring's style, so a pointer move costs no render at all.
  const dragPos = useRef<{ o2: number; pressurePsi: number } | null>(null)
  const ringEl = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  // The pointer moves many times a frame. The hover only changes when it lands on something new.
  const hoverKey = useRef('')
  const setHover = useCallback((next: Hover) => {
    const key = !next ? '' : next.kind === 'mark' ? `m${next.mark.testId}` : next.kind === 'stack' ? `s${next.stack.key}` : `p${next.habitat.id}`
    if (key === hoverKey.current) return
    hoverKey.current = key
    setHoverState(next)
  }, [])
  // While the ring is dragged it follows the pointer on its own. The rest of the page, which
  // reads the habitat from the address, catches up about six times a second.
  const commit = useRef<{ timer: ReturnType<typeof setTimeout> | null; next: Scenario | null }>({ timer: null, next: null })
  const flush = useCallback(() => {
    const pending = commit.current
    if (pending.timer) clearTimeout(pending.timer)
    pending.timer = null
    if (pending.next) setScenario(pending.next, { replace: true })
    pending.next = null
  }, [setScenario])
  useEffect(() => () => {
    if (commit.current.timer) clearTimeout(commit.current.timer)
  }, [])
  useEffect(() => {
    if (dragState.current) return
    dragPos.current = null
    setDragging(false)
  }, [scenario.o2, scenario.pressurePsi])
  const [intro] = useState(() => !introPlayed && !compact)
  useEffect(() => {
    if (!compact) introPlayed = true
  }, [compact])

  // The zoom switches at once. Gliding the axes meant laying out and redrawing every mark on
  // every frame, which was the heaviest thing the map did.
  const zoomMoon = sameDomain(domain, MOON_DOMAIN)
  const zoomed = !sameDomain(domain, MAP_DOMAIN)
  const [startKey] = useState(() => encodeZoom(domain))

  // A zoomed oxygen axis can carry decimals, so the plot moves right far enough for its labels to
  // clear the axis title.
  const yTicks = useMemo(() => oxygenTicks(domain), [domain])
  const labelChars = Math.max(...yTicks.map((t) => `${t}%`.length))
  const left = compact ? 38 : Math.max(50, Math.ceil(17 + labelChars * 6.6 + 6))
  const box: MapBox = useMemo(
    () =>
      compact
        ? { left, top: 8, width: Math.max(60, size.width - 46), height: Math.max(60, size.height - 36) }
        : { left, top: 14, width: Math.max(80, size.width - left - 14), height: Math.max(80, size.height - 60) },
    [compact, left, size.width, size.height],
  )
  const { x, y } = useMemo(() => mapScales(box, domain), [box, domain])
  const layout = useMemo(() => layoutMap(tests, box, domain), [tests, box, domain])
  // Zoomed in, only the marks in and near the view are drawn, so a deep zoom draws few marks.
  const drawn = useMemo(() => {
    if (!zoomed) return layout
    const mx = box.width / 2
    const my = box.height / 2
    const near = (px: number, py: number) => px >= box.left - mx && px <= box.left + box.width + mx && py >= box.top - my && py <= box.top + box.height + my
    return { marks: layout.marks.filter((m) => near(m.x, m.y)), stacks: layout.stacks.filter((s) => near(s.x, s.y)) }
  }, [layout, zoomed, box])
  const order = useMemo(() => {
    const accessions = [...new Set(tests.map((t) => t.accession))]
    return Object.fromEntries(accessions.map((a, i) => [a, Math.round((i / Math.max(1, accessions.length)) * 1000)]))
  }, [tests])
  const labelOf = useCallback(
    (testId: string) => {
      const t = testById.get(testId)
      if (!t) return testId
      return `${invByAcc[t.accession]?.displayName ?? t.accession} test ${t.label}, ${oxygenText(t)} oxygen, ${pressureText(t)}. Press Enter for its rows.`
    },
    [testById, invByAcc],
  )
  // The keyboard stops, built from the tests alone, so they stay put while the map zooms.
  const targets = useMemo<Target[]>(() => {
    const singles: Target[] = []
    const stacks: Target[] = []
    for (const [key, list] of pointGroups(tests)) {
      if (list.length === 1) {
        singles.push({ key: `m${list[0].id}`, path: [{ kind: 'test', id: list[0].id }], label: labelOf(list[0].id) })
        continue
      }
      const o2 = list[0].o2 as number
      const pressureAtm = list[0].pressureAtm as number
      stacks.push({
        key: `s${key}`,
        path: [{ kind: 'stack', o2, pressureAtm }],
        label: `A stack of ${list.length} tests at ${formatPercent(o2)} oxygen and ${formatNumber(atmToPsi(pressureAtm), 1)} psi. Press Enter for its rows.`,
      })
    }
    return [...singles, ...stacks]
  }, [tests, labelOf])
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const focusAt = useMemo(() => {
    if (!focusKey) return null
    if (focusKey.startsWith('m')) {
      const mark = layout.marks.find((m) => m.testId === focusKey.slice(1))
      return mark ? { x: mark.x, y: mark.y, r: 7 } : null
    }
    const stack = layout.stacks.find((st) => st.key === focusKey.slice(1))
    return stack ? { x: stack.x, y: stack.y, r: Math.max(12, stack.radius + 4) } : null
  }, [focusKey, layout])
  const markColor = useMemo(() => (colorOf ? (mark: MapMark) => colorOf(mark.accession) : null), [colorOf])

  const current = dragPos.current ?? scenario
  const ringX = x(current.pressurePsi)
  const ringY = y(current.o2 * 100)
  const { rx, ry } = ringRadii(box, domain)
  const ringTransform = (px: number, py: number): string => `translate3d(${(px - rx - box.left).toFixed(1)}px, ${(py - ry - box.top).toFixed(1)}px, 0)`
  const region = useMemo(() => {
    // Under a filter the Moon Base counts are the filter's own, as the region's drill will be.
    return moonCounts(scope ? allTests.filter((t) => inScope(t, invByAcc[t.accession], scope)) : allTests)
  }, [allTests, scope, invByAcc])
  const regionBox = {
    x: box.left,
    y: Math.max(box.top, y(domain.o2Pct[1])),
    w: Math.max(0, Math.min(box.left + box.width, x(MOON_REGION.maxPressurePsi)) - box.left),
    h: Math.max(0, Math.min(box.top + box.height, y(MOON_REGION.minO2 * 100)) - box.top),
  }
  const inBox = (px: number, py: number, pad = 0) => px >= box.left - pad && px <= box.left + box.width + pad && py >= box.top - pad && py <= box.top + box.height + pad
  const visible = (px: number, py: number) => inBox(px, py)

  const find = (px: number, py: number): Hover => {
    // Anything hidden past the edge of a zoomed view cannot be pointed at.
    if (zoomed && !inBox(px, py, 2)) return null
    for (const stack of drawn.stacks) {
      if (!stack.open && Math.hypot(stack.x - px, stack.y - py) <= 12) return { kind: 'stack', stack, x: stack.x, y: stack.y }
    }
    let best: MapMark | null = null
    let bestD = 12
    for (const mark of drawn.marks) {
      const d = Math.hypot(mark.x - px, mark.y - py)
      if (d < bestD) {
        bestD = d
        best = mark
      }
    }
    if (best) return { kind: 'mark', mark: best, x: best.x, y: best.y }
    // A preset marker is offered only where no test sits under the pointer.
    if (showPresets) {
      for (const h of habitats) {
        const hx = x(h.pressurePsi)
        const hy = y(h.o2 * 100)
        if (Math.hypot(hx - px, hy - py) <= 9 && visible(hx, hy) && scenario.presetId !== h.id) return { kind: 'preset', habitat: h, x: hx, y: hy }
      }
    }
    return null
  }

  const local = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    return { px: event.clientX - (rect?.left ?? 0), py: event.clientY - (rect?.top ?? 0) }
  }
  const onRing = (px: number, py: number) => showRing && ((px - ringX) / rx) ** 2 + ((py - ringY) / ry) ** 2 <= 1
  const pathFor = (hit: Hover): DrillPath | null => {
    if (!hit) return null
    if (hit.kind === 'mark') return [{ kind: 'test', id: hit.mark.testId }]
    if (hit.kind === 'stack') return [{ kind: 'stack', o2: hit.stack.o2, pressureAtm: hit.stack.pressureAtm }]
    return null
  }

  // ---- zoom gestures --------------------------------------------------------
  const dataLayer = useRef<HTMLDivElement>(null)
  const labelLayer = useRef<SVGGElement>(null)
  const ringLayer = useRef<HTMLDivElement>(null)
  const fieldLayer = useRef<HTMLDivElement>(null)
  const surface = useRef<SVGRectElement>(null)
  const zoomGestures = useZoomGestures({
    axes: MAP_AXES,
    domain: toView(domain),
    box,
    onView,
    surface,
    layers: { svg: [labelLayer], html: [dataLayer, ringLayer, fieldLayer] },
    onStart: () => setHover(null),
  })

  const onMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const { px, py } = local(event)
    if (zoomGestures.move(event, px, py)) return
    if (dragState.current) {
      if (Math.hypot(px - dragState.current.startX, py - dragState.current.startY) > 4) dragState.current.moved = true
      if (dragState.current.moved) {
        const o2 = Math.min(LIMITS.o2[1], Math.max(LIMITS.o2[0], y.invert(py) / 100))
        const pressurePsi = Math.min(LIMITS.pressurePsi[1], Math.max(LIMITS.pressurePsi[0], x.invert(px)))
        const next = { o2: Math.round(o2 * 200) / 200, pressurePsi: Math.round(pressurePsi * 10) / 10 }
        dragPos.current = next
        if (!dragging) setDragging(true)
        if (ringEl.current) ringEl.current.style.transform = ringTransform(x(next.pressurePsi), y(next.o2 * 100))
        const merged: Scenario = { ...scenario, ...next, presetId: null }
        commit.current.next = { ...merged, presetId: matchPreset(merged, habitats)?.id ?? null }
        if (!commit.current.timer) commit.current.timer = setTimeout(flush, 160)
      }
      return
    }
    if (event.pointerType !== 'touch') setHover(find(px, py))
  }
  const onDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const { px, py } = local(event)
    // The centre of the ring is a handle. It can be grabbed even where tests sit under it.
    const onHandle = showRing && Math.hypot(px - ringX, py - ringY) <= 12
    if (dragRing && (onHandle || (onRing(px, py) && !find(px, py)))) {
      dragState.current = { startX: px, startY: py, moved: false }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    // Shift and a drag draws a box to zoom to. A plain drag pans, once the map is zoomed in.
    zoomGestures.down(event, px, py)
  }
  const onUp = (event: ReactPointerEvent<SVGRectElement>) => {
    if (zoomGestures.end(event)) return
    const { px, py } = local(event)
    const wasDrag = dragState.current?.moved
    const grabbed = dragState.current != null
    dragState.current = null
    // The ring holds its place until the address has caught up, so it never slides back.
    const pending = commit.current.next != null
    flush()
    if (!pending) {
      dragPos.current = null
      setDragging(false)
    }
    if (wasDrag) return
    if (grabbed && showRing && Math.hypot(px - ringX, py - ringY) <= 12) return open([{ kind: 'near', o2: scenario.o2, pressureAtm: psiToAtm(scenario.pressurePsi) }])
    const hit = find(px, py)
    if (event.pointerType === 'touch' && hit && hit.kind !== 'preset') {
      setPinned(hit)
      return
    }
    setPinned(null)
    if (hit?.kind === 'preset') {
      setScenario(fromHabitat(hit.habitat, scenario.focus, scenario.flowCmS))
      return
    }
    const path = pathFor(hit)
    if (path) return open(path)
    if (!inBox(px, py)) return
    const inRegion = showRegion && px <= regionBox.x + regionBox.w && py <= regionBox.y + regionBox.h
    if (onRing(px, py)) return open([{ kind: 'near', o2: scenario.o2, pressureAtm: psiToAtm(scenario.pressurePsi) }])
    if (inRegion) return open([{ kind: 'region', id: 'moon' }])
    if (!compact) open([{ kind: 'near', o2: Math.round(y.invert(py) * 10) / 1000, pressureAtm: Math.round(psiToAtm(x.invert(px)) * 1000) / 1000 }])
  }

  const tip = hover ?? null
  const tipTest = tip?.kind === 'mark' ? testById.get(tip.mark.testId) : null
  const pinTest = pinned?.kind === 'mark' ? testById.get(pinned.mark.testId) : null
  const narrow = size.width < 480
  const xTicks = pressureTicks(domain, narrow)
  const curve = normoxicPoints(domain)
  const curvePath = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.psi).toFixed(1)},${y(p.o2Pct).toFixed(1)}`).join('')
  const curveLabel = curve.find((p) => p.o2Pct <= 72) ?? curve[Math.floor(curve.length * 0.3)]
  // Presets that share a point, such as the Exploration atmosphere and the Mars habitat, share one label.
  const presetGroups = useMemo(() => {
    const short: Record<string, string> = { iss: 'ISS cabin', 'shuttle-eva': 'Shuttle EVA prep', exploration: 'Exploration', 'moon-bound': 'Moon Base bound', mars: 'Mars habitat', suit: 'Spacesuit' }
    const groups = new Map<string, { ids: string[]; o2: number; pressurePsi: number; label: string }>()
    for (const h of habitats) {
      const key = `${h.o2}|${h.pressurePsi}`
      const entry = groups.get(key)
      if (entry) {
        entry.ids.push(h.id)
        entry.label = `${entry.label} and ${short[h.id] ?? h.name}`
      } else groups.set(key, { ids: [h.id], o2: h.o2, pressurePsi: h.pressurePsi, label: short[h.id] ?? h.name })
    }
    return [...groups.values()]
  }, [habitats])
  const fontSize = compact ? 10 : 11

  return (
    <>
      {showField ? <CoverageField box={box} domain={domain} size={size} tests={tests} layerRef={fieldLayer} /> : null}
      {/* The axes and their labels. They are laid out again when a zoom rests. */}
      <svg width={size.width} height={size.height} className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        <rect x={box.left} y={box.top} width={box.width} height={box.height} fill="none" stroke="var(--line)" />
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={box.top + box.height + 14} textAnchor="middle" fontSize={fontSize} fill="var(--muted)" className="num">
            {t}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`y${t}`} x={box.left - 6} y={y(t) + 4} textAnchor="end" fontSize={fontSize} fill="var(--muted)" className="num">
            {t}%
          </text>
        ))}
        {!compact ? (
          <>
            <text x={box.left + box.width / 2} y={size.height - 6} textAnchor="middle" fontSize={12} fill="var(--muted)">
              Pressure, psi (log scale)
            </text>
            <text transform={`translate(12,${box.top + box.height / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--muted)">
              Oxygen
            </text>
          </>
        ) : null}
      </svg>
      {/* The grid and the marks, clipped to the plot. On a zoomable map this is a layer of its own,
          so a zoom or pan gesture moves it on the compositor and never repaints the marks. */}
      <div className="pointer-events-none absolute overflow-hidden" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
        <div ref={dataLayer} className="absolute inset-0" style={{ transformOrigin: '0 0', willChange: onView ? 'transform' : undefined }}>
          <svg width={size.width} height={size.height} className="absolute select-none" style={{ left: -box.left, top: -box.top }}>
            <defs>
              <pattern id="region-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--gap)" strokeWidth="1" opacity="0.22" />
              </pattern>
            </defs>
            <g aria-hidden="true">
              {xTicks.map((t) => (
                <line key={`x${t}`} x1={x(t)} x2={x(t)} y1={box.top} y2={box.top + box.height} stroke="var(--line)" strokeOpacity={0.6} />
              ))}
              {yTicks.map((t) => (
                <line key={`y${t}`} x1={box.left} x2={box.left + box.width} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.6} />
              ))}
            </g>
              {showRegion && regionBox.w > 0 && regionBox.h > 0 ? (
                <g aria-hidden="true">
                  <rect x={regionBox.x} y={regionBox.y} width={regionBox.w} height={regionBox.h} fill="var(--bg)" fillOpacity={0.55} />
                  <rect x={regionBox.x} y={regionBox.y} width={regionBox.w} height={regionBox.h} fill="url(#region-hatch)" stroke="var(--gap)" strokeDasharray="5 4" strokeWidth={1.2} />
                </g>
              ) : null}
              {curvePath ? (
                <g aria-hidden="true">
                  <title>A reference line, not data. It has no rows behind it.</title>
                  <path d={curvePath} fill="none" stroke="var(--freefall)" strokeWidth={1.5} strokeDasharray="2 4" />
                  {!compact && !narrow && curveLabel ? (
                    <text x={x(curveLabel.psi) + 8} y={y(curveLabel.o2Pct) - 6} fontSize={11} fill="var(--freefall)">
                      same oxygen for breathing as sea level
                    </text>
                  ) : null}
                </g>
              ) : null}
              <MarkInk marks={drawn.marks} colorOf={markColor} radius={compact ? 2.6 : 3.2} intro={intro && !reduced && encodeZoom(domain) === startKey} order={order} />
              <MarkTargets targets={targets} open={open} onFocusKey={setFocusKey} />
              {focusAt ? <circle cx={focusAt.x} cy={focusAt.y} r={focusAt.r} fill="none" stroke="var(--freefall)" strokeWidth={2} pointerEvents="none" /> : null}
              {drawn.stacks
                .filter((s) => s.badge && (!narrow || s.count >= 100))
                .map((stack) => {
                  const accessions = Object.keys(stack.byAccession)
                  const text = `${stack.count} ${accessions.length === 1 ? (invByAcc[accessions[0]]?.displayName ?? '') : 'tests'}`
                  // An opened stack keeps its label just outside its marks.
                  const offset = stack.radius <= STACK_RADIUS ? 14 : stack.radius * 0.72 + 6
                  return (
                    <g key={`b${stack.key}`} transform={`translate(${stack.x + offset},${stack.y - offset})`} aria-hidden="true" pointerEvents="none">
                      <rect x={0} y={-11} width={text.length * 6.6 + 12} height={18} fill="var(--surface-2)" stroke="var(--line)" />
                      <text x={6} y={2} fontSize={11} fill="var(--ink)" className="num">
                        {text}
                      </text>
                    </g>
                  )
                })}
          </svg>
        </div>
      </div>
      <svg width={size.width} height={size.height} className="absolute inset-0 select-none" style={{ touchAction: dragRing ? 'none' : 'manipulation' }}>
        <rect
          ref={surface}
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill="transparent"
          style={{ cursor: hover ? 'pointer' : zoomed && onView ? 'grab' : dragRing && showRing ? 'crosshair' : 'default' }}
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={zoomGestures.cancel}
          onPointerLeave={() => setHover(null)}
        />
        {onView ? <ZoomBoxRect boxRect={zoomGestures.boxRect} /> : null}
        <g ref={labelLayer}>
        {/* The habitat presets sit above the clipped marks, so a label at the edge of the plot is
            never cut. Only presets inside the view are drawn. */}
        {showPresets
          ? presetGroups.map((group) => {
              const hx = x(group.pressurePsi)
              const hy = y(group.o2 * 100)
              if (!inBox(hx, hy, 1)) return null
              const active = group.ids.includes(scenario.presetId ?? '')
              // The label sits beside its marker, on the side with room for it.
              const width = group.label.length * 6.4
              const left = group.pressurePsi > 5 ? hx - 10 - width >= box.left : hx + 10 + width > box.left + box.width
              // At the top edge the label goes just above the frame. Near the bottom it stays inside.
              const ly = hy - box.top < 10 ? box.top - 3 - hy : Math.min(4, box.top + box.height - 3 - hy)
              return (
                <g key={group.ids.join('+')} transform={`translate(${hx},${hy})`} aria-hidden="true" pointerEvents="none" opacity={active ? 1 : 0.85}>
                  <path d="M0,-6L6,0L0,6L-6,0Z" fill={active ? 'var(--habitat)' : 'var(--bg)'} stroke="var(--habitat)" strokeWidth={1.5} />
                  {!compact && (!narrow || active) ? (
                    <text x={left ? -10 : 10} y={ly} textAnchor={left ? 'end' : 'start'} fontSize={11} fill="var(--habitat)" fontWeight={600} stroke="var(--bg)" strokeWidth={3} paintOrder="stroke">
                      {group.label}
                    </text>
                  ) : null}
                </g>
              )
            })
          : null}
        {showRegion && regionBox.w > 60 && regionBox.h > 40 ? (
          <g
            className="drillable"
            tabIndex={-1}
            data-nav=""
            transform={`translate(${regionBox.x + 8},${regionBox.y + 8})`}
            {...drillProps(
              [{ kind: 'region', id: 'moon' }],
              compact ? 'Moon Base region. Press Enter for its rows.' : `Moon Base region ${region.solid} solid, ${region.liquid} liquid, ${region.gas} gas ${region.edge} droplet tests on the edge. Press Enter for its rows.`,
              open,
            )}
          >
            <rect width={compact ? 132 : zoomMoon && !narrow ? 250 : 196} height={compact ? 22 : zoomMoon && !narrow ? 66 : 50} fill="var(--surface)" stroke="var(--gap)" fillOpacity={0.94} />
            {compact ? (
              <text x={8} y={15} fontSize={11} fill="var(--ink)">
                Moon Base region
              </text>
            ) : (
              <>
                <text x={10} y={zoomMoon && !narrow ? 16 : 15} fontSize={10} fill="var(--gap)" fontWeight={700} letterSpacing="0.08em">
                  MOON BASE REGION
                </text>
                <text x={10} y={zoomMoon && !narrow ? 40 : 31} fontSize={zoomMoon && !narrow ? 20 : 13} fill="var(--ink)" fontWeight={600} className="num">
                  {region.solid} solid, {region.liquid} liquid, {region.gas} gas
                </text>
                <text x={10} y={zoomMoon && !narrow ? 57 : 44} fontSize={11} fill="var(--muted)">
                  {region.edge} droplet tests on the edge
                </text>
              </>
            )}
          </g>
        ) : null}
        </g>
        {showRing ? (
          <g
            className="drillable"
            tabIndex={-1}
            data-nav=""
            {...drillProps(
              [{ kind: 'near', o2: scenario.o2, pressureAtm: psiToAtm(scenario.pressurePsi) }],
              `The habitat ring at ${formatPercent(scenario.o2)} oxygen and ${formatNumber(scenario.pressurePsi, 1)} psi. Press Enter for the tests within one unit.`,
              open,
            )}
          >
            <circle cx={ringX} cy={ringY} r={1} fill="transparent" />
          </g>
        ) : null}
      </svg>
      {/* The ring is its own layer above the marks. It moves by transform alone, so dragging it or
          switching habitat never repaints the two thousand marks under it. */}
      {showRing ? (
        <div aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          <div ref={ringLayer} className="absolute inset-0" style={{ transformOrigin: '0 0' }}>
          <div ref={ringEl} className="map-ring" style={{ width: rx * 2, height: ry * 2, transform: ringTransform(ringX, ringY), transition: dragging || reduced ? 'none' : 'transform var(--t-scene) var(--ease-in-out)' }}>
            <span className="map-ring-dot" style={{ width: dragRing ? 9 : 5, height: dragRing ? 9 : 5 }} />
          </div>
          </div>
        </div>
      ) : null}
      <ZoomHint show={zoomGestures.hint} />
      {tip ? (
        <div
          className="card card-solid pointer-events-none absolute z-10 max-w-[260px] px-3 py-2 text-[12px]"
          style={{ left: Math.min(size.width - 270, Math.max(4, tip.x + 14)), top: Math.max(4, tip.y - 12) }}
          role="tooltip"
        >
          <MapTip hit={tip} test={tipTest ?? null} />
        </div>
      ) : null}
      {pinned ? (
        <div className="card card-solid absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
          <div>
            <MapTip hit={pinned} test={pinTest ?? null} />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            onClick={() => {
              const path = pathFor(pinned)
              setPinned(null)
              if (path) open(path)
            }}
          >
            Open rows
          </button>
        </div>
      ) : null}
    </>
  )
}

function MapTip({ hit, test }: { hit: NonNullable<Hover>; test: Test | null }) {
  const { invByAcc } = useData()
  if (hit.kind === 'preset') {
    return (
      <>
        <p className="font-semibold">{hit.habitat.name}</p>
        <p className="num text-muted">
          {formatPercent(hit.habitat.o2)} oxygen, {formatNumber(hit.habitat.pressurePsi, 1)} psi
        </p>
        <p className="text-muted">Click to switch to this habitat.</p>
      </>
    )
  }
  if (hit.kind === 'stack') {
    const rows = Object.entries(hit.stack.byAccession).sort((a, b) => b[1] - a[1])
    return (
      <>
        <p className="font-semibold">
          {hit.stack.count} tests at {formatPercent(hit.stack.o2)} oxygen, {formatNumber(atmToPsi(hit.stack.pressureAtm), 1)} psi
        </p>
        <ul className="m-0 list-none p-0 text-muted">
          {rows.slice(0, 6).map(([accession, count]) => (
            <li key={accession} className="flex justify-between gap-4">
              <span>{invByAcc[accession]?.displayName ?? accession}</span>
              <span className="num">{count}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted">Click for its rows.</p>
      </>
    )
  }
  if (!test) return null
  return (
    <>
      <p className="font-semibold">
        {invByAcc[test.accession]?.displayName ?? test.accession} <span className="num font-normal text-muted">test {test.label}</span>
      </p>
      <p className="text-muted">{test.fuel ?? 'fuel not stated'}</p>
      <p className="num">
        {oxygenText(test)} oxygen, {pressureText(test)}
      </p>
      <p className="text-muted">Click for the NASA row.</p>
    </>
  )
}

export function MapLegend({ compact = false }: { compact?: boolean }) {
  const items: { id: Test['fuelClass']; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'liquid', label: 'Liquid' },
    { id: 'gas', label: 'Gas' },
    { id: 'aerosol', label: 'Smoke and aerosol' },
  ]
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-muted" aria-label="Legend">
      {items.map((item) => (
        <li key={item.id} className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
            <path d={markPath(item.id, 4)} fill={`var(--fuel-${item.id})`} />
          </svg>
          {item.label}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
          <circle r="4" fill="none" stroke="var(--muted)" strokeWidth="1.3" />
        </svg>
        Hollow means assumed
      </li>
      {!compact ? (
        <>
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
              <path d="M0,-5L5,0L0,5L-5,0Z" fill="none" stroke="var(--habitat)" strokeWidth="1.5" />
            </svg>
            Habitat preset
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="16" height="12" viewBox="-8 -6 16 12" aria-hidden="true">
              <ellipse rx="7" ry="4.5" fill="none" stroke="var(--habitat)" strokeWidth="1.5" />
            </svg>
            One unit of distance from your habitat
          </li>
        </>
      ) : null}
    </ul>
  )
}
