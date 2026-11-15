// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Compare: two or three investigations side by side, with what they share and where they differ.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Investigation, Test } from '../types.ts'
import { materialFamily } from '../lib/parse.ts'
import { countBy } from '../lib/stats.ts'
import { atmToPsi, formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { PageHeader } from '../components/AppShell.tsx'
import { AtmosphereMap, MapLegend } from '../components/AtmosphereMap.tsx'
import { FUEL_NAME, PILLAR_NAME, years } from '../components/cards.tsx'
import { EmptyState, ScenarioLink } from '../components/ui.tsx'

const SERIES = ['var(--fuel-gas)', 'var(--fuel-aerosol)', 'var(--warn)']

function range(values: number[], format: (v: number) => string): string {
  if (values.length === 0) return 'not stated'
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return lo === hi ? format(lo) : `${format(lo)} to ${format(hi)}`
}

type Row = { label: string; cells: (inv: Investigation, tests: Test[]) => string }

export default function Compare() {
  const { snapshot, invByAcc, testsByAcc } = useData()
  const [params, setParams] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter((id) => invByAcc[id]).slice(0, 3)
  const toggle = (accession: string) => {
    const next = ids.includes(accession) ? ids.filter((a) => a !== accession) : [...ids, accession].slice(-3)
    setParams(
      (current) => {
        const p = new URLSearchParams(current)
        if (next.length === 0) p.delete('ids')
        else p.set('ids', next.join(','))
        return p
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const families = Object.fromEntries(snapshot.hardwareFamilies.map((f) => [f.id, f.name]))
  const tags = Object.fromEntries(snapshot.equipmentTags.map((t) => [t.id, t.label]))
  const rows: Row[] = [
    { label: 'What was burned', cells: (inv) => inv.summary.burned },
    { label: 'What was varied', cells: (inv) => inv.summary.varied },
    { label: 'Pillar', cells: (inv) => PILLAR_NAME[inv.pillar] },
    { label: 'Fuel class', cells: (inv) => FUEL_NAME[inv.fuelClass] },
    { label: 'Hardware family', cells: (inv) => families[inv.hardwareFamily] ?? inv.hardwareFamily },
    { label: 'Project type', cells: (inv) => inv.projectType },
    { label: 'Years', cells: (inv) => years(inv) },
    { label: 'Tests in the PSI table', cells: (inv) => String(inv.testCount) },
    {
      label: 'Fuels or materials',
      cells: (inv, tests) =>
        Object.entries(countBy(tests.filter((t) => t.fuel), (t) => (inv.fuelClass === 'solid' ? materialFamily(t.fuel) : (t.fuel as string))))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, n]) => `${name} (${n})`)
          .join(', ') || 'not stated',
    },
    {
      label: 'Oxygen range',
      cells: (_, tests) => {
        const list = tests.filter((t) => t.o2 != null)
        return range(list.map((t) => t.o2 as number), (v) => formatPercent(v)) + (list.length > 0 && list.every((t) => t.o2Source === 'assumed') ? ', assumed' : '')
      },
    },
    {
      label: 'Pressure range',
      cells: (_, tests) => {
        const list = tests.filter((t) => t.pressureAtm != null)
        return range(list.map((t) => atmToPsi(t.pressureAtm as number)), (v) => `${formatNumber(v, 1)} psi`) + (list.length > 0 && list.every((t) => t.pressureSource === 'assumed') ? ', assumed' : '')
      },
    },
    { label: 'Flow range', cells: (_, tests) => range(tests.filter((t) => t.flowCmS != null).map((t) => t.flowCmS as number), (v) => `${formatNumber(v, 1)} cm/s`) },
    {
      label: 'Measurements in the table',
      cells: (inv) =>
        snapshot.tableProfiles
          .filter((p) => p.accession === inv.accession)
          .flatMap((p) => p.columns.filter((c) => c.klass === 'continuous').map((c) => c.displayHeader))
          .slice(0, 8)
          .join(', ') || 'none listed',
    },
    { label: 'What it informs', cells: (inv) => inv.informs.map((t) => tags[t]).join(', ') || 'not tagged' },
  ]
  const chosen = ids.map((id) => invByAcc[id])
  const tests = useMemo(() => ids.flatMap((id) => testsByAcc[id] ?? []), [ids.join(','), testsByAcc]) // eslint-disable-line react-hooks/exhaustive-deps
  const colorOf = useMemo(() => {
    const map = Object.fromEntries(ids.map((id, i) => [id, SERIES[i]]))
    return (accession: string) => map[accession] ?? 'var(--muted)'
  }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const shared: string[] = []
  const different: string[] = []
  const table: { label: string; values: string[]; same: boolean }[] = rows.map((row) => {
    const values = chosen.map((inv) => row.cells(inv, testsByAcc[inv.accession] ?? []))
    const same = values.length > 1 && values.every((v) => v === values[0])
    if (chosen.length > 1 && !['What was burned', 'What was varied', 'Years', 'Tests in the PSI table'].includes(row.label)) (same ? shared : different).push(row.label.toLowerCase())
    return { label: row.label, values, same }
  })

  return (
    <div className="page">
      <PageHeader title="Compare investigations" lead="Side by side. A tinted row is the same across them." />
      <section aria-label="Choose investigations" className="card mb-4 p-4">
        <p className="field-label">Choose two or three</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {snapshot.investigations.map((inv) => (
            <li key={inv.accession}>
              <button type="button" className="chip" aria-pressed={ids.includes(inv.accession)} onClick={() => toggle(inv.accession)}>
                {inv.displayName}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {chosen.length < 2 ? (
        <EmptyState title="Choose at least two investigations">You can also select them on the Investigations screen and press Compare.</EmptyState>
      ) : (
        <>
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table className="data-table">
              <caption className="sr-only">Aligned facts for the chosen investigations</caption>
              <thead>
                <tr>
                  <th scope="col"> </th>
                  {chosen.map((inv, i) => (
                    <th key={inv.accession} scope="col" className="min-w-[220px] whitespace-normal">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} aria-hidden="true" />
                      <ScenarioLink to={`/investigations/${inv.accession}`}>{inv.displayName}</ScenarioLink>
                      <span className="num ml-2 font-normal text-faint">{inv.accession}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="!static whitespace-normal align-top font-medium text-ink">
                      {row.label}
                      {row.same ? <span className="block text-[11px] font-normal text-ok">shared</span> : <span className="block text-[11px] font-normal text-warn">differs</span>}
                    </th>
                    {row.values.map((value, i) => (
                      <Cell key={chosen[i].accession} same={row.same}>
                        {value}
                      </Cell>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="card mt-4 p-4" aria-labelledby="shared-title">
            <h2 id="shared-title" className="text-[18px]">
              Shared and different
            </h2>
            <p className="mt-2 text-[14px]">
              <strong>What they share:</strong> {shared.length > 0 ? shared.join(', ') : 'none of the compared facts'}.
            </p>
            <p className="mt-1 text-[14px]">
              <strong>Where they differ:</strong> {different.length > 0 ? different.join(', ') : 'none of the compared facts'}.
            </p>
          </section>

          <section className="card mt-4 p-4" aria-label="The chosen investigations on one atmosphere map">
            {tests.some((t) => t.o2 != null && t.pressureAtm != null) ? (
              <AtmosphereMap
                tests={tests}
                colorOf={colorOf}
                title="Their tests on one map"
                footer={
                  <div className="mt-3 flex flex-col gap-2">
                    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-muted">
                      {chosen.map((inv, i) => (
                        <li key={inv.accession} className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} aria-hidden="true" />
                          {inv.displayName}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12px] text-muted">Here colour shows the investigation. Shape still shows the fuel class, and hollow still means assumed.</p>
                    <MapLegend compact />
                  </div>
                }
              />
            ) : (
              <p className="text-[14px] text-muted">None of the chosen investigations has a test that can be plotted.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Cell({ same, children }: { same: boolean; children: ReactNode }) {
  return (
    <td className="max-w-[360px] whitespace-normal align-top" style={same ? { background: 'color-mix(in srgb, var(--ok) 8%, transparent)' } : undefined}>
      {children}
    </td>
  )
}
