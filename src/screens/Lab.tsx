// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Lab: three simple models, each fitted to and checked against the real test tables, and the
// flame picture for the chosen habitat. Each tool shows one short line. The model, its notes and
// its limits sit behind the Notes button.
import { memo, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Info, Pause, Play, RotateCcw } from 'lucide-react'
import type { Test } from '../types.ts'
import { D_SQUARED_FORMULA, burnTimeToCompletion, diameterAt, dropletValues, modelEndTime, validateDSquared } from '../lib/droplet.ts'
import type { DiluentFamily } from '../lib/droplet.ts'
import type { BurnPair } from '../lib/lab.ts'
import { DILUENT_FAMILIES, EXTINCTION_BINS, LAB_FUELS, ambiguousThickness, burnLengthPairs, dropletKey, dropletSelection, extinctionBins, extinctionPoints, flexTests } from '../lib/lab.ts'
import { groupBy, median } from '../lib/stats.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useScenario } from '../state/hooks.ts'
import { gravityLabel, scenarioQuery } from '../state/scenario.ts'
import { GATES } from '../three/flameParams.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { LegendItem } from '../components/ChartFrame.tsx'
import { FireballStage } from '../components/FireballStage.tsx'
import { ScenarioLink, Segmented, Slider, SourcedNumber, useDrillProps, usePrefersReducedMotion } from '../components/ui.tsx'
import { ZoomChart, useZoomParam } from '../components/zoom.tsx'
import type { ZoomView } from '../components/zoom.tsx'
import { encodeView, linearAxis, parseView, spreadPoints, zoomTicks } from '../lib/zoom.ts'
import type { ZoomAxes, ZoomBox, ZoomDomain } from '../lib/zoom.ts'

const TOOLS = [
  { value: 'droplet', label: 'Droplet burn' },
  { value: 'extinction', label: 'Extinction' },
  { value: 'gravity', label: 'Gravity pairs' },
  { value: 'flame', label: 'Habitat flame' },
]

const FAMILY_STYLE: Record<DiluentFamily, { color: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' }> = {
  'nitrogen only': { color: 'var(--muted)', shape: 'circle' },
  'carbon dioxide': { color: 'var(--fuel-aerosol)', shape: 'square' },
  helium: { color: 'var(--fuel-gas)', shape: 'triangle' },
  'carbon dioxide plus helium': { color: 'var(--warn)', shape: 'diamond' },
}

function shapePath(shape: string, r: number): string {
  if (shape === 'square') return `M${-r},${-r}h${2 * r}v${2 * r}h${-2 * r}Z`
  if (shape === 'triangle') return `M0,${-r * 1.2}L${r * 1.1},${r * 0.9}L${-r * 1.1},${r * 0.9}Z`
  if (shape === 'diamond') return `M0,${-r * 1.3}L${r * 1.1},0L0,${r * 1.3}L${-r * 1.1},0Z`
  return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`
}

function Limits({ children }: { children: ReactNode }) {
  return (
    <div>
      <h3 className="stat-label">Limits</h3>
      <ul className="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-muted">{children}</ul>
    </div>
  )
}

// One short line for each tool. The long notes open on request.
function ToolIntro({ line, children }: { line: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <p className="text-[14px] text-muted">{line}</p>
        <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Info size={13} aria-hidden="true" /> Notes
        </button>
      </div>
      {open ? (
        <div className="card mt-3 flex flex-col gap-4 p-4 text-[14px] [&_p]:max-w-[70ch]">
          {children}
          <p className="text-[13px] text-muted">
            Terms such as burning rate, extinction and diluent are defined in the <ScenarioLink to="/about?section=glossary">Glossary</ScenarioLink>.
          </p>
        </div>
      ) : null}
    </div>
  )
}

type AxisProps = { v: ZoomView; xTicks: number[]; yTicks: number[]; xFormat?: (t: number) => string; yFormat?: (t: number) => string }

// The ticks a chart shows: its own on the whole chart, and round numbers once it is zoomed in far.
const ticksIn = (own: number[], range: [number, number], count = 5): number[] => zoomTicks(own, range, count)

// The frame, the tick labels and the axis titles. They stay put during a gesture and are laid out
// again when it rests.
function AxisLabels({ v, xLabel, yLabel, xTicks, yTicks, xFormat = String, yFormat = String }: AxisProps & { xLabel: string; yLabel: string }) {
  const { box, x, y, domain } = v
  return (
    <g aria-hidden="true">
      <rect x={box.left} y={box.top} width={box.width} height={box.height} fill="none" stroke="var(--line)" />
      {ticksIn(xTicks, domain.x).map((t) => (
        <text key={`x${t}`} x={x(t)} y={box.top + box.height + 14} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">
          {xFormat(t)}
        </text>
      ))}
      {ticksIn(yTicks, domain.y).map((t) => (
        <text key={`y${t}`} x={box.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">
          {yFormat(t)}
        </text>
      ))}
      <text x={box.left + box.width / 2} y={box.top + box.height + 32} textAnchor="middle" fontSize={12} fill="var(--muted)">
        {xLabel}
      </text>
      <text transform={`translate(12,${box.top + box.height / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--muted)">
        {yLabel}
      </text>
    </g>
  )
}

