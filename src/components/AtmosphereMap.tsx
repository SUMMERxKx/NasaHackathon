// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Atmosphere Map. Every test is a mark on oxygen against pressure, beside the habitat.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { DrillPath, Habitat, Scenario, Test } from '../types.ts'
import { fieldGroups, overallFromGroups } from '../lib/field.ts'
import {
  MAP_DOMAIN,
  OXYGEN_TICKS,
  PRESSURE_TICKS,
  layoutMap,
  mapScales,
  markPath,
  normoxicPoints,
  plottable,
  ringRadii,
} from '../lib/mapLayout.ts'
import type { MapBox, MapDomain, MapMark, MapStack } from '../lib/mapLayout.ts'
import { MOON_REGION, inMoonRegion, onMoonEdge } from '../lib/regions.ts'
import { countBy } from '../lib/stats.ts'
import { atmToPsi, formatNumber, formatPercent, psiToAtm } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useDrill, useScenario } from '../state/hooks.ts'
import { LIMITS, fromHabitat, matchPreset } from '../state/scenario.ts'
import { ChartFrame } from './ChartFrame.tsx'
import type { FrameSize } from './ChartFrame.tsx'
import { oxygenText, pressureText } from './DrillPanel.tsx'
import { drillProps, usePrefersReducedMotion, useThemeVersion } from './ui.tsx'

export const MOON_DOMAIN: MapDomain = { psi: [3, 17], o2Pct: [22, 100] }

type Hover =
  | { kind: 'mark'; mark: MapMark; x: number; y: number }
  | { kind: 'stack'; stack: MapStack; x: number; y: number }
  | { kind: 'preset'; habitat: Habitat; x: number; y: number }
  | null

let introPlayed = false

const TestDots = memo(function TestDots({
  marks,
  stacks,
  dimmed,
  colorOf,
  radius,
  labelOf,
  open,
  intro,
  order,
}: {
  marks: MapMark[]
  stacks: MapStack[]
  dimmed: Set<string> | null
  colorOf: ((mark: MapMark) => string) | null
  radius: number
  labelOf: (testId: string) => string
  open: (path: DrillPath) => void
  intro: boolean
  order: Record<string, number>
}) {
  return (
    <g>
      {marks.map((mark) => {
        const color = colorOf ? colorOf(mark) : `var(--fuel-${mark.fuelClass})`
        const cross = mark.fuelClass === 'unknown'
        const single = mark.stackKey == null
        const path: DrillPath = [{ kind: 'test', id: mark.testId }]
        const interactive = single ? { tabIndex: -1, 'data-nav': '', ...drillProps(path, labelOf(mark.testId), open) } : { 'data-drill': `test.${mark.testId}` }
        return (
          <path
            key={mark.testId}
            d={markPath(mark.fuelClass, radius)}
            transform={`translate(${mark.x.toFixed(1)},${mark.y.toFixed(1)})`}
            fill={mark.hollow || cross ? 'var(--bg)' : color}
            fillOpacity={mark.hollow ? 0.4 : cross ? 0 : 0.9}
            stroke={color}
            strokeWidth={mark.hollow || cross ? 1.2 : 0.5}
            className={`mark ${single ? 'drillable' : ''} ${dimmed?.has(mark.testId) ? 'mark-dim' : ''} ${intro ? 'mark-arrive' : ''}`}
            style={intro ? { animationDelay: `${order[mark.accession] ?? 0}ms` } : undefined}
            {...interactive}
          />
        )
      })}
      {stacks.map((stack) => (
        <circle
          key={stack.key}
          cx={stack.x}
          cy={stack.y}
          r={12}
          fill="transparent"
          className="drillable"
          tabIndex={-1}
          data-nav=""
          {...drillProps(
            [{ kind: 'stack', o2: stack.o2, pressureAtm: stack.pressureAtm }],
            `A stack of ${stack.count} tests at ${formatPercent(stack.o2)} oxygen and ${formatNumber(atmToPsi(stack.pressureAtm), 1)} psi. Press Enter for its rows.`,
            open,
          )}
        />
      ))}
    </g>
  )
})

