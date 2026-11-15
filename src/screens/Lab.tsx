// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Lab: three simple models, each fitted to and checked against the real test tables.
// Each tool states the model, shows the validation against real tests and lists its limits.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { scaleLinear } from 'd3-scale'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { Test } from '../types.ts'
import { D_SQUARED_FORMULA, burnTimeToCompletion, burnTimeToExtinction, diameterAt, dropletValues, validateDSquared } from '../lib/droplet.ts'
import type { DiluentFamily } from '../lib/droplet.ts'
import { DILUENT_FAMILIES, EXTINCTION_BINS, LAB_FUELS, burnLengthPairs, dropletKey, dropletSelection, extinctionBins, extinctionPoints, flexTests } from '../lib/lab.ts'
import { median } from '../lib/stats.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { scenarioQuery } from '../state/scenario.ts'
import { GATES } from '../three/flameParams.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { ChartFrame, LegendItem } from '../components/ChartFrame.tsx'
import { FireballStage } from '../components/FireballStage.tsx'
import { ScenarioLink, Segmented, SiTag, Slider, SourcedNumber, useDrillProps, usePrefersReducedMotion } from '../components/ui.tsx'

const TOOLS = [
  { value: 'droplet', label: 'Droplet burn calculator' },
  { value: 'extinction', label: 'Extinction explorer' },
  { value: 'gravity', label: 'Between zero and one g' },
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
    <section className="card mt-6 border-l-2 border-l-warn p-4">
      <h3 className="text-[16px]">Limits</h3>
      <ul className="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-muted">{children}</ul>
    </section>
  )
}