// The grid lines, which move with the plot.
function AxisGrid({ v, xTicks, yTicks }: AxisProps) {
  const { box, x, y, domain } = v
  return (
    <g aria-hidden="true">
      {ticksIn(xTicks, domain.x).map((t) => (
        <line key={`x${t}`} x1={x(t)} x2={x(t)} y1={box.top} y2={box.top + box.height} stroke="var(--line)" strokeOpacity={0.5} />
      ))}
      {ticksIn(yTicks, domain.y).map((t) => (
        <line key={`y${t}`} x1={box.left} x2={box.left + box.width} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.5} />
      ))}
    </g>
  )
}

// The plot of a Lab chart, with room for the axis title below. A zoomed y axis can carry longer
// labels, so the plot moves right far enough for them to clear the axis title, as on the map.
const labBox =
  (top: number, below: number, yTicks: number[], yFormat: (t: number) => string = String) =>
  (size: { width: number; height: number }, domain: ZoomDomain): ZoomBox => {
    const ticks = ticksIn(yTicks, domain.y)
    const chars = Math.max(...ticks.map((t) => yFormat(t).length), 1)
    // While every one of its own labels is in view the chart keeps its 46 pixels, as it always had.
    const own = ticks.length === yTicks.length && ticks.every((t, i) => t === yTicks[i])
    const left = own ? 46 : Math.max(46, Math.ceil(17 + chars * 6.6 + 6))
    return { left, top, width: Math.max(60, size.width - left - 12), height: Math.max(60, size.height - below) }
  }

const nice = (max: number, count = 5): number[] => {
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => max / s <= count) ?? 50
  const out: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