function CoverageField({ box, domain, size, tests }: { box: MapBox; domain: MapDomain; size: FrameSize; tests: Test[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { lookup } = useData()
  const theme = useThemeVersion()
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
  }, [groups, domain, theme])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute overflow-hidden" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
      <canvas ref={ref} className="h-full w-full" style={{ filter: 'blur(6px)', opacity: size.width > 0 ? 1 : 0, transition: 'opacity var(--t-emphasis)' }} />
    </div>
  )
}

export function AtmosphereMap({
  tests,
  dim,
  compact = false,
  colorOf,
  showField = false,
  zoomMoon = false,
  showRegion = true,
  showRing = true,
  showPresets = true,
  dragRing = false,
  title,
  toolbar,
  footer,
}: {
  tests: Test[]
  dim?: (t: Test) => boolean
  compact?: boolean
  colorOf?: (accession: string) => string
  showField?: boolean
  zoomMoon?: boolean
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
  return (
    <ChartFrame title={title} description={description} aspect={compact ? 0.62 : 0.72} minHeight={compact ? 220 : 320} maxHeight={compact ? 340 : 620} squareOnPhone={!compact} toolbar={toolbar} footer={footer}>
      {(size) => (
        <MapBody
          size={size}
          tests={plotted}
          allTests={data.tests}
          dim={dim}
          compact={compact}
          colorOf={colorOf}
          showField={showField}
          zoomMoon={zoomMoon}
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
  dim,
  compact,
  colorOf,
  showField,
  zoomMoon,
  showRegion,
  showRing,
  showPresets,
  dragRing,
}: {
  size: FrameSize
  tests: Test[]
  allTests: Test[]
  dim?: (t: Test) => boolean
  compact: boolean
  colorOf?: (accession: string) => string
  showField: boolean
  zoomMoon: boolean
  showRegion: boolean
  showRing: boolean
  showPresets: boolean
  dragRing: boolean
}) {
  const { invByAcc, testById, habitats } = useData()
  const { scenario, setScenario } = useScenario()
  const { open } = useDrill()
  const reduced = usePrefersReducedMotion()
  const [hover, setHoverState] = useState<Hover>(null)
  const [pinned, setPinned] = useState<Hover>(null)
  const [drag, setDrag] = useState<{ o2: number; pressurePsi: number } | null>(null)
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
    if (!dragState.current) setDrag(null)
  }, [scenario.o2, scenario.pressurePsi])
  const [intro] = useState(() => !introPlayed && !compact)
  useEffect(() => {
    if (!compact) introPlayed = true
  }, [compact])

  // The zoom switches at once. Gliding the axes meant laying out and redrawing every mark on
  // every frame, which was the heaviest thing the map did.
  const domain = zoomMoon ? MOON_DOMAIN : MAP_DOMAIN

  const box: MapBox = useMemo(
    () =>
      compact
        ? { left: 38, top: 8, width: Math.max(60, size.width - 46), height: Math.max(60, size.height - 36) }
        : { left: 50, top: 14, width: Math.max(80, size.width - 64), height: Math.max(80, size.height - 60) },
    [compact, size.width, size.height],
  )
  const { x, y } = useMemo(() => mapScales(box, domain), [box, domain])
  const layout = useMemo(() => layoutMap(tests, box, domain), [tests, box, domain])
  const dimmed = useMemo(() => (dim ? new Set(tests.filter(dim).map((t) => t.id)) : null), [tests, dim])
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
  const markColor = useMemo(() => (colorOf ? (mark: MapMark) => colorOf(mark.accession) : null), [colorOf])

  const current = drag ?? scenario
  const ringX = x(current.pressurePsi)
  const ringY = y(current.o2 * 100)
  const { rx, ry } = ringRadii(box, domain)
  const region = useMemo(() => {
    const inside = allTests.filter(inMoonRegion)
    const edge = allTests.filter((t) => onMoonEdge(t) && t.fuelClass === 'liquid')
    const c = countBy(inside, (t) => t.fuelClass)
    return { total: inside.length, solid: c.solid || 0, liquid: c.liquid || 0, gas: c.gas || 0, edge: edge.length }
  }, [allTests])
  const regionBox = {
    x: box.left,
    y: Math.max(box.top, y(domain.o2Pct[1])),
    w: Math.max(0, Math.min(box.left + box.width, x(MOON_REGION.maxPressurePsi)) - box.left),
    h: Math.max(0, Math.min(box.top + box.height, y(MOON_REGION.minO2 * 100)) - box.top),
  }
  const inBox = (px: number, py: number) => px >= box.left && px <= box.left + box.width && py >= box.top && py <= box.top + box.height
  const visible = (px: number, py: number) => inBox(px, py)

  const find = (px: number, py: number): Hover => {
    for (const stack of layout.stacks) {
      if (Math.hypot(stack.x - px, stack.y - py) <= 12) return { kind: 'stack', stack, x: stack.x, y: stack.y }
    }
    let best: MapMark | null = null
    let bestD = 12
    for (const mark of layout.marks) {
      if (dimmed?.has(mark.testId)) continue
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

  const onMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const { px, py } = local(event)
    if (dragState.current) {
      if (Math.hypot(px - dragState.current.startX, py - dragState.current.startY) > 4) dragState.current.moved = true
      if (dragState.current.moved) {
        const o2 = Math.min(LIMITS.o2[1], Math.max(LIMITS.o2[0], y.invert(py) / 100))
        const pressurePsi = Math.min(LIMITS.pressurePsi[1], Math.max(LIMITS.pressurePsi[0], x.invert(px)))
        const next = { o2: Math.round(o2 * 200) / 200, pressurePsi: Math.round(pressurePsi * 10) / 10 }
        setDrag(next)
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
    }
  }
  const onUp = (event: ReactPointerEvent<SVGRectElement>) => {
    const { px, py } = local(event)
    const wasDrag = dragState.current?.moved
    const grabbed = dragState.current != null
    dragState.current = null
    // The ring holds its place until the address has caught up, so it never slides back.
    const pending = commit.current.next != null
    flush()
    if (!pending) setDrag(null)
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
  const xTicks = PRESSURE_TICKS.filter((t) => t >= domain.psi[0] - 1e-6 && t <= domain.psi[1] + 1e-6 && (!narrow || [3, 8.2, 14.7, 30, 80].includes(t)))
  const yTicks = OXYGEN_TICKS.filter((t) => t >= domain.o2Pct[0] - 1e-6 && t <= domain.o2Pct[1] + 1e-6)
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
  const clipId = `map-clip-${compact ? 'c' : 'f'}`
  const fontSize = compact ? 10 : 11

  return (
    <>
      {showField ? <CoverageField box={box} domain={domain} size={size} tests={tests} /> : null}
      <svg width={size.width} height={size.height} className="absolute inset-0 select-none" style={{ touchAction: dragRing ? 'none' : 'manipulation' }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={box.left} y={box.top} width={box.width} height={box.height} />
          </clipPath>
          <pattern id="region-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--gap)" strokeWidth="1" opacity="0.22" />
          </pattern>
        </defs>
        <g aria-hidden="true">
          <rect x={box.left} y={box.top} width={box.width} height={box.height} fill="none" stroke="var(--line)" />
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={x(t)} x2={x(t)} y1={box.top} y2={box.top + box.height} stroke="var(--line)" strokeOpacity={0.6} />
              <text x={x(t)} y={box.top + box.height + 14} textAnchor="middle" fontSize={fontSize} fill="var(--muted)" className="num">
                {t}
              </text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={box.left} x2={box.left + box.width} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.6} />
              <text x={box.left - 6} y={y(t) + 4} textAnchor="end" fontSize={fontSize} fill="var(--muted)" className="num">
                {t}%
              </text>
            </g>
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
        </g>
        <g clipPath={`url(#${clipId})`}>
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
          <TestDots marks={layout.marks} stacks={layout.stacks} dimmed={dimmed} colorOf={markColor} radius={compact ? 2.6 : 3.2} labelOf={labelOf} open={open} intro={intro && !reduced} order={order} />
          {layout.stacks
            .filter((s) => s.badge && (!narrow || s.count >= 100))
            .map((stack) => {
              const accessions = Object.keys(stack.byAccession)
              const text = `${stack.count} ${accessions.length === 1 ? (invByAcc[accessions[0]]?.displayName ?? '') : 'tests'}`
              return (
                <g key={`b${stack.key}`} transform={`translate(${stack.x + 14},${stack.y - 14})`} aria-hidden="true" pointerEvents="none">
                  <rect x={0} y={-11} width={text.length * 6.6 + 12} height={18} rx={9} fill="var(--surface-2)" stroke="var(--line)" />
                  <text x={6} y={2} fontSize={11} fill="var(--ink)" className="num">
                    {text}
                  </text>
                </g>
              )
            })}
          {showPresets
            ? presetGroups.map((group) => {
                const hx = x(group.pressurePsi)
                const hy = y(group.o2 * 100)
                const active = group.ids.includes(scenario.presetId ?? '')
                const left = group.pressurePsi > 5
                return (
                  <g key={group.ids.join('+')} transform={`translate(${hx},${hy})`} aria-hidden="true" pointerEvents="none" opacity={active ? 1 : 0.85}>
                    <path d="M0,-6L6,0L0,6L-6,0Z" fill={active ? 'var(--habitat)' : 'var(--bg)'} stroke="var(--habitat)" strokeWidth={1.5} />
                    {!compact && (!narrow || active) ? (
                      <text x={left ? -10 : 10} y={4} textAnchor={left ? 'end' : 'start'} fontSize={11} fill="var(--habitat)" fontWeight={600} stroke="var(--bg)" strokeWidth={3} paintOrder="stroke">
                        {group.label}
                      </text>
                    ) : null}
                  </g>
                )
              })
            : null}
        </g>
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill="transparent"
          style={{ cursor: hover ? 'pointer' : dragRing && showRing ? 'crosshair' : 'default' }}
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={() => setHover(null)}
        />
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
            <rect width={compact ? 132 : zoomMoon && !narrow ? 250 : 196} height={compact ? 22 : zoomMoon && !narrow ? 66 : 50} rx={8} fill="var(--surface)" stroke="var(--gap)" fillOpacity={0.94} />
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
          <div
            className="map-ring"
            style={{
              width: rx * 2,
              height: ry * 2,
              transform: `translate3d(${(ringX - rx - box.left).toFixed(1)}px, ${(ringY - ry - box.top).toFixed(1)}px, 0)`,
              transition: drag || reduced ? 'none' : 'transform var(--t-scene) var(--ease-in-out)',
            }}
          >
            <span className="map-ring-dot" style={{ width: dragRing ? 9 : 5, height: dragRing ? 9 : 5 }} />
          </div>
        </div>
      ) : null}
      {tip ? (
        <div
          className="card pointer-events-none absolute z-10 max-w-[260px] px-3 py-2 text-[12px]"
          style={{ left: Math.min(size.width - 270, Math.max(4, tip.x + 14)), top: Math.max(4, tip.y - 12), boxShadow: 'var(--shadow-pop)' }}
          role="tooltip"
        >
          <MapTip hit={tip} test={tipTest ?? null} />
        </div>
      ) : null}
      {pinned ? (
        <div className="card absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-3 px-3 py-2 text-[12px]" style={{ boxShadow: 'var(--shadow-pop)' }}>
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