function Axes({ x, y, box, xLabel, yLabel, xTicks, yTicks, xFormat = String, yFormat = String }: { x: (v: number) => number; y: (v: number) => number; box: { l: number; t: number; w: number; h: number }; xLabel: string; yLabel: string; xTicks: number[]; yTicks: number[]; xFormat?: (v: number) => string; yFormat?: (v: number) => string }) {
  return (
    <g aria-hidden="true">
      <rect x={box.l} y={box.t} width={box.w} height={box.h} fill="none" stroke="var(--line)" />
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} x2={x(t)} y1={box.t} y2={box.t + box.h} stroke="var(--line)" strokeOpacity={0.5} />
          <text x={x(t)} y={box.t + box.h + 14} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">
            {xFormat(t)}
          </text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={box.l} x2={box.l + box.w} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.5} />
          <text x={box.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">
            {yFormat(t)}
          </text>
        </g>
      ))}
      <text x={box.l + box.w / 2} y={box.t + box.h + 32} textAnchor="middle" fontSize={12} fill="var(--muted)">
        {xLabel}
      </text>
      <text transform={`translate(12,${box.t + box.h / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--muted)">
        {yLabel}
      </text>
    </g>
  )
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
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const selection = useMemo(() => dropletSelection(data.tests, fuel, o2, family), [data.tests, fuel, o2, family])
  const withAll = selection.tests.filter((t) => dropletValues(t))
  const example = data.testById.get('PSI-69:0:2')
  const chosen = withAll.find((t) => t.id === params.get('test')) ?? (example && withAll.includes(example) ? example : withAll[0]) ?? null
  const row = chosen ? dropletValues(chosen) : null
  const modelEnd = row ? burnTimeToExtinction(row.d0, row.dExt, row.k) : null
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
  const validation = useMemo(() => validateDSquared(flexTests(data.tests)), [data.tests])
  const i4 = data.insightById.I4

  return (
    <div>
      <p className="prose-width text-muted">
        A burning droplet shrinks so that the square of its diameter falls in a straight line with time. This is the d-squared law. EMBER takes the burning rate from real FLEX tests near the condition you pick, and checks the law against every FLEX test that has the four values it needs.
      </p>
      <p className="num mt-3 rounded-control bg-surface-2 px-3 py-2 text-[13px]">{D_SQUARED_FORMULA}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="card flex flex-col gap-4 p-4 lg:col-span-3" aria-label="Inputs">
          <div>
            <span className="field-label">Fuel</span>
            <Segmented label="Fuel" value={fuel} options={LAB_FUELS.map((f) => ({ value: f, label: f }))} onChange={(v) => set('fuel', v)} />
          </div>
          <Slider label="Oxygen" min={12} max={36} step={0.5} value={Math.round(o2 * 1000) / 10} display={formatPercent(o2)} onChange={(v) => set('lo2', String(v))} />
          <label>
            <span className="field-label">Added gas</span>
            <select className="select" value={family} onChange={(e) => set('gas', e.target.value)}>
              {DILUENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-control bg-surface-2 p-3 text-[14px]">
            {selection.enough && k != null ? (
              <>
                Burning rate K ={' '}
                <SourcedNumber path={[{ kind: 'bin', chart: 'dsquared', key: dropletKey(fuel, o2, family) }]} label={`Burning rate ${formatNumber(k, 3)}, the median of ${selection.tests.length} FLEX tests`}>
                  {formatNumber(k, 3)}
                </SourcedNumber>{' '}
                mm² per second, the median of <span className="num">{selection.tests.length}</span> FLEX tests within 3 points of this oxygen.
              </>
            ) : (
              <strong>Not enough tests near this condition. {selection.tests.length} matched, and three are needed. Nothing is drawn.</strong>
            )}
          </div>
          {withAll.length > 0 ? (
            <label>
              <span className="field-label">Drive it with one FLEX row</span>
              <select className="select" value={chosen?.id ?? ''} onChange={(e) => set('test', e.target.value)}>
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
          <FireballStage compact showEarth={false} droplet={droplet ?? (row ? { scale: 1, flameOn: true } : null)} />
        </section>

        <section className="card p-4 lg:col-span-5" aria-label="Diameter squared against time">
          <ChartFrame title="Diameter squared against time" description={`The d-squared line for ${fuel.toLowerCase()} at ${formatPercent(o2)} oxygen. ${selection.enough ? `The line falls from ${formatNumber(d0 * d0, 2)} square millimetres to zero.` : 'Not enough tests near this condition, so nothing is drawn.'}`} aspect={0.62} minHeight={240} maxHeight={320}>
            {(size) => {
              const box = { l: 46, t: 10, w: Math.max(60, size.width - 58), h: Math.max(60, size.height - 52) }
              const x = scaleLinear().domain([0, tMax]).range([box.l, box.l + box.w])
              const y = scaleLinear().domain([0, d0 * d0 * 1.08]).range([box.t + box.h, box.t])
              const cursorY = y(Math.max(0, d0 * d0 - rate * t))
              return (
                <svg width={size.width} height={size.height} className="absolute inset-0">
                  <Axes x={x} y={y} box={box} xLabel="Time, seconds" yLabel="d², mm²" xTicks={nice(tMax)} yTicks={nice(d0 * d0 * 1.08)} />
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
                      <line x1={x(row.burnTime)} x2={x(row.burnTime)} y1={box.t} y2={box.t + box.h} stroke="var(--warn)" strokeDasharray="3 3" />
                      <text x={x(row.burnTime) - 4} y={box.t + 12} textAnchor="end" fontSize={11} fill="var(--warn)">
                        measured end
                      </text>
                    </g>
                  ) : null}
                  {row && animated ? <circle cx={x(Math.min(t, end))} cy={cursorY} r={5} fill="var(--bg)" stroke="var(--freefall)" strokeWidth={2} /> : null}
                </svg>
              )
            }}
          </ChartFrame>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-freefall" />}>This FLEX row, by the law</LegendItem>
            <LegendItem swatch={<span className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" />}>Median burning rate near this condition</LegendItem>
          </div>
          {row && chosen && modelEnd != null ? (
            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-control bg-surface-2 p-3">
                <p className="eyebrow">Model end time</p>
                <p className="num mt-1 text-[22px] text-freefall">{formatNumber(modelEnd, 2)} s</p>
                <p className="num text-muted">
                  ({formatNumber(row.d0, 2)}² − {formatNumber(row.dExt, 2)}²) ÷ {formatNumber(row.k, 2)}
                </p>
              </div>
              <div className="rounded-control bg-surface-2 p-3">
                <p className="eyebrow">Measured burn time</p>
                <p className="mt-1 text-[22px]">
                  <SourcedNumber path={[{ kind: 'test', id: chosen.id }]} label={`FLEX test ${chosen.label} measured burn time ${formatNumber(row.burnTime, 1)} seconds`}>
                    {formatNumber(row.burnTime, 1)} s
                  </SourcedNumber>
                </p>
                <p className="text-muted">
                  FLEX test {chosen.label}, ended in {String(chosen.outcome).toLowerCase()}
                </p>
              </div>
              <p className="col-span-2 text-muted">The two times are different quantities. The model is never stretched to hide the difference.</p>
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
                <input type="range" className="slider max-w-[220px]" min={0} max={end} step={end / 200} value={Math.min(t, end)} onChange={(e) => (setPlaying(false), setT(Number(e.target.value)))} aria-label="Scrub the burn" />
                <span className="num text-[13px]">
                  t = {formatNumber(t, 2)} s, d = {formatNumber(diameter, 2)} mm
                </span>
              </div>
            ) : (
              <p className="mt-3 rounded-control border border-line px-3 py-2 text-[13px] text-muted">
                The droplet is shown still. The burning rate column lost its unit in the PSI file, and EMBER reads it as mm² per second. The droplet will be animated once the team has confirmed that unit from the publication.
              </p>
            )
          ) : null}
        </section>
      </div>

      <section className="card mt-6 p-4" aria-labelledby="validation-title">
        <h3 id="validation-title" className="text-[18px]">
          Does the law hold on the real tests?
        </h3>
        <p className="prose-width mt-1 text-[14px] text-muted">
          Predicted against measured burn time for the{' '}
          <SourcedNumber path={[{ kind: 'bin', chart: 'validation', key: 'all' }]} label={`${validation.points.length} FLEX tests with all four values`}>
            {validation.points.length}
          </SourcedNumber>{' '}
          FLEX tests that list all four values. The median of predicted over measured is{' '}
          <SourcedNumber path={[{ kind: 'insight', id: 'I4', number: 'medianRatio' }]} label={`Median ratio ${i4?.display.medianRatio}`}>
            {i4?.display.medianRatio ?? formatNumber(validation.median ?? 0, 3)}
          </SourcedNumber>
          . Half of the tests fall between <span className="num">{formatNumber(validation.q1 ?? 0, 3)}</span> and <span className="num">{formatNumber(validation.q3 ?? 0, 3)}</span>. A point on the line means the law predicted that test exactly.
        </p>
        <div className="mt-3 max-w-[640px]">
          <ChartFrame title="Predicted against measured burn time" description={`A scatter of ${validation.points.length} FLEX tests. Most points sit just under the one to one line.`} aspect={0.8} minHeight={280} maxHeight={480}>
            {(size) => {
              const box = { l: 46, t: 10, w: Math.max(60, size.width - 58), h: Math.max(60, size.height - 52) }
              const max = Math.max(...validation.points.map((p) => Math.max(p.predicted, p.measured)), 1) * 1.05
              const x = scaleLinear().domain([0, max]).range([box.l, box.l + box.w])
              const y = scaleLinear().domain([0, max]).range([box.t + box.h, box.t])
              return (
                <svg width={size.width} height={size.height} className="absolute inset-0">
                  <Axes x={x} y={y} box={box} xLabel="Measured burn time, seconds" yLabel="Predicted, seconds" xTicks={nice(max)} yTicks={nice(max)} />
                  <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="var(--muted)" strokeDasharray="4 4" aria-hidden="true" />
                  {validation.points.map((p) => {
                    const test = data.testById.get(p.testId) as Test
                    return (
                      <circle
                        key={p.testId}
                        cx={x(p.measured)}
                        cy={y(p.predicted)}
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
                </svg>
              )
            }}
          </ChartFrame>
        </div>
      </section>

      <Limits>
        <li>The law assumes a round, steady flame around one droplet. Disrupted droplets and cool flames do not follow it.</li>
        <li>The burning rate column lost its unit in the file. EMBER reads it as mm² per second. The team confirms this from the publication.</li>
        <li>The burning rate is a median over nearby tests. It mixes pressures and droplet sizes.</li>
        <li>The flame's size and colour in the picture are not inferred from the data. Only the droplet's size follows the row.</li>
        <li>A visible flame going out does not prove that all burning has stopped.</li>
      </Limits>
    </div>
  )
}

// Lab tool 2.
function ExtinctionExplorer() {
  const data = useData()
  const props = useDrillProps()
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
      <p className="prose-width text-muted">
        The extinction ratio is the diameter at which the visible flame went out, divided by the starting diameter. Near 1 means the flame went out almost at once. 0 means the droplet burned away. Each point is one FLEX test. The line joins the median of each oxygen bin, and the number on each bin is its count of tests.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {LAB_FUELS.map((fuel) => {
          const points = extinctionPoints(data.tests, fuel)
          const bins = extinctionBins(data.tests, fuel)
          return (
            <section key={fuel} className="card p-4" aria-label={`${fuel} extinction panel`}>
              <ChartFrame title={`${fuel}, ${points.length} tests`} description={`Extinction ratio against oxygen for ${points.length} ${fuel.toLowerCase()} droplet tests, with a binned median line.`} aspect={0.72} minHeight={280} maxHeight={420}>
                {(size) => {
                  const box = { l: 46, t: 22, w: Math.max(60, size.width - 58), h: Math.max(60, size.height - 64) }
                  const x = scaleLinear().domain([10, 38]).range([box.l, box.l + box.w])
                  const y = scaleLinear().domain([0, 1.05]).range([box.t + box.h, box.t])
                  const line = bins.filter((b) => b.median != null).map((b, i) => `${i === 0 ? 'M' : 'L'}${x(((b.min + b.max) / 2) * 100).toFixed(1)},${y(b.median as number).toFixed(1)}`).join('')
                  return (
                    <svg width={size.width} height={size.height} className="absolute inset-0">
                      <Axes x={x} y={y} box={box} xLabel="Oxygen" yLabel="Extinction ratio" xTicks={[10, 14, 18, 22, 26, 30, 34, 38]} yTicks={[0, 0.25, 0.5, 0.75, 1]} xFormat={(v) => `${v}%`} />
                      {bins.map((b) => (
                        <g key={b.key} className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'bin', chart: 'extinction', key: b.key }], `${b.testIds.length} ${fuel.toLowerCase()} tests at ${formatPercent(b.min, 0)} to ${formatPercent(b.max, 0)} oxygen${b.median != null ? `, median extinction ratio ${formatNumber(b.median, 2)}` : ''}. Press Enter for the rows.`)}>
                          <rect x={x(b.min * 100)} y={box.t} width={x(b.max * 100) - x(b.min * 100)} height={box.h} fill="var(--freefall)" fillOpacity={b.index % 2 === 0 ? 0.04 : 0.0} />
                          <text x={(x(b.min * 100) + x(b.max * 100)) / 2} y={box.t - 6} textAnchor="middle" fontSize={11} fill={b.testIds.length === 0 ? 'var(--gap)' : 'var(--ink)'} className="num">
                            {b.testIds.length}
                          </text>
                        </g>
                      ))}
                      {points.map((p) => {
                        const style = FAMILY_STYLE[p.family]
                        return <path key={p.testId} d={shapePath(style.shape, 3.2)} transform={`translate(${x(p.o2 * 100).toFixed(1)},${y(p.ratio).toFixed(1)})`} fill={style.color} fillOpacity={0.7} data-drill={`test.${p.testId}`} {...{ onClick: props([{ kind: 'test', id: p.testId }], '').onClick }} className="drillable" />
                      })}
                      <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
                      {bins.filter((b) => b.median != null).map((b) => (
                        <circle key={b.key} cx={x(((b.min + b.max) / 2) * 100)} cy={y(b.median as number)} r={4} fill="var(--ink)" pointerEvents="none" />
                      ))}
                    </svg>
                  )
                }}
              </ChartFrame>
            </section>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {DILUENT_FAMILIES.map((f) => (
          <LegendItem key={f} swatch={<svg width="12" height="12" viewBox="-6 -6 12 12"><path d={shapePath(FAMILY_STYLE[f].shape, 4)} fill={FAMILY_STYLE[f].color} /></svg>}>
            {f[0].toUpperCase() + f.slice(1)}
          </LegendItem>
        ))}
        <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-ink" />}>Median of each oxygen bin</LegendItem>
      </div>

      <section className="card mt-6 p-4" aria-labelledby="takeaways-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="takeaways-title" className="text-[18px]">
            What the plot shows
          </h3>
          <SiTag />
        </div>
        <ul className="m-0 mt-3 flex list-disc flex-col gap-2 pl-5 text-[14px]">
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
      </section>

      <Limits>
        <li>The points mix pressures from about 0.7 to 3 atmospheres and droplet sizes. A bin median is a direction, not a limit.</li>
        <li>A comparison between added gases is only stated where a bin holds at least five tests of each.</li>
        <li>Tests with no extinction diameter in the table are not plotted.</li>
        <li>Background on cool flames, where a droplet keeps burning with no visible flame, is on the <ScenarioLink to="/investigations/PSI-39">CFI</ScenarioLink> and <ScenarioLink to="/investigations/PSI-69">FLEX</ScenarioLink> pages.</li>
      </Limits>
    </div>
  )
}

// Lab tool 3.
function GravityBounds() {
  const data = useData()
  const props = useDrillProps()
  const pairs = useMemo(() => burnLengthPairs(data.tests), [data.tests])
  const max = Math.max(...pairs.map((p) => Math.max(p.ug ?? 0, p.g1 ?? 0)), 1)
  const i7 = data.insightById.I7
  return (
    <div>
      <p className="prose-width text-muted">
        Saffire-II burned the same samples in microgravity and in normal gravity. For each sample, the two burn lengths bound what could happen at a gravity level in between. The band between them is marked unknown, bounded.
      </p>
      <section className="card mt-6 p-4" aria-label="Burn length pairs">
        <ChartFrame title="Burn length in microgravity and in normal gravity" description={`${pairs.length} Saffire-II samples, each with a microgravity point and a normal gravity point joined by a band.`} aspect={0.5} minHeight={pairs.length * 38 + 60} maxHeight={pairs.length * 44 + 70}>
          {(size) => {
            const box = { l: Math.min(230, size.width * 0.42), t: 8, w: 0, h: Math.max(60, size.height - 48) }
            box.w = Math.max(60, size.width - box.l - 16)
            const x = scaleLinear().domain([0, max * 1.05]).range([box.l, box.l + box.w])
            const rowH = box.h / pairs.length
            return (
              <svg width={size.width} height={size.height} className="absolute inset-0">
                <g aria-hidden="true">
                  {nice(max * 1.05, 6).map((t) => (
                    <g key={t}>
                      <line x1={x(t)} x2={x(t)} y1={box.t} y2={box.t + box.h} stroke="var(--line)" strokeOpacity={0.5} />
                      <text x={x(t)} y={box.t + box.h + 14} textAnchor="middle" fontSize={11} fill="var(--muted)" className="num">
                        {t}
                      </text>
                    </g>
                  ))}
                  <text x={box.l + box.w / 2} y={box.t + box.h + 32} textAnchor="middle" fontSize={12} fill="var(--muted)">
                    Burn length, cm
                  </text>
                </g>
                {pairs.map((p, i) => {
                  const cy = box.t + rowH * (i + 0.5)
                  const both = p.ug != null && p.g1 != null
                  return (
                    <g key={p.testId} className="drillable" tabIndex={-1} data-nav="" {...props([{ kind: 'bin', chart: 'burnLength', key: p.testId }], `Saffire-II sample ${p.label}, ${p.material}: microgravity burn length ${p.ugRaw}, normal gravity ${p.g1Raw}. Press Enter for the row.`)}>
                      <rect x={0} y={cy - rowH / 2} width={size.width} height={rowH} fill="transparent" />
                      <text x={8} y={cy - 2} fontSize={12} fill="var(--ink)" fontWeight={600}>
                        {p.label} {p.material.length > 24 ? `${p.material.slice(0, 23)}…` : p.material}
                      </text>
                      <text x={8} y={cy + 12} fontSize={11} fill="var(--muted)">
                        {p.thickness} {p.mixed ? '· two materials' : ''}
                      </text>
                      {both ? <rect x={Math.min(x(p.ug as number), x(p.g1 as number))} y={cy - 6} width={Math.max(2, Math.abs(x(p.g1 as number) - x(p.ug as number)))} height={12} rx={6} fill="var(--warn)" fillOpacity={0.22} stroke="var(--warn)" strokeDasharray="3 3" strokeOpacity={0.7} /> : null}
                      {p.ug != null ? <circle cx={x(p.ug)} cy={cy} r={6} fill="var(--freefall)" /> : null}
                      {p.g1 != null ? <path d={shapePath('diamond', 6)} transform={`translate(${x(p.g1)},${cy})`} fill="var(--ember)" /> : null}
                    </g>
                  )
                })}
              </svg>
            )
          }}
        </ChartFrame>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <LegendItem swatch={<span className="inline-block h-3 w-3 rounded-full bg-freefall" />}>Microgravity</LegendItem>
          <LegendItem swatch={<svg width="12" height="12" viewBox="-7 -8 14 16"><path d={shapePath('diamond', 6)} fill="var(--ember)" /></svg>}>Normal gravity</LegendItem>
          <LegendItem swatch={<span className="inline-block h-3 w-6 rounded-full border border-dashed border-warn" />}>Unknown, bounded</LegendItem>
        </div>
        <p className="prose-width mt-4 text-[14px]">
          No partial-gravity test data exists in PSI yet. The Lunar-g Combustion Investigation and the Flammability of Materials on the Moon experiment are expected to add it. Source: the challenge statement.
        </p>
        {i7 ? (
          <p className="prose-width mt-2 text-[14px] text-muted">
            {i7.headline}{' '}
            <SourcedNumber path={[{ kind: 'insight', id: 'I7', number: 'shorterInMicrogravity' }]} label="The rows behind this count">
              Rows
            </SourcedNumber>
          </p>
        ) : null}
        <p className="prose-width mt-2 text-[14px] text-muted">
          The challenge statement also notes that the ACME E-FIELD Flames experiment mimicked partial gravity through the pull of an electric field on the ions in a flame. <ScenarioLink to="/investigations/PSI-22">Open ACME E-FIELD Flames</ScenarioLink>
        </p>
      </section>
      <Limits>
        <li>This is {pairs.length} samples at one flow speed and one oxygen level, close to cabin air. It bounds the question and does not settle it.</li>
        <li>The table gives lengths as text. "Complete" is read as the full sample length and "~ 10 cm" as 10 cm.</li>
        <li>A gravity level between zero and one may not behave like a point between the two. No slider between them is offered.</li>
        <li>One sample holds two materials and its two lengths describe different parts of it.</li>
      </Limits>
    </div>
  )
}

export default function Lab() {
  const { tool = 'droplet' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const active = TOOLS.some((t) => t.value === tool) ? tool : 'droplet'
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="page" ref={ref}>
      <PageHeader title="Lab" lead="Three simple models, each fitted to the real test tables and checked against them. Every mark opens the tests behind it." />
      <div className="mb-6 overflow-x-auto">
        <Segmented label="Lab tool" value={active} options={TOOLS} onChange={(v) => navigate(`/lab/${v}${scenarioQuery(params)}`, { preventScrollReset: true })} />
      </div>
      {active === 'droplet' ? <DropletCalculator /> : null}
      {active === 'extinction' ? <ExtinctionExplorer /> : null}
      {active === 'gravity' ? <GravityBounds /> : null}
    </div>
  )
}