// Lab tool 1.
function DropletCalculator() {
  const data = useData()
  const props = useDrillProps()
  const reduced = usePrefersReducedMotion()
  const [params, setParams] = useSearchParams()
  const fuel = LAB_FUELS.includes(params.get('fuel') as 'Methanol') ? (params.get('fuel') as string) : 'Methanol'
  const o2 = Math.min(0.36, Math.max(0.12, Number(params.get('lo2') ?? 21) / 100 || 0.21))
  const family = DILUENT_FAMILIES.includes(params.get('gas') as DiluentFamily) ? (params.get('gas') as DiluentFamily) : 'nitrogen only'
  const set = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(key, value)
        if (key !== 'test') next.delete('test')
        // New inputs draw a new line on new axes, so the chart opens whole again.
        next.delete('dz')
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const selection = useMemo(() => dropletSelection(data.tests, fuel, o2, family), [data.tests, fuel, o2, family])
  const withAll = selection.tests.filter((t) => dropletValues(t))
  const example = data.testById.get('PSI-69:0:2')
  const chosen = withAll.find((t) => t.id === params.get('test')) ?? (example && withAll.includes(example) ? example : withAll[0]) ?? null
  const row = chosen ? dropletValues(chosen) : null
  const modelEnd = row ? modelEndTime(row.d0, row.dExt, row.k) : null
  const k = selection.k
  const d0 = row?.d0 ?? selection.d0 ?? 2
  const tMax = Math.max(row ? Math.max(row.burnTime, modelEnd ?? 0) : 0, k ? burnTimeToCompletion(d0, k) : 1) * 1.05
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const animated = GATES.burningRateUnitConfirmed
  const end = modelEnd ?? (k ? burnTimeToCompletion(d0, k) : 0)
  useEffect(() => setT(0), [chosen?.id, fuel, o2, family])
  // One clock drives the droplet, the chart cursor and the readout.
  useEffect(() => {
    if (!playing || reduced) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((value) => {
        const next = value + dt
        if (next >= end) {
          setPlaying(false)
          return end
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, end, reduced])
  const rate = row?.k ?? k ?? 0
  const diameter = rate > 0 ? diameterAt(d0, rate, t) : d0
  const droplet = animated && row ? { scale: Math.max(0.05, diameter / d0), flameOn: t < end - 1e-6 } : null
  const ySpan = d0 * d0 * 1.08
  const axes = useMemo<ZoomAxes>(() => ({ x: linearAxis([0, tMax]), y: linearAxis([0, ySpan]) }), [tMax, ySpan])
  const [zoom, setZoom] = useZoomParam('dz', (text) => parseView(text, axes), (view) => encodeView(view, axes))

  return (
    <div>
      <ToolIntro line="A burning droplet shrinks in a straight line of diameter squared against time.">
        <p className="text-muted">
          This is the d-squared law. EMBER takes the burning rate from real FLEX tests near the condition you pick, and checks the law against every FLEX test that has the four values it needs.
        </p>
        <p className="num bg-surface-2 px-3 py-2 text-[13px]">{D_SQUARED_FORMULA}</p>
        <p className="text-muted">The model end time and the measured burn time are different quantities. The model is never stretched to hide the difference.</p>
        <Limits>
          <li>The law assumes a round, steady flame around one droplet. Disrupted droplets and cool flames do not follow it.</li>
          <li>The burning rate column lost its unit in the file. EMBER reads it as mm² per second. The team confirms this from the publication.</li>
          <li>The burning rate is a median over nearby tests. It mixes pressures and droplet sizes.</li>
          <li>The flame's size and colour in the picture are not inferred from the data. Only the droplet's size follows the row.</li>
          <li>A visible flame going out does not prove that all burning has stopped.</li>
        </Limits>
      </ToolIntro>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card flex flex-col gap-4 p-4 lg:col-span-3" aria-label="Inputs">
          <div>
            <span className="field-label">Fuel</span>
            <Segmented label="Fuel" value={fuel} options={LAB_FUELS.map((f) => ({ value: f, label: f }))} onChange={(v) => set('fuel', v)} />
          </div>
          <Slider label="Oxygen" min={12} max={36} step={0.5} value={Math.round(o2 * 1000) / 10} display={formatPercent(o2)} onChange={(v) => set('lo2', String(v))} />
          <label>
            <span className="field-label">Added gas</span>
            <select className="select" name="gas" value={family} onChange={(e) => set('gas', e.target.value)}>
              {DILUENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="stat-tile">
            <span className="stat-label">Burning rate K</span>
            {selection.enough && k != null ? (
              <>
                <span className="text-[20px] leading-tight">
                  <SourcedNumber path={[{ kind: 'bin', chart: 'dsquared', key: dropletKey(fuel, o2, family) }]} label={`Burning rate ${formatNumber(k, 3)}, the median of ${selection.tests.length} FLEX tests`}>
                    {formatNumber(k, 3)}
                  </SourcedNumber>{' '}
                  <span className="text-[12px] text-muted">mm² per second</span>
                </span>
                <span className="text-[11px] text-muted">
                  median of <span className="num">{selection.tests.length}</span> FLEX tests
                </span>
              </>
            ) : (
              <span className="text-[13px]">
                Not enough tests here. <span className="num">{selection.tests.length}</span> matched, three are needed.
              </span>
            )}
          </div>
          {withAll.length > 0 ? (
            <label>
              <span className="field-label">FLEX test</span>
              <select className="select" name="test" value={chosen?.id ?? ''} onChange={(e) => set('test', e.target.value)}>
                {withAll.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.label}, {formatPercent(test.o2 ?? 0)} oxygen
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        <section className="lg:col-span-4" aria-label="The fireball for this test">
          <div className="card p-4">
            <FireballStage showEarth={false} droplet={droplet ?? (row ? { scale: 1, flameOn: true } : null)} />
          </div>
        </section>

        <section className="card p-4 lg:col-span-5" aria-label="Diameter squared against time">
          <ZoomChart
            title="Diameter squared against time"
            description={`The d-squared line for ${fuel.toLowerCase()} at ${formatPercent(o2)} oxygen. ${selection.enough ? `The line falls from ${formatNumber(d0 * d0, 2)} square millimetres to zero.` : 'Not enough tests near this condition, so nothing is drawn.'}`}
            aspect={0.62}
            minHeight={240}
            maxHeight={320}
            axes={axes}
            zoom={zoom}
            onZoom={setZoom}
            layout={labBox(10, 52, nice(ySpan))}
            labels={(v) => <AxisLabels v={v} xLabel="Time, seconds" yLabel="d², mm²" xTicks={nice(tMax)} yTicks={nice(ySpan)} />}
            grid={(v) => <AxisGrid v={v} xTicks={nice(tMax)} yTicks={nice(ySpan)} />}
          >
            {({ x, y, box, inX }) => {
              const cursorY = y(Math.max(0, d0 * d0 - rate * t))
              return (
                <>
                  {selection.enough && k != null ? (
                    <g className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'bin', chart: 'dsquared', key: dropletKey(fuel, o2, family) }], `The d-squared line from the median burning rate of ${selection.tests.length} FLEX tests. Press Enter for its rows.`)}>
                      <line x1={x(0)} y1={y(d0 * d0)} x2={x(burnTimeToCompletion(d0, k))} y2={y(0)} stroke="transparent" strokeWidth={14} />
                      <line x1={x(0)} y1={y(d0 * d0)} x2={x(burnTimeToCompletion(d0, k))} y2={y(0)} stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" />
                    </g>
                  ) : null}
                  {row && modelEnd != null && chosen ? (
                    <g className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'test', id: chosen.id }], `FLEX test ${chosen.label}: model end time ${formatNumber(modelEnd, 2)} seconds, measured burn time ${formatNumber(row.burnTime, 1)} seconds. Press Enter for the row.`)}>
                      <line x1={x(0)} y1={y(row.d0 * row.d0)} x2={x(modelEnd)} y2={y(row.dExt * row.dExt)} stroke="transparent" strokeWidth={14} />
                      <line x1={x(0)} y1={y(row.d0 * row.d0)} x2={x(modelEnd)} y2={y(row.dExt * row.dExt)} stroke="var(--freefall)" strokeWidth={2.5} />
                      <circle cx={x(modelEnd)} cy={y(row.dExt * row.dExt)} r={4} fill="var(--freefall)" />
                      <line x1={x(row.burnTime)} x2={x(row.burnTime)} y1={box.top} y2={box.top + box.height} stroke="var(--warn)" strokeDasharray="3 3" />
                      {/* The label goes with its line, so it is drawn only while that line is in view. */}
                      {inX(row.burnTime) ? (
                        <text x={x(row.burnTime) - 4} y={box.top + 12} textAnchor="end" fontSize={11} fill="var(--warn)">
                          measured end
                        </text>
                      ) : null}
                    </g>
                  ) : null}
                  {row && animated ? <circle cx={x(Math.min(t, end))} cy={cursorY} r={5} fill="var(--bg)" stroke="var(--freefall)" strokeWidth={2} /> : null}
                </>
              )
            }}
          </ZoomChart>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-freefall" />}>This FLEX row, by the law</LegendItem>
            <LegendItem swatch={<span className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" />}>Median burning rate near this condition</LegendItem>
          </div>
          {row && chosen ? (
            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              {modelEnd != null ? (
                <div className="bg-surface-2 p-3">
                  <p className="stat-label">Model end</p>
                  <p className="num mt-1 text-[22px] text-freefall">{formatNumber(modelEnd, 2)} s</p>
                  <p className="num text-muted">
                    ({formatNumber(row.d0, 2)}² − {formatNumber(row.dExt, 2)}²) ÷ {formatNumber(row.k, 2)}
                  </p>
                </div>
              ) : (
                <div className="bg-surface-2 p-3">
                  <p className="stat-label">Model end</p>
                  <p className="mt-1 text-[18px] text-warn">Model end not defined</p>
                  <p className="text-muted">
                    NASA lists an extinction diameter of <span className="num">{formatNumber(row.dExt, 2)} mm</span>, not smaller than the initial <span className="num">{formatNumber(row.d0, 2)} mm</span>, so the law gives no burn time.
                  </p>
                </div>
              )}
              <div className="bg-surface-2 p-3">
                <p className="stat-label">Measured</p>
                <p className="mt-1 text-[22px]">
                  <SourcedNumber path={[{ kind: 'test', id: chosen.id }]} label={`FLEX test ${chosen.label} measured burn time ${formatNumber(row.burnTime, 1)} seconds`}>
                    {formatNumber(row.burnTime, 1)} s
                  </SourcedNumber>
                </p>
                <p className="text-muted">
                  FLEX test {chosen.label}, ended in {String(chosen.outcome).toLowerCase()}
                </p>
              </div>
            </div>
          ) : null}
          {row ? (
            animated ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => (t >= end ? (setT(0), setPlaying(true)) : setPlaying((v) => !v))}>
                  {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? 'Pause' : 'Play'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setPlaying(false), setT(0))}>
                  <RotateCcw size={14} aria-hidden="true" /> Reset
                </button>
                <input type="range" name="scrub" className="slider max-w-[220px]" min={0} max={end} step={end / 200} value={Math.min(t, end)} onChange={(e) => (setPlaying(false), setT(Number(e.target.value)))} aria-label="Scrub the burn" />
                <span className="num text-[13px]">
                  t = {formatNumber(t, 2)} s, d = {formatNumber(diameter, 2)} mm
                </span>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-muted" title="The burning rate column lost its unit in the PSI file. The droplet is animated once the team confirms that unit from the publication.">
                Shown still until the burning rate unit is confirmed.
              </p>
            )
          ) : null}
        </section>
      </div>

      <Validation />
    </div>
  )
}

