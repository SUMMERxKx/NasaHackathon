// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The dashboard: one screen around the map. The habitat picker in the top bar changes all of it:
// the ring on the map, the coverage score, the fireball and the most relevant investigations.
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Focus, Play, SlidersHorizontal, Sun, Table2 } from 'lucide-react'
import type { FuelClass, Test } from '../types.ts'
import { distance } from '../lib/coverage.ts'
import { FUEL_CLASSES, plottable } from '../lib/mapLayout.ts'
import { useData } from '../state/data.tsx'
import { useCoverage, useDrill, useRanking, useScenario } from '../state/hooks.ts'
import { gravityLabel, isPartialGravity } from '../state/scenario.ts'
import { AtmosphereMap, MapLegend } from '../components/AtmosphereMap.tsx'
import { CoverageDial, PillarMini, bar } from '../components/Coverage.tsx'
import { DataTable } from '../components/DataTable.tsx'
import type { Column } from '../components/DataTable.tsx'
import { oxygenText, pressureText } from '../components/DrillPanel.tsx'
import { FireballStage } from '../components/FireballStage.tsx'
import { habitatFacts } from '../components/Habitat.tsx'
import { PILLAR_NAME, Thumb, surfaceInsights } from '../components/cards.tsx'
import { Chip, NotASafetyRating, ScenarioLink, SourcedNumber } from '../components/ui.tsx'

const PILLAR_FILTERS = ['prevention', 'detection', 'suppression', 'fundamentals']
const NEAR_CLASSES = FUEL_CLASSES.filter((c) => c.id !== 'unknown')
export const NO_PARTIAL_GRAVITY = 'PSI holds no partial-gravity tests'

