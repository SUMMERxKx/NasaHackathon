// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The dashboard. It leads with counts: how many NASA test records sit near the chosen habitat, in
// all and by fuel class, with one statement of what is missing and the caveats beside it. Then the
// three investigations to read first, and the atmosphere map for anyone who wants to explore.
// The coverage score, the flame picture and the general findings live in About and the Lab.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Flame, Focus, Gauge, Lightbulb, Play, SlidersHorizontal, Sun, Table2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card.tsx'
import type { Test } from '../types.ts'
import { distance } from '../lib/coverage.ts'
import { FUEL_CLASSES, encodeZoom, parseZoom, plottable } from '../lib/mapLayout.ts'
import type { MapDomain } from '../lib/mapLayout.ts'
import { NEARBY_FUELS, gapStatement, nearbyReason, summarizeNearby } from '../lib/nearby.ts'
import type { NearbySummary } from '../lib/nearby.ts'
import { makeScope, scopeActive, scopeLabel, scopeStep, scopeTests } from '../lib/mapScope.ts'
import { isFlightInvestigation } from '../lib/ranking.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useDrill, useRanking, useScenario } from '../state/hooks.ts'
import { gravityLabel, isPartialGravity } from '../state/scenario.ts'
import { AtmosphereMap, MapLegend } from '../components/AtmosphereMap.tsx'
import { DataTable } from '../components/DataTable.tsx'
import type { Column } from '../components/DataTable.tsx'
import { oxygenText, pressureText } from '../components/DrillPanel.tsx'
import { NearbyCounts } from '../components/NearbyCounts.tsx'
import { PILLAR_NAME } from '../components/cards.tsx'
import { Chip, ScenarioLink, SourcedNumber } from '../components/ui.tsx'

const PILLAR_FILTERS = ['prevention', 'detection', 'suppression', 'fundamentals']
const NEAR_CLASSES = FUEL_CLASSES.filter((c) => c.id !== 'unknown')

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
  // The coverage glow is a scientific layer drawn as a soft glow, so it waits to be asked for.
  const field = params.get('field') === '1'
  const zoomParam = params.get('zoom')
  const zoom = zoomParam === 'moon'
  const zoomView = useMemo(() => parseZoom(zoomParam), [zoomParam])
  // One scope for the heading, the table and everything on the map, drills included.
  const scope = useMemo(() => makeScope({ pillar, fuel, inv, hw }), [pillar, fuel, inv, hw])
  const filtered = scopeActive(scope)
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
  const onZoom = useCallback((next: MapDomain | null) => set('zoom', next ? encodeZoom(next) : ''), [set])
  const plotted = useMemo(() => data.tests.filter(plottable), [data.tests])
  const shown = useMemo(() => scopeTests(plotted, invByAcc, scope), [plotted, invByAcc, scope])
  const drillScope = useMemo(() => scopeStep(scope), [scope])
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
      <button type="button" className="chip" aria-pressed={field} onClick={() => set('field', field ? '' : '1')} title="Glow where NASA has flown tests. Off unless chosen.">
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
    <section id="atmosphere-map" className="card scroll-mt-24 p-3 md:p-4 lg:col-span-12" aria-label="Atmosphere map">
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
          tests={shown}
          scope={drillScope}
          showField={field}
          zoomMoon={zoom}
          zoom={zoomView}
          onZoom={onZoom}
          dragRing
          title={`${shown.length} of ${plotted.length} tests`}
          toolbar={toolbar}
          footer={
            <div className="mt-2 flex flex-col gap-1.5">
              <MapLegend />
              {filtered ? (
                <p className="text-[12px] text-muted">
                  Only the {shown.length} tests of the filter are drawn: {scopeLabel(scope, invByAcc, data.hardwareName)}. The Moon Base counts and every drill count these tests only.
                </p>
              ) : null}
            </div>
          }
        />
      )}
    </section>
  )
}

// The one statement of what sits near the habitat and what is missing, built from the counts.
function GapStatement({ summary }: { summary: NearbySummary }) {
  const { scenario } = useScenario()
  const lines = gapStatement(summary, isPartialGravity(scenario.gravity))
  const gap = summary.total === 0 || NEARBY_FUELS.some((fuel) => summary.byFuel[fuel] === 0) || isPartialGravity(scenario.gravity)
  return (
    <section className={`card border-l-2 p-4 md:p-5 lg:col-span-12 ${gap ? 'border-l-gap' : 'border-l-line'}`} aria-labelledby="gap-title">
      <p className="stat-label">What is near this habitat, and what is missing</p>
      <h2 id="gap-title" className="mt-1.5 max-w-[46ch] text-[20px] leading-snug md:text-[24px]">
        {lines.join(' ')}
      </h2>
      <p className="mt-2 text-[13px] text-muted">
        Evidence is matched on oxygen and pressure only. Gravity does not change these counts.{' '}
        {isPartialGravity(scenario.gravity) ? <ScenarioLink to="/about?section=limits">What the snapshot cannot say about Moon or Mars gravity</ScenarioLink> : null}
      </p>
    </section>
  )
}