// The check of the law against every FLEX test. It does not depend on the inputs above, so it is
// drawn once and the play clock never redraws it.
const Validation = memo(function Validation() {
  const data = useData()
  const props = useDrillProps()
  const validation = useMemo(() => validateDSquared(flexTests(data.tests)), [data.tests])
  const i4 = data.insightById.I4
  const max = Math.max(...validation.points.map((p) => Math.max(p.predicted, p.measured)), 1) * 1.05
  const axes = useMemo<ZoomAxes>(() => ({ x: linearAxis([0, max]), y: linearAxis([0, max]) }), [max])
  // Tests with the same two times sit on one point. Zoomed in, they spread apart.
  const keys = useMemo(() => validation.points.map((p) => `${p.measured}|${p.predicted}`), [validation.points])
  return (
    <section className="card mt-4 p-4" aria-labelledby="validation-title">
      <h3 id="validation-title" className="text-[18px]">
        Does the law hold on the real tests?
      </h3>
      <ul className="m-0 mt-3 grid max-w-[640px] list-none grid-cols-3 gap-2 p-0">
        <li className="stat-tile">
          <span className="stat-label">FLEX tests</span>
          <span className="text-[20px] leading-tight">
            <SourcedNumber path={[{ kind: 'bin', chart: 'validation', key: 'all' }]} label={`${validation.points.length} FLEX tests with all four values`}>
              {validation.points.length}
            </SourcedNumber>
          </span>
        </li>
        <li className="stat-tile">
          <span className="stat-label">Predicted over measured</span>
          <span className="text-[20px] leading-tight">
            <SourcedNumber path={[{ kind: 'insight', id: 'I4', number: 'medianRatio' }]} label={`Median ratio ${i4?.display.medianRatio}`}>
              {i4?.display.medianRatio ?? formatNumber(validation.median ?? 0, 3)}
            </SourcedNumber>
          </span>
        </li>
        <li className="stat-tile">
          <span className="stat-label">Middle half</span>
          <span className="num text-[20px] leading-tight">
            {formatNumber(validation.q1 ?? 0, 2)} to {formatNumber(validation.q3 ?? 0, 2)}
          </span>
        </li>
      </ul>
      <p className="mt-3 max-w-[640px] text-[13px] text-muted">
        The first number is a median ratio, not an error bound for any one test. Each prediction uses the burning rate and the diameters from its own row, so this checks that the table agrees with the law. It is not an independent test of a fire model.
      </p>
      <div className="mt-3 max-w-[640px]">
        <ZoomChart
          title="Predicted against measured burn time"
          description={`A scatter of ${validation.points.length} FLEX tests. Most points sit just under the one to one line.`}
          aspect={0.8}
          minHeight={280}
          maxHeight={480}
          axes={axes}
          reset="Reset to all tests"
          layout={labBox(10, 52, nice(max))}
          labels={(v) => <AxisLabels v={v} xLabel="Measured burn time, seconds" yLabel="Predicted, seconds" xTicks={nice(max)} yTicks={nice(max)} />}
          grid={(v) => <AxisGrid v={v} xTicks={nice(max)} yTicks={nice(max)} />}
        >
          {({ x, y, zoom }) => {
            const offsets = spreadPoints(keys, zoom)
            return (
              <>
                <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="var(--muted)" strokeDasharray="4 4" aria-hidden="true" />
                {validation.points.map((p, i) => {
                  const test = data.testById.get(p.testId) as Test
                  return (
                    <circle
                      key={p.testId}
                      cx={x(p.measured) + offsets[i].dx}
                      cy={y(p.predicted) + offsets[i].dy}
                      r={3.4}
                      fill="var(--fuel-liquid)"
                      fillOpacity={0.75}
                      className="drillable"
                      tabIndex={-1}
                      data-nav=""
                      {...props([{ kind: 'test', id: p.testId }], `FLEX test ${test.label}: predicted ${formatNumber(p.predicted, 1)} seconds, measured ${formatNumber(p.measured, 1)} seconds. Press Enter for the row.`)}
                    >
                      <title>{`${test.label}: predicted ${formatNumber(p.predicted, 1)} s, measured ${formatNumber(p.measured, 1)} s`}</title>
                    </circle>
                  )
                })}
              </>
            )
          }}
        </ZoomChart>
      </div>
    </section>
  )
})