function MapCard() {
  const data = useData()
  const { snapshot, invByAcc } = data
  const { point } = useScenario()
  const [params, setParams] = useSearchParams()
  const { open } = useDrill()
  const pillar = params.get('pillar') ?? ''
  const fuel = params.get('fuel') ?? ''
  const inv = params.get('inv') ?? ''
  const hw = params.get('hw') ?? ''
  const table = params.get('view') === 'table'
  const field = params.get('field') !== '0'
  const zoom = params.get('zoom') === 'moon'
  const filtered = Boolean(pillar || fuel || inv || hw)
  const [showFilters, setShowFilters] = useState(filtered)
  const set = useCallback(
    (key: string, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === '') next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )
  const matches = useCallback(
    (t: Test) => {
      const i = invByAcc[t.accession]
      if (pillar && i.pillar !== pillar && !i.secondaryPillars.includes(pillar as never)) return false
      if (fuel && t.fuelClass !== fuel) return false
      if (inv && t.accession !== inv) return false
      if (hw && i.hardwareFamily !== hw) return false
      return true
    },
    [pillar, fuel, inv, hw, invByAcc],
  )
  const dim = useMemo(() => (filtered ? (t: Test) => !matches(t) : undefined), [filtered, matches])
  const plotted = useMemo(() => data.tests.filter(plottable), [data.tests])
  const shown = useMemo(() => plotted.filter(matches), [plotted, matches])
  const columns: Column<Test>[] = [
    { key: 'inv', header: 'Investigation', cell: (t) => invByAcc[t.accession].displayName, sort: (t) => invByAcc[t.accession].displayName },
    { key: 'label', header: 'Test', cell: (t) => t.label, sort: (t) => t.label },
    { key: 'fuel', header: 'Fuel or material', cell: (t) => t.fuel ?? 'not stated', sort: (t) => t.fuel },
    { key: 'class', header: 'Class', cell: (t) => t.fuelClass, sort: (t) => t.fuelClass },
    { key: 'o2', header: 'Oxygen', cell: (t) => oxygenText(t), sort: (t) => t.o2, numeric: true },
    { key: 'p', header: 'Pressure', cell: (t) => pressureText(t), sort: (t) => t.pressureAtm, numeric: true },
    { key: 'd', header: 'Distance', title: 'Distance from your habitat in coverage units', cell: (t) => (distance(t, point) ?? 0).toFixed(2), sort: (t) => distance(t, point), numeric: true },
  ]
  const toolbar = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map options">
      <button type="button" className="chip" aria-pressed={field} onClick={() => set('field', field ? '0' : '')} title="Glow where NASA has flown tests">
        <Sun size={13} aria-hidden="true" /> Coverage
      </button>
      <button type="button" className="chip" aria-pressed={zoom} onClick={() => set('zoom', zoom ? '' : 'moon')} title="Zoom to the Moon Base region">
        <Focus size={13} aria-hidden="true" /> Moon zoom
      </button>
      <button type="button" className="chip" aria-pressed={table} onClick={() => set('view', table ? '' : 'table')}>
        <Table2 size={13} aria-hidden="true" /> Table
      </button>
      <button type="button" className={`chip ${filtered ? 'chip-on' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
        <SlidersHorizontal size={13} aria-hidden="true" /> Filters
      </button>
    </div>
  )
  return (
    <section className="card p-3 md:p-4 lg:col-span-8" aria-label="Atmosphere map">
      {showFilters ? (
        <div className="mb-3 flex flex-col gap-2 border-b border-line pb-3" role="group" aria-label="Map filters">
          <div className="flex flex-wrap items-center gap-1.5">
            {PILLAR_FILTERS.map((p) => (
              <Chip key={p} pressed={pillar === p} onClick={() => set('pillar', pillar === p ? '' : p)}>
                {PILLAR_NAME[p]}
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
            {NEAR_CLASSES.map((c) => (
              <Chip key={c.id} pressed={fuel === c.id} onClick={() => set('fuel', fuel === c.id ? '' : c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select !min-h-9 sm:!w-56" name="inv" aria-label="Investigation" value={inv} onChange={(e) => set('inv', e.target.value)}>
              <option value="">All investigations</option>
              {snapshot.investigations.filter((i) => i.testCount > 0).map((i) => (
                <option key={i.accession} value={i.accession}>
                  {i.displayName}
                </option>
              ))}
            </select>
            <select className="select !min-h-9 sm:!w-64" name="hw" aria-label="Hardware" value={hw} onChange={(e) => set('hw', e.target.value)}>
              <option value="">All hardware</option>
              {snapshot.hardwareFamilies.filter((f) => f.id !== 'ground').map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {table ? (
        <>
          <div className="panel-head">
            <span className="font-display text-[16px] font-semibold">
              {shown.length} of {plotted.length} tests
            </span>
            {toolbar}
          </div>
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(t) => t.id}
            onRow={(t) => open([{ kind: 'test', id: t.id }])}
            rowLabel={(t) => `${invByAcc[t.accession].displayName} test ${t.label}. Press Enter for the NASA row.`}
            rowProps={(t) => ({ 'data-drill': `test.${t.id}` })}
            caption="Every plotted test as a table. Choose a row to open it."
            initialSort={{ key: 'd', dir: 1 }}
            maxRows={100}
          />
        </>
      ) : (
        <AtmosphereMap
          tests={plotted}
          dim={dim}
          showField={field}
          zoomMoon={zoom}
          dragRing
          title={`${shown.length} of ${plotted.length} tests`}
          toolbar={toolbar}
          footer={
            <div className="mt-2">
              <MapLegend />
            </div>
          }
        />
      )}
    </section>
  )
}

function CoverageCard() {
  const { scenario, point, name } = useScenario()
  const coverage = useCoverage()
  return (
    <section className="card p-4" aria-label="Evidence coverage">
      <div className="flex items-center gap-4">
        <CoverageDial coverage={coverage} size={120} label={name} />
        <div className="min-w-0 flex-1">
          <p className="stat-label">Evidence coverage</p>
          <NotASafetyRating className="mt-0.5 !text-[10px]" />
          <p className="mt-2 text-[13px] text-muted">
            <SourcedNumber path={[{ kind: 'near', o2: scenario.o2, pressureAtm: point.pressureAtm }]} label={`${coverage.nearbyTotal} tests within one unit of this habitat`} className="text-[20px] text-ink">
              {coverage.nearbyTotal}
            </SourcedNumber>{' '}
            tests nearby
          </p>
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 text-[12px]" aria-label="Nearby tests by fuel class">
            {NEAR_CLASSES.map((c) => {
              const n = coverage.nearbyByFuelClass[c.id as FuelClass] ?? 0
              return (
                <li key={c.id} className="inline-flex items-center gap-1" title={`${c.label}: ${n} nearby`}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: `var(--fuel-${c.id})` }} aria-hidden="true" />
                  <span className="sr-only">{c.label}</span>
                  <span className={`num ${n === 0 ? 'text-gap' : ''}`}>{n}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className="mt-3">
        <PillarMini coverage={coverage} />
      </div>
    </section>
  )
}

function TopInvestigations() {
  const { invByAcc, snapshot } = useData()
  const ranking = useRanking()
  return (
    <section className="card p-4 lg:col-span-7" aria-labelledby="top-title">
      <div className="panel-head !mb-2">
        <h2 id="top-title" className="stat-label">
          Most relevant investigations
        </h2>
        <ScenarioLink to="/investigations" className="inline-flex items-center gap-1 text-[13px]">
          All {snapshot.investigations.length} <ArrowRight size={13} aria-hidden="true" />
        </ScenarioLink>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {ranking.slice(0, 5).map((r, i) => {
          const inv = invByAcc[r.accession]
          return (
            <li key={r.accession}>
              <ScenarioLink to={`/investigations/${inv.accession}`} className="row-link">
                <span className="num w-4 shrink-0 text-[12px] text-faint">{i + 1}</span>
                <Thumb inv={inv} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{inv.displayName}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {PILLAR_NAME[inv.pillar]} · {inv.testCount} tests
                  </span>
                </span>
                <span className="hidden h-1.5 w-20 overflow-hidden bg-line sm:block" aria-hidden="true">
                  <span className="block h-full bg-ember" style={bar(r.score)} />
                </span>
                <span className="num w-7 shrink-0 text-right text-[15px] text-ink" title="Relevance, out of 100">
                  {Math.round(r.score)}
                </span>
              </ScenarioLink>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Findings() {
  const data = useData()
  const { scenario } = useScenario()
  const cards = useMemo(() => surfaceInsights(data.insights, scenario).slice(0, 3), [data.insights, scenario])
  return (
    <section className="grid gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1 xl:grid-cols-3" aria-label="Key findings">
      {cards.map((card) => (
        <article key={card.id} className={`card flex flex-col gap-1.5 p-4 ${card.pillar === 'gap' ? 'border-l-2 border-l-gap' : ''}`}>
          <span className="stat-label">{PILLAR_NAME[card.pillar]}</span>
          <p className="text-[28px] leading-none">
            <SourcedNumber path={[{ kind: 'insight', id: card.id, number: card.primary }]} label={`${card.display[card.primary]}. ${card.headline}`}>
              {card.display[card.primary]}
            </SourcedNumber>
          </p>
          <p className="text-[13px] leading-snug text-muted">{card.headline}</p>
        </article>
      ))}
    </section>
  )
}

export default function Dashboard() {
  const { scenario, name } = useScenario()
  return (
    <div className="page">
      <header className="page-head !flex-row flex-wrap items-end justify-between">
        <div className="min-w-0">
          <p className="stat-label">Habitat</p>
          <h1 id="page-title" tabIndex={-1} className="text-[26px] outline-none md:text-[32px]">
            {name}
          </h1>
          <p className="num mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span>
              {habitatFacts(scenario)} · {gravityLabel(scenario.gravity)}
            </span>
            {isPartialGravity(scenario.gravity) ? (
              <span className="chip chip-warn" title="Microgravity and normal gravity results bound what happens in between.">
                {NO_PARTIAL_GRAVITY}
              </span>
            ) : null}
          </p>
        </div>
        <ScenarioLink to="/dashboard" extra={{ story: '1' }} className="btn btn-secondary btn-sm">
          <Play size={14} aria-hidden="true" /> Tour
        </ScenarioLink>
      </header>
      <div className="grid gap-4 lg:grid-cols-12">
        <MapCard />
        <div className="flex flex-col gap-4 lg:col-span-4">
          <CoverageCard />
          <section className="card p-4" aria-label="The fireball for this habitat">
            <FireballStage />
          </section>
        </div>
        <TopInvestigations />
        <Findings />
      </div>
    </div>
  )
}