// The three investigations to read first. Each shows how many of its rows are nearby, and an
// investigation with none is named as background evidence.
function TopInvestigations({ summary }: { summary: NearbySummary }) {
  const { invByAcc, snapshot } = useData()
  const { point } = useScenario()
  const ranking = useRanking()
  const none = summary.total === 0
  return (
    <Card className="lg:col-span-5" role="region" aria-labelledby="top-title">
      <CardHeader className="min-h-auto border-0 pb-0 pt-5">
        <CardTitle id="top-title" className="stat-label !font-medium">
          {none ? 'Background investigations' : 'Start with these investigations'}
        </CardTitle>
        <CardToolbar>
          <ScenarioLink to="/investigations" className="inline-flex items-center gap-1 text-[13px]">
            All {snapshot.investigations.length} <ArrowRight size={13} aria-hidden="true" />
          </ScenarioLink>
        </CardToolbar>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-3">
        {none ? <p className="mb-2 text-[14px]">No nearby test records. Background investigations below.</p> : null}
        <ol className="m-0 flex list-none flex-col p-0">
          {ranking.slice(0, 3).map((r, i) => {
            const inv = invByAcc[r.accession]
            return (
              <li key={r.accession} className="flex items-center gap-2 border-b border-line last:border-b-0">
                <ScenarioLink to={`/investigations/${inv.accession}`} className="row-link min-w-0 flex-1 !items-start">
                  <span className="num w-4 shrink-0 pt-0.5 text-[12px] text-faint" aria-label={`Rank ${i + 1}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{inv.displayName}</span>
                    <span className="block text-[13px] text-muted">{nearbyReason(r.nearbyCount, inv.testCount, inv.fuelClass, isFlightInvestigation(inv))}</span>
                  </span>
                </ScenarioLink>
                {r.nearbyCount > 0 ? (
                  <span className="shrink-0 text-right text-[12px] text-muted">
                    <SourcedNumber
                      path={[{ kind: 'near', o2: point.o2, pressureAtm: point.pressureAtm }, { kind: 'investigation', accession: inv.accession }]}
                      label={`${r.nearbyCount} nearby ${r.nearbyCount === 1 ? 'row' : 'rows'} of ${inv.displayName}`}
                      className="block text-[18px] text-ink"
                    >
                      {r.nearbyCount}
                    </SourcedNumber>
                    nearby {r.nearbyCount === 1 ? 'row' : 'rows'}
                  </span>
                ) : (
                  <span className="chip shrink-0">Background</span>
                )}
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-[12px] text-muted">
          The order is EMBER's relevance ranking. It is a heuristic, not a measure of confidence. <ScenarioLink to="/about?section=formulas">How it ranks</ScenarioLink>
        </p>
      </CardContent>
    </Card>
  )
}

// What used to sit on this screen and where it lives now. Nothing was removed.
function MoreLinks() {
  return (
    <nav className="card flex flex-wrap items-center gap-2 px-4 py-3 lg:col-span-12" aria-label="More for this habitat">
      <ScenarioLink to="/lab/flame" className="btn btn-secondary btn-sm">
        <Flame size={14} aria-hidden="true" /> Explore flame behaviour
      </ScenarioLink>
      <ScenarioLink to="/about?section=coverage" className="btn btn-secondary btn-sm">
        <Gauge size={14} aria-hidden="true" /> Coverage score and method
      </ScenarioLink>
      <ScenarioLink to="/about?section=findings" className="btn btn-secondary btn-sm">
        <Lightbulb size={14} aria-hidden="true" /> All findings
      </ScenarioLink>
    </nav>
  )
}

export default function Dashboard() {
  const { tests } = useData()
  const { scenario, point, name } = useScenario()
  const [params] = useSearchParams()
  const summary = useMemo(() => summarizeNearby(tests, point), [tests, point])
  // A tour step that is about the map brings the map into view. Every other step starts at the top.
  const story = params.get('story')
  const onMap = params.get('zoom') === 'moon'
  useEffect(() => {
    if (!story) return
    if (onMap) document.getElementById('atmosphere-map')?.scrollIntoView({ block: 'center' })
    else window.scrollTo({ top: 0 })
  }, [story, onMap])
  return (
    <div className="page">
      <header className="page-head !flex-row flex-wrap items-end justify-between">
        <div className="min-w-0">
          <p className="stat-label">Habitat</p>
          <h1 id="page-title" tabIndex={-1} className="text-[26px] outline-none md:text-[32px]">
            {name}
          </h1>
          <p className="num mt-1 text-[13px] text-muted">
            {formatPercent(scenario.o2)} oxygen · {formatNumber(scenario.pressurePsi, 1)} psi · {gravityLabel(scenario.gravity)}
          </p>
        </div>
        <ScenarioLink to="/dashboard" extra={{ story: '1' }} className="btn btn-secondary btn-sm">
          <Play size={14} aria-hidden="true" /> Tour
        </ScenarioLink>
      </header>
      <div className="grid gap-4 lg:grid-cols-12">
        <GapStatement summary={summary} />
        <div className="lg:col-span-7">
          <NearbyCounts summary={summary} point={point} name={name} />
        </div>
        <TopInvestigations summary={summary} />
        <MoreLinks />
        <MapCard />
      </div>
    </div>
  )
}