// Lab tool 2.
function ExtinctionExplorer() {
  const data = useData()
  const i5 = data.insightById.I5
  const compare = useMemo(() => {
    const out: { fuel: string; bin: string; nitrogen: number; nitrogenN: number; co2: number; co2N: number }[] = []
    for (const fuel of LAB_FUELS) {
      const points = extinctionPoints(data.tests, fuel)
      for (let i = 0; i < EXTINCTION_BINS.length - 1; i += 1) {
        const inside = points.filter((p) => p.o2 >= EXTINCTION_BINS[i] - 1e-9 && p.o2 < EXTINCTION_BINS[i + 1] - 1e-9)
        const n2 = inside.filter((p) => p.family === 'nitrogen only')
        const co2 = inside.filter((p) => p.family === 'carbon dioxide')
        // A comparison is stated only with at least five tests on each side at matched oxygen.
        if (n2.length >= 5 && co2.length >= 5) {
          out.push({ fuel, bin: `${formatPercent(EXTINCTION_BINS[i], 0)} to ${formatPercent(EXTINCTION_BINS[i + 1], 0)}`, nitrogen: median(n2.map((p) => p.ratio)) as number, nitrogenN: n2.length, co2: median(co2.map((p) => p.ratio)) as number, co2N: co2.length })
        }
      }
    }
    return out
  }, [data.tests])
  return (
    <div>
      <ToolIntro line="Where each droplet flame went out, by oxygen level. Near 1 it went out at once. 0 means it burned away.">
        <p className="text-muted">
          The extinction ratio is the diameter at which the visible flame went out, divided by the starting diameter. Each point is one FLEX test. The line joins the median of each oxygen bin, and the number on each bin is its count of tests.
        </p>
        <div>
          <h3 className="stat-label">What the plot shows</h3>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-2 pl-5">
            {i5 ? (
              <li>
                {i5.headline} The median extinction ratio is <span className="num">{i5.display.medianRatioLow}</span> at 10 to 15% oxygen and <span className="num">{i5.display.medianRatioHigh}</span> at 28 to 36%.{' '}
                <SourcedNumber path={[{ kind: 'insight', id: 'I5', number: i5.primary }]} label="The rows behind this count">
                  Rows
                </SourcedNumber>
              </li>
            ) : null}
            {compare.length === 0 ? (
              <li>No oxygen bin holds at least five nitrogen-only tests and five carbon dioxide tests of the same fuel. So EMBER makes no claim that one added gas beats another.</li>
            ) : (
              compare.map((c) => (
                <li key={c.fuel + c.bin}>
                  {c.fuel} at {c.bin} oxygen: median ratio <span className="num">{formatNumber(c.nitrogen, 2)}</span> in nitrogen only over <span className="num">{c.nitrogenN}</span> tests, and <span className="num">{formatNumber(c.co2, 2)}</span> with carbon dioxide over <span className="num">{c.co2N}</span> tests.
                </li>
              ))
            )}
            <li>Bins with a count of 0 are oxygen levels where FLEX burned no droplet of that fuel.</li>
          </ul>
        </div>
        <Limits>
          <li>The points mix pressures from about 0.7 to 3 atmospheres and droplet sizes. A bin median is a direction, not a limit.</li>
          <li>A comparison between added gases is only stated where a bin holds at least five tests of each.</li>
          <li>Tests with no extinction diameter in the table are not plotted.</li>
          <li>Background on cool flames, where a droplet keeps burning with no visible flame, is on the <ScenarioLink to="/investigations/PSI-39">CFI</ScenarioLink> and <ScenarioLink to="/investigations/PSI-69">FLEX</ScenarioLink> pages.</li>
        </Limits>
      </ToolIntro>
      <div className="grid gap-4 lg:grid-cols-2">
        {LAB_FUELS.map((fuel) => (
          <ExtinctionPanel key={fuel} fuel={fuel} />
        ))}
      </div>
      <div className="card mt-4 flex flex-wrap gap-x-4 gap-y-1 px-4 py-2">
        {DILUENT_FAMILIES.map((f) => (
          <LegendItem key={f} swatch={<svg width="12" height="12" viewBox="-6 -6 12 12"><path d={shapePath(FAMILY_STYLE[f].shape, 4)} fill={FAMILY_STYLE[f].color} /></svg>}>
            {f[0].toUpperCase() + f.slice(1)}
          </LegendItem>
        ))}
        <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-ink" />}>Median of each oxygen bin</LegendItem>
      </div>
    </div>
  )
}

