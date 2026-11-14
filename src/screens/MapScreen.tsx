// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Atmosphere Map screen: every test as a mark, with filters, the ring, the region and a table view.
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Focus, Sun, Table2 } from 'lucide-react'
import type { FuelClass, Test } from '../types.ts'
import { distance } from '../lib/coverage.ts'
import { FUEL_CLASSES, plottable } from '../lib/mapLayout.ts'
import { byAccession, groupBy } from '../lib/stats.ts'
import { useData } from '../state/data.tsx'
import { useCoverage, useScenario } from '../state/hooks.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { AtmosphereMap, MapLegend } from '../components/AtmosphereMap.tsx'
import { CoverageDial } from '../components/Coverage.tsx'
import { DataTable } from '../components/DataTable.tsx'
import type { Column } from '../components/DataTable.tsx'
import { oxygenText, pressureText } from '../components/DrillPanel.tsx'
import { PILLAR_NAME } from '../components/cards.tsx'
import { Chip, NotASafetyRating, ScenarioLink, SourcedNumber, useDrillProps } from '../components/ui.tsx'
import { useDrill } from '../state/hooks.ts'

const PILLAR_FILTERS = ['prevention', 'detection', 'suppression', 'fundamentals']

export default function MapScreen() {
  const data = useData()
  const { snapshot, invByAcc } = data
  const { scenario, point, name } = useScenario()
  const coverage = useCoverage()
  const [params, setParams] = useSearchParams()
  const { open } = useDrill()
  const drill = useDrillProps()
  const pillar = params.get('pillar') ?? ''
  const fuel = params.get('fuel') ?? ''
  const inv = params.get('inv') ?? ''
  const hw = params.get('hw') ?? ''
  const table = params.get('view') === 'table'
  const field = params.get('field') !== '0'
  const zoom = params.get('zoom') === 'moon'
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
  const filtered = Boolean(pillar || fuel || inv || hw)
  const dim = useMemo(() => (filtered ? (t: Test) => !matches(t) : undefined), [filtered, matches])
  const plotted = useMemo(() => data.tests.filter(plottable), [data.tests])
  const shown = useMemo(() => plotted.filter(matches), [plotted, matches])
  const unplotted = useMemo(() => groupBy(data.tests.filter((t) => !plottable(t)), (t) => t.accession), [data.tests])
  const nearest = coverage.nearest.map((n) => ({ ...n, test: data.testById.get(n.testId) as Test }))
  const nearClasses = FUEL_CLASSES.filter((c) => c.id !== 'unknown')

  const columns: Column<Test>[] = [
    { key: 'inv', header: 'Investigation', cell: (t) => invByAcc[t.accession].displayName, sort: (t) => invByAcc[t.accession].displayName },
    { key: 'label', header: 'Test', cell: (t) => t.label, sort: (t) => t.label },
    { key: 'fuel', header: 'Fuel or material', cell: (t) => t.fuel ?? 'not stated', sort: (t) => t.fuel },
    { key: 'class', header: 'Class', cell: (t) => t.fuelClass, sort: (t) => t.fuelClass },
    { key: 'o2', header: 'Oxygen', cell: (t) => oxygenText(t), sort: (t) => t.o2, numeric: true },
    { key: 'p', header: 'Pressure', cell: (t) => pressureText(t), sort: (t) => t.pressureAtm, numeric: true },
    { key: 'd', header: 'Distance', title: 'Distance from your habitat in coverage units', cell: (t) => (distance(t, point) ?? 0).toFixed(2), sort: (t) => distance(t, point), numeric: true },
  ]

  return (
    <div className="page">
      <PageHeader title="Atmosphere Map" lead="Every mark is one real NASA flight test, placed by the oxygen and pressure it ran at. The ring is your habitat. Dark means nobody has tested there." />

      <div className="mb-4 flex flex-col gap-3" role="group" aria-label="Map filters">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Pillar</span>
          {PILLAR_FILTERS.map((p) => (
            <Chip key={p} pressed={pillar === p} onClick={() => set('pillar', pillar === p ? '' : p)}>
              {PILLAR_NAME[p]}
            </Chip>
          ))}
          <span className="eyebrow ml-3 mr-1">Fuel</span>
          {nearClasses.map((c) => (
            <Chip key={c.id} pressed={fuel === c.id} onClick={() => set('fuel', fuel === c.id ? '' : c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-56">
            <span className="field-label">Investigation</span>
            <select className="select" value={inv} onChange={(e) => set('inv', e.target.value)}>
              <option value="">All investigations</option>
              {snapshot.investigations.filter((i) => i.testCount > 0).map((i) => (
                <option key={i.accession} value={i.accession}>
                  {i.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full sm:w-64">
            <span className="field-label">Hardware</span>
            <select className="select" value={hw} onChange={(e) => set('hw', e.target.value)}>
              <option value="">All hardware</option>
              {snapshot.hardwareFamilies.filter((f) => f.id !== 'ground').map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="chip" aria-pressed={field} onClick={() => set('field', field ? '0' : '')}>
            <Sun size={14} aria-hidden="true" /> Coverage field
          </button>
          <button type="button" className="chip" aria-pressed={zoom} onClick={() => set('zoom', zoom ? '' : 'moon')}>
            <Focus size={14} aria-hidden="true" /> Focus the Moon Base region
          </button>
          <button type="button" className="chip" aria-pressed={table} onClick={() => set('view', table ? '' : 'table')}>
            <Table2 size={14} aria-hidden="true" /> View as table
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="card p-3 md:p-4 lg:col-span-8">
          {table ? (
            <DataTable
              rows={shown}
              columns={columns}
              rowKey={(t) => t.id}
              onRow={(t) => open([{ kind: 'test', id: t.id }])}
              rowLabel={(t) => `${invByAcc[t.accession].displayName} test ${t.label}. Press Enter for the NASA row.`}
              rowProps={(t) => ({ 'data-drill': `test.${t.id}` })}
              caption="Every plotted test as a table. Choose a row to open it."
              initialSort={{ key: 'd', dir: 1 }}
              maxRows={200}
            />
          ) : (
            <AtmosphereMap
              tests={plotted}
              dim={dim}
              showField={field}
              zoomMoon={zoom}
              dragRing
              title={`${shown.length} of ${plotted.length} tests`}
              footer={
                <div className="mt-3 flex flex-col gap-2">
                  <MapLegend />
                  <p className="text-[12px] text-muted">
                    Hollow marks are assumed cabin air. Drag the ring to move your habitat.
                    {field ? ' Brighter means more flight tests nearby. Not a safety rating.' : ''}
                  </p>
                </div>
              }
            />
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4" aria-label="Your habitat on the map">
          <div className="card flex items-center gap-4 p-4">
            <CoverageDial coverage={coverage} size={120} label={name} />
            <div>
              <p className="font-display text-[16px] font-semibold">{name}</p>
              <p className="text-[13px] text-muted">Evidence Coverage here</p>
              <NotASafetyRating className="mt-1" />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-[16px]">Within one unit of your habitat</h2>
            <p className="mt-1 text-[28px] leading-none">
              <SourcedNumber path={[{ kind: 'near', o2: scenario.o2, pressureAtm: point.pressureAtm }]} label={`${coverage.nearbyTotal} tests within one unit of your habitat`}>
                {coverage.nearbyTotal}
              </SourcedNumber>
              <span className="ml-2 text-[13px] text-muted">tests</span>
            </p>
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-[14px]">
              {nearClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--fuel-${c.id})` }} aria-hidden="true" />
                    {c.label}
                  </span>
                  <span className={`num ${(coverage.nearbyByFuelClass[c.id as FuelClass] ?? 0) === 0 ? 'text-gap' : ''}`}>{coverage.nearbyByFuelClass[c.id] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">One unit is 4 points of oxygen or about 25 percent in pressure.</p>
          </div>
          <div className="card p-4">
            <h2 className="text-[16px]">Nearest five tests</h2>
            <ul className="m-0 mt-2 flex list-none flex-col p-0">
              {nearest.map(({ test, distance: d }) => (
                <li
                  key={test.id}
                  className="drillable flex items-center justify-between gap-2 rounded px-1 py-1.5 text-[13px] hover:bg-surface-2"
                  tabIndex={0}
                  {...drill([{ kind: 'test', id: test.id }], `${invByAcc[test.accession].displayName} test ${test.label}, ${d.toFixed(2)} units away. Press Enter for the NASA row.`)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {invByAcc[test.accession].displayName} <span className="num font-normal text-muted">{test.label}</span>
                    </span>
                    <span className="num block text-[12px] text-muted">
                      {oxygenText(test)}, {pressureText(test)}
                    </span>
                  </span>
                  <span className="num shrink-0 text-muted">{d.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className="mt-6" aria-labelledby="unplotted-title">
        <h2 id="unplotted-title" className="text-[18px]">
          Tests that cannot be plotted
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          <span className="num text-ink">{data.tests.length - plotted.length}</span> tests have no oxygen or pressure value in their table and no declared assumption. They are not dropped. They are listed here.
        </p>
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {Object.keys(unplotted).sort(byAccession).map((accession) => (
            <li key={accession}>
              <ScenarioLink to={`/investigations/${accession}`} className="chip">
                {invByAcc[accession].displayName} <span className="num">{unplotted[accession].length}</span>
              </ScenarioLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