const EXTINCTION_AXES: ZoomAxes = { x: linearAxis([10, 38]), y: linearAxis([0, 1.05]) }
const EXTINCTION_X_TICKS = [10, 14, 18, 22, 26, 30, 34, 38]
const EXTINCTION_Y_TICKS = [0, 0.25, 0.5, 0.75, 1]

function ExtinctionPanel({ fuel }: { fuel: string }) {
  const data = useData()
  const props = useDrillProps()
  const points = useMemo(() => extinctionPoints(data.tests, fuel), [data.tests, fuel])
  const bins = useMemo(() => extinctionBins(data.tests, fuel), [data.tests, fuel])
  // Tests with the same oxygen and ratio sit on one point. Zoomed in, they spread apart.
  const keys = useMemo(() => points.map((p) => `${p.o2}|${p.ratio}`), [points])
  return (
    <section className="card p-4" aria-label={`${fuel} extinction panel`}>
      <ZoomChart
        title={`${fuel}, ${points.length} tests`}
        description={`Extinction ratio against oxygen for ${points.length} ${fuel.toLowerCase()} droplet tests, with a binned median line.`}
        aspect={0.72}
        minHeight={280}
        maxHeight={420}
        axes={EXTINCTION_AXES}
        reset="Reset to all tests"
        layout={labBox(22, 64, EXTINCTION_Y_TICKS)}
        labels={(v) => <AxisLabels v={v} xLabel="Oxygen" yLabel="Extinction ratio" xTicks={EXTINCTION_X_TICKS} yTicks={EXTINCTION_Y_TICKS} xFormat={(t) => `${t}%`} />}
        grid={(v) => <AxisGrid v={v} xTicks={EXTINCTION_X_TICKS} yTicks={EXTINCTION_Y_TICKS} />}
        band={({ x, box, inX }) =>
          bins.map((b) => (
            <g key={b.key} className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'bin', chart: 'extinction', key: b.key }], `${b.testIds.length} ${fuel.toLowerCase()} tests at ${formatPercent(b.min, 0)} to ${formatPercent(b.max, 0)} oxygen${b.median != null ? `, median extinction ratio ${formatNumber(b.median, 2)}` : ''}. Press Enter for the rows.`)}>
              <rect x={x(b.min * 100)} y={box.top} width={x(b.max * 100) - x(b.min * 100)} height={box.height} fill="var(--freefall)" fillOpacity={b.index % 2 === 0 ? 0.04 : 0.0} />
              {/* Each bin's count sits over its middle, while that middle is in view. */}
              {inX(((b.min + b.max) / 2) * 100) ? (
                <text x={(x(b.min * 100) + x(b.max * 100)) / 2} y={box.top - 6} textAnchor="middle" fontSize={11} fill={b.testIds.length === 0 ? 'var(--gap)' : 'var(--ink)'} className="num">
                  {b.testIds.length}
                </text>
              ) : null}
            </g>
          ))
        }
      >
        {({ x, y, zoom }) => {
          const offsets = spreadPoints(keys, zoom)
          const line = bins.filter((b) => b.median != null).map((b, i) => `${i === 0 ? 'M' : 'L'}${x(((b.min + b.max) / 2) * 100).toFixed(1)},${y(b.median as number).toFixed(1)}`).join('')
          return (
            <>
              {points.map((p, i) => {
                const style = FAMILY_STYLE[p.family]
                return (
                  <path key={p.testId} d={shapePath(style.shape, 3.2)} transform={`translate(${(x(p.o2 * 100) + offsets[i].dx).toFixed(1)},${(y(p.ratio) + offsets[i].dy).toFixed(1)})`} fill={style.color} fillOpacity={0.7} data-drill={`test.${p.testId}`} {...{ onClick: props([{ kind: 'test', id: p.testId }], '').onClick }} className="drillable">
                    <title>{`${formatPercent(p.o2)} oxygen, extinction ratio ${formatNumber(p.ratio, 2)}, ${p.family}`}</title>
                  </path>
                )
              })}
              <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
              {bins.filter((b) => b.median != null).map((b) => (
                <circle key={b.key} cx={x(((b.min + b.max) / 2) * 100)} cy={y(b.median as number)} r={4} fill="var(--ink)" pointerEvents="none" />
              ))}
            </>
          )
        }}
      </ZoomChart>
    </section>
  )
}

// Lab tool 3.
function GravityBounds() {
  const data = useData()
  const props = useDrillProps()
  const pairs = useMemo(() => burnLengthPairs(data.tests), [data.tests])
  const max = Math.max(...pairs.map((p) => Math.max(p.ug ?? 0, p.g1 ?? 0)), 1)
  // Burn length zooms. The samples are categories, so that axis never does.
  const axes = useMemo<ZoomAxes>(() => ({ x: linearAxis([0, max * 1.05]), y: { full: [0, 1], minSpan: 1, locked: true } }), [max])
  const i7 = data.insightById.I7
  return (
    <div>
      <ToolIntro line="The same samples burned in microgravity and in normal gravity. No gravity level in between was measured.">
        <p className="text-muted">
          Saffire-II burned the same samples in microgravity and in normal gravity. Each sample gives two observations, one at 0 g and one at 1 g. The line that joins them only pairs the two. It is not a measured or predicted range for Moon or Mars gravity.
        </p>
        <p>No partial-gravity test data exists in PSI yet. The Lunar-g Combustion Investigation and the Flammability of Materials on the Moon experiment are expected to add it. Source: the challenge statement.</p>
        {i7 ? (
          <p className="text-muted">
            {i7.headline}{' '}
            <SourcedNumber path={[{ kind: 'insight', id: 'I7', number: 'shorterInMicrogravity' }]} label="The rows behind this count">
              Rows
            </SourcedNumber>
          </p>
        ) : null}
        <p className="text-muted">
          The challenge statement also notes that the ACME E-FIELD Flames experiment mimicked partial gravity through the pull of an electric field on the ions in a flame. <ScenarioLink to="/investigations/PSI-22">Open ACME E-FIELD Flames</ScenarioLink>
        </p>
        <Limits>
          <li>This is {pairs.length} samples at one flow speed and one oxygen level, close to cabin air. It frames the question and does not settle it.</li>
          <li>The table gives lengths as text. "Complete" is read as the full sample length and "~ 10 cm" as 10 cm.</li>
          <li>A gravity level between zero and one may not behave like a point between the two, and may fall outside them. No slider between them is offered.</li>
          <li>One sample holds two materials and its two lengths describe different parts of it.</li>
        </Limits>
      </ToolIntro>
      <section className="card p-4" aria-label="Burn length pairs">
        <ZoomChart
          title="Burn length in microgravity and in normal gravity"
          description={`${pairs.length} Saffire-II samples, each with a microgravity point and a normal gravity point. A thin line pairs the two points of a sample. Intermediate gravity was not measured.`}
          aspect={0.5}
          minHeight={pairs.length * 38 + 60}
          maxHeight={pairs.length * 44 + 70}
          axes={axes}
          layout={(size) => {
            const left = Math.min(230, size.width * 0.42)
            return { left, top: 8, width: Math.max(60, size.width - left - 16), height: Math.max(60, size.height - 48) }
          }}
          labels={({ x, box, size, domain }) => {
            const rowH = box.height / pairs.length
            return (
              <>
                <g aria-hidden="true">
                  {ticksIn(nice(max * 1.05, 6), domain.x, 6).map((t) => (
                    <text key={t} x={x(t)} y={box.top + box.height + 14} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">
                      {t}
                    </text>
                  ))}
                  <text x={box.left + box.width / 2} y={box.top + box.height + 32} textAnchor="middle" fontSize={12} fill="var(--muted)">
                    Burn length, cm
                  </text>
                </g>
                {/* Each sample's row is one control. Its name stays put while the lengths zoom. */}
                {pairs.map((p, i) => {
                  const cy = box.top + rowH * (i + 0.5)
                  return (
                    <g key={p.testId} className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'bin', chart: 'burnLength', key: p.testId }], `Saffire-II sample ${p.label}, ${p.material}${p.thicknessLikely ? `, thickness ${p.thickness} as written in NASA's table, likely ${p.thicknessLikely} but unconfirmed` : ''}: microgravity burn length ${p.ugRaw}, normal gravity ${p.g1Raw}. Press Enter for the row.`)}>
                      <rect x={0} y={cy - rowH / 2} width={size.width} height={rowH} fill="transparent" />
                      <text x={8} y={cy - 2} fontSize={12} fill="var(--ink)" fontWeight={600}>
                        {p.label} {p.material.length > 24 ? `${p.material.slice(0, 23)}…` : p.material}
                      </text>
                      <text x={8} y={cy + 12} fontSize={11} fill="var(--muted)">
                        {p.thickness} {p.thicknessLikely ? <tspan fill="var(--warn)">{box.left >= 220 ? "as written in NASA's table *" : 'as written *'}</tspan> : null}
                        {p.mixed ? '· two materials' : ''}
                      </text>
                    </g>
                  )
                })}
              </>
            )
          }}
          grid={({ x, box, domain }) => (
            <g aria-hidden="true">
              {ticksIn(nice(max * 1.05, 6), domain.x, 6).map((t) => (
                <line key={t} x1={x(t)} x2={x(t)} y1={box.top} y2={box.top + box.height} stroke="var(--line)" strokeOpacity={0.5} />
              ))}
            </g>
          )}
        >
          {({ x, box }) => {
            const rowH = box.height / pairs.length
            return (
              <g pointerEvents="none">
                {pairs.map((p, i) => {
                  const cy = box.top + rowH * (i + 0.5)
                  const both = p.ug != null && p.g1 != null
                  return (
                    <g key={p.testId}>
                      {both ? <line x1={x(p.ug as number)} x2={x(p.g1 as number)} y1={cy} y2={cy} stroke="var(--faint)" strokeWidth={1.5} /> : null}
                      {p.ug != null ? <circle cx={x(p.ug)} cy={cy} r={6} fill="var(--freefall)" /> : null}
                      {p.g1 != null ? <path d={shapePath('diamond', 6)} transform={`translate(${x(p.g1)},${cy})`} fill="var(--ember)" /> : null}
                    </g>
                  )
                })}
              </g>
            )
          }}
        </ZoomChart>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem swatch={<span className="inline-block h-3 w-3 rounded-full bg-freefall" />}>Microgravity</LegendItem>
          <LegendItem swatch={<svg width="12" height="12" viewBox="-7 -8 14 16"><path d={shapePath('diamond', 6)} fill="var(--ember)" /></svg>}>Normal gravity</LegendItem>
          <LegendItem swatch={<span className="inline-block h-0 w-6 border-t-2 border-faint" />}>Paired observations at 0 g and 1 g. Intermediate gravity not measured</LegendItem>
        </div>
        <AmbiguousThickness pairs={pairs} />
      </section>
    </div>
  )
}

// A thickness kept as NASA wrote it, such as "037 mm", is marked in the chart and explained here.
// The raw text is shown and stored. The likely reading stays unconfirmed until the science lead checks it.
function AmbiguousThickness({ pairs }: { pairs: BurnPair[] }) {
  const flagged = pairs.filter((p) => p.thicknessLikely)
  if (flagged.length === 0) return null
  const groups = Object.entries(groupBy(flagged, (p) => p.thickness))
  return (
    <p className="mt-2 border-l-2 border-warn pl-2 text-[12px] text-muted" role="note">
      <span className="text-warn">*</span>{' '}
      {groups.map(([raw, list]) => (
        <span key={raw}>
          {list.length === 1 ? 'Sample' : 'Samples'} {listWords(list.map((p) => p.label))} {list.length === 1 ? 'has' : 'have'} a thickness of "{raw}" in NASA's SAFFIRE-2 table. EMBER shows it as written. It is likely {ambiguousThickness(raw)}, but that is unconfirmed until the team's science lead checks it.{' '}
        </span>
      ))}
      <ScenarioLink to="/about?section=kept-as-written">Source text kept as written</ScenarioLink>
    </p>
  )
}

const listWords = (items: string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

// The flame picture for the chosen habitat, with its three sourced readouts. It moved here from
// the dashboard, whole. The habitat dropdown on this screen drives it.
function HabitatFlame() {
  const { scenario, name } = useScenario()
  return (
    <div>
      <ToolIntro line="How the flame picture responds to the chosen habitat. It is an illustration, not a simulation of that cabin.">
        <p className="text-muted">
          The picture is drawn in the browser and carries a small SI mark. Oxygen, air flow and gravity change it. The three numbers under it come from NASA tables and each opens its rows.
        </p>
        <div>
          <h3 className="stat-label">What the three numbers are</h3>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-2 pl-5">
            <li>Burn rate is the median burning rate of the nitrogen-diluted FLEX tests within 3 points of the chosen oxygen level. {GATES.burningRateUnitConfirmed ? 'It is in mm² per second.' : 'Its unit still waits on a check by the team.'}</li>
            <li>Went out counts the FLEX tests within 3 points of oxygen where the visible flame went out. It ignores pressure, so it is not the nearby count of the dashboard, and it is not a success rate for an extinguisher.</li>
            <li>Flame temp is a calculated temperature listed for ACME gas flames within 5 points of oxygen. It is not a measured cabin temperature.</li>
          </ul>
        </div>
        <Limits>
          <li>The temperature colours are an illustrative scale with two labelled ends. The pattern between them is drawn, not computed.</li>
          <li>No shape between the Earth flame and the fireball is drawn, because no partial-gravity test exists in the snapshot.</li>
          <li>
            What each control changes, and on what basis, is listed under <ScenarioLink to="/about?section=drivers">What drives the fireball</ScenarioLink>.
          </li>
        </Limits>
      </ToolIntro>
      <section className="card max-w-[760px] p-4" aria-label="The fireball for this habitat">
        <p className="mb-3 text-[14px]">
          <span className="font-semibold">{name}</span>{' '}
          <span className="num text-[13px] text-muted">
            {formatPercent(scenario.o2)} oxygen · {formatNumber(scenario.pressurePsi, 1)} psi · {gravityLabel(scenario.gravity)} · air flow {scenario.flowCmS} cm/s
          </span>
        </p>
        <FireballStage />
      </section>
    </div>
  )
}

export default function Lab() {
  const { tool = 'droplet' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const active = TOOLS.some((t) => t.value === tool) ? tool : 'droplet'
  return (
    <div className="page">
      <PageHeader title="Lab" lead="Three models, each checked against the real tests, and the flame picture for your habitat">
        <div className="hide-scrollbar max-w-full overflow-x-auto">
          <Segmented label="Lab tool" value={active} options={TOOLS} onChange={(v) => navigate(`/lab/${v}${scenarioQuery(params)}`, { preventScrollReset: true })} />
        </div>
      </PageHeader>
      {active === 'droplet' ? <DropletCalculator /> : null}
      {active === 'extinction' ? <ExtinctionExplorer /> : null}
      {active === 'gravity' ? <GravityBounds /> : null}
      {active === 'flame' ? <HabitatFlame /> : null}
    </div>
  )
}
