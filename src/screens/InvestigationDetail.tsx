// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// One investigation: summary, what varied and what stayed fixed, the test table and its sources.
import { useEffect, useMemo } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Download, ExternalLink } from 'lucide-react'
import type { ColumnProfile, Investigation, TableProfile, Test } from '../types.ts'
import { testsToCsv } from '../lib/csv.ts'
import { formatBytes, formatNumber } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useDrill } from '../state/hooks.ts'
import { AtmosphereMap, MapLegend } from '../components/AtmosphereMap.tsx'
import { DataTable } from '../components/DataTable.tsx'
import type { Column } from '../components/DataTable.tsx'
import { oxygenText, pressureText } from '../components/DrillPanel.tsx'
import { InformsChips, InvestigationChips, Thumb, years } from '../components/cards.tsx'
import { ScenarioLink, SiTag, useDrillProps } from '../components/ui.tsx'

export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const CLASS_WORDS: Record<string, string> = { constant: 'Fixed', factor: 'Varied in steps', continuous: 'Varied', identifier: 'Identifier', notes: 'Notes' }

function ProfileRow({ inv, tableIndex, columnIndex, column }: { inv: Investigation; tableIndex: number; columnIndex: number; column: ColumnProfile }) {
  const props = useDrillProps()
  const path = (value: string) => [{ kind: 'column' as const, accession: inv.accession, table: tableIndex, column: columnIndex, value }]
  const range = column.klass === 'continuous' && column.min != null && column.max != null
  return (
    <tr>
      <th scope="row" className="!static max-w-[240px] whitespace-normal align-top font-medium text-ink">
        {column.displayHeader}
        {column.corrected ? <span className="block text-[11px] font-normal text-warn">label corrected from "{column.header}"</span> : null}
      </th>
      <td className="whitespace-nowrap align-top text-muted">{CLASS_WORDS[column.klass]}</td>
      <td className="align-top">
        {column.klass === 'constant' && column.topValues[0] ? (
          <button type="button" className="chip" {...props(path(column.topValues[0].value), `${column.displayHeader} is ${column.topValues[0].value} in every test. Press Enter for the rows.`)} role={undefined}>
            <span className="num">{column.topValues[0].value}</span>
          </button>
        ) : null}
        {column.klass === 'factor' ? (
          <span className="flex flex-wrap gap-1.5">
            {column.topValues.map((v) => (
              <button key={v.value} type="button" className="chip max-w-[260px]" {...props(path(v.value), `${column.displayHeader} is ${v.value} in ${v.count} tests. Press Enter for the rows.`)} role={undefined}>
                <span className="num truncate">{v.value}</span>
                <span className="num text-faint">{v.count}</span>
              </button>
            ))}
          </span>
        ) : null}
        {range ? (
          <button type="button" className="flex w-full min-w-[180px] items-center gap-2 rounded bg-transparent p-0 text-left" {...props(path('*'), `${column.displayHeader} ranges from ${column.min} to ${column.max}. Press Enter for the rows.`)} role={undefined}>
            <span className="num text-[12px]">{formatNumber(column.min as number, 3)}</span>
            <span className="relative h-2 flex-1 rounded-full bg-line">
              <span className="absolute inset-y-0 left-0 right-0 rounded-full bg-freefall opacity-60" />
              {column.median != null && column.max !== column.min ? (
                <span className="absolute top-[-3px] h-3.5 w-0.5 bg-ink" style={{ left: `${(((column.median as number) - (column.min as number)) / ((column.max as number) - (column.min as number))) * 100}%` }} title={`Median ${formatNumber(column.median, 3)}`} />
              ) : null}
            </span>
            <span className="num text-[12px]">
              {formatNumber(column.max as number, 3)}
              {column.unit ? ` ${column.unit}` : ''}
            </span>
          </button>
        ) : null}
        {column.klass === 'identifier' || column.klass === 'notes' || (column.klass === 'continuous' && !range) ? (
          <span className="text-[13px] text-muted">
            <span className="num">{column.distinct}</span> different values in <span className="num">{column.nonEmpty}</span> filled cells
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function ProfileStrip({ inv, profile, tableIndex }: { inv: Investigation; profile: TableProfile; tableIndex: number }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[13px] text-muted">
        <span className="num text-ink">{profile.rows}</span> rows in <span className="num">{profile.table}</span>
      </p>
      <div className="table-wrap" style={{ maxHeight: 420 }}>
        <table className="data-table">
          <caption className="sr-only">For each column of the table: whether it was fixed or varied, and its values</caption>
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Across tests</th>
              <th scope="col">Values</th>
            </tr>
          </thead>
          <tbody>
            {profile.columns.map((column, i) => (
              <ProfileRow key={column.header + i} inv={inv} tableIndex={tableIndex} columnIndex={i} column={column} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Block({ title, text }: { title: string; text: string }) {
  if (!text) return null
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-display text-[16px] font-semibold">{title}</summary>
      <p className="prose-width mt-3 whitespace-pre-line text-[14px] text-muted">{text}</p>
      <p className="mt-2 text-[12px] text-faint">The full text of the PSI record, as NASA wrote it.</p>
    </details>
  )
}

export default function InvestigationDetail() {
  const { accession = '' } = useParams()
  const data = useData()
  const { snapshot, invByAcc, testsByAcc } = data
  const [params, setParams] = useSearchParams()
  const { open } = useDrill()
  const inv = invByAcc[accession]
  const tests = useMemo(() => testsByAcc[accession] ?? [], [testsByAcc, accession])
  const raw = params.get('raw') === '1'
  const row = params.get('row')
  const profiles = snapshot.tableProfiles.filter((p) => p.accession === accession)
  useEffect(() => {
    if (!row) return
    document.getElementById(`row-${row}`)?.scrollIntoView({ block: 'center' })
  }, [row, raw])
  if (!inv) return <Navigate to="/investigations" replace />

  const assumption = snapshot.assumptions.find((a) => a.accession === accession)
  const corrections = snapshot.labelCorrections.filter((c) => c.accession === accession)
  const inverse = tests.some((t) => t.extra.inverse === true)
  const hasFlow = tests.some((t) => t.flowCmS != null)
  const hasOutcome = tests.some((t) => t.outcome)
  const family = snapshot.hardwareFamilies.find((f) => f.id === inv.hardwareFamily)
  const names = { [inv.accession]: inv.displayName }
  const columns: Column<Test>[] = [
    { key: 'label', header: 'Test', cell: (t) => t.label, sort: (t) => t.label },
    { key: 'fuel', header: 'Fuel or material', cell: (t) => t.fuel ?? 'not stated', sort: (t) => t.fuel },
    { key: 'o2', header: 'Oxygen', cell: (t) => oxygenText(t), sort: (t) => t.o2, numeric: true },
    { key: 'p', header: 'Pressure', cell: (t) => pressureText(t), sort: (t) => t.pressureAtm, numeric: true },
    ...(hasFlow ? [{ key: 'flow', header: 'Flow, cm/s', cell: (t: Test) => (t.flowCmS == null ? '' : formatNumber(t.flowCmS, 1)), sort: (t: Test) => t.flowCmS, numeric: true }] : []),
    ...(hasOutcome ? [{ key: 'out', header: 'Outcome', cell: (t: Test) => t.outcome ?? '', sort: (t: Test) => t.outcome }] : []),
    { key: 'row', header: 'Raw row', cell: (t) => t.rowIndex, sort: (t) => t.rowIndex, numeric: true },
  ]
  const rawHeaders = tests[0] ? Object.keys(tests[0].raw) : []
  const rawColumns: Column<Test>[] = rawHeaders.map((h, i) => ({ key: `c${i}`, header: h, cell: (t) => t.raw[h] ?? '', sort: (t) => t.raw[h] ?? '' }))
  const setRaw = (on: boolean) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (on) next.set('raw', '1')
        else next.delete('raw')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <div className="page">
      <p className="mb-3 text-[13px]">
        <ScenarioLink to="/investigations">All investigations</ScenarioLink>
      </p>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start">
        <Thumb inv={inv} size={96} />
        <div className="min-w-0 flex-1">
          <h1 id="page-title" tabIndex={-1} className="text-[28px] outline-none md:text-[36px]">
            {inv.displayName}
          </h1>
          <p className="mt-1 text-muted">{inv.title}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip chip-source">{inv.accession}</span>
            <InvestigationChips inv={inv} />
            <span className="chip">{inv.projectType}</span>
            <InformsChips inv={inv} />
          </div>
          <p className="num mt-3 text-[13px] text-muted">
            {inv.testCount} {inv.testCount === 1 ? 'test' : 'tests'} · {years(inv)} · archive {formatBytes(inv.totalFileSizeBytes)}
            {inv.license ? ` · licence ${inv.license.id}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={inv.psiUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
              Open on psi.nasa.gov <ExternalLink size={14} aria-hidden="true" />
            </a>
            {inv.doi ? (
              <a href={`https://doi.org/${inv.doi}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                DOI {inv.doi}
              </a>
            ) : null}
            {inv.license?.link ? (
              <a href={inv.license.link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                {inv.license.name}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="card p-5 lg:col-span-7" aria-labelledby="summary-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="summary-title" className="text-[18px]">
              Plain summary
            </h2>
            <SiTag />
          </div>
          <dl className="m-0 flex flex-col gap-3 text-[15px]">
            <div>
              <dt className="eyebrow">What was burned</dt>
              <dd className="m-0 mt-0.5">{inv.summary.burned}</dd>
            </div>
            <div>
              <dt className="eyebrow">What was varied</dt>
              <dd className="m-0 mt-0.5">{inv.summary.varied}</dd>
            </div>
            <div>
              <dt className="eyebrow">Why it matters for fire safety</dt>
              <dd className="m-0 mt-0.5">{inv.summary.matters}</dd>
            </div>
          </dl>
          {inverse ? (
            <p className="mt-4 rounded-control bg-surface-2 px-3 py-2 text-[13px]">
              Some of these tests are inverse flames. The oxidizer flows from the burner into a fuel atmosphere, so the oxygen value is the oxidizer stream and not a cabin atmosphere.
            </p>
          ) : null}
          {assumption ? (
            <p className="mt-4 rounded-control bg-surface-2 px-3 py-2 text-[13px]">
              <strong className="text-warn">Assumed atmosphere.</strong> {assumption.reason} Status: {assumption.status}.{' '}
              <ScenarioLink to="/methods?section=assumptions">All assumptions</ScenarioLink>
            </p>
          ) : null}
          <div className="mt-4">
            <p className="eyebrow mb-1">More from NASA</p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
              <li>
                <a href="https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/" target="_blank" rel="noreferrer">
                  NASA Combustion Science
                </a>
              </li>
              <li>
                <a href="https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/" target="_blank" rel="noreferrer">
                  A Researcher's Guide to International Space Station Combustion Science
                </a>
              </li>
              {inv.experimentHardwareLink ? (
                <li>
                  <a href={inv.experimentHardwareLink} target="_blank" rel="noreferrer">
                    Hardware: {inv.experimentHardware.slice(0, 80)}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </section>

        <section className="card p-4 lg:col-span-5" aria-label="This investigation on the atmosphere map">
          {tests.some((t) => t.o2 != null && t.pressureAtm != null) ? (
            <AtmosphereMap tests={tests} compact title="Its tests on the map" footer={<div className="mt-2"><MapLegend compact /></div>} />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col justify-center text-center">
              <p className="font-display text-[16px] font-semibold">Not on the map</p>
              <p className="mt-1 text-[14px] text-muted">{tests.length === 0 ? 'This investigation has no test table in PSI.' : 'Its table states no oxygen or pressure value, so its tests cannot be plotted.'}</p>
            </div>
          )}
        </section>
      </div>

      {profiles.length > 0 ? (
        <section className="mt-8" aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-[22px]">
            What varied and what stayed fixed
          </h2>
          <p className="mb-4 mt-1 text-[14px] text-muted">One row per column of the PSI table. Choose a value to see the tests that have it.</p>
          {profiles.map((profile) => (
            <ProfileStrip key={profile.table} inv={inv} profile={profile} tableIndex={Number(tests.find((t) => t.table === profile.table)?.id.split(':')[1] ?? 0)} />
          ))}
          {corrections.length > 0 ? (
            <ul className="m-0 list-disc pl-5 text-[13px] text-muted">
              {corrections.map((c) => (
                <li key={c.original}>
                  "{c.original}" is shown as "{c.corrected}". {c.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="tests-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tests-title" className="text-[22px]">
              Test table
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              {tests.length === 0 ? 'PSI lists no experimental table for this record.' : 'Choose a row to see it as NASA wrote it. The word assumed marks every value that is not in the table.'}
            </p>
          </div>
          {tests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" aria-pressed={raw} onClick={() => setRaw(!raw)}>
                Raw cells
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`ember-${inv.accession}-tests.csv`, testsToCsv(tests, names))}>
                <Download size={14} aria-hidden="true" /> Download normalized CSV
              </button>
              <a href="/data/tests.csv" download className="btn btn-ghost btn-sm">
                <Download size={14} aria-hidden="true" /> Whole dataset
              </a>
            </div>
          ) : null}
        </div>
        {tests.length > 0 ? (
          <DataTable
            rows={tests}
            columns={raw ? rawColumns : columns}
            rowKey={(t) => t.id}
            onRow={(t) => open([{ kind: 'test', id: t.id }])}
            rowLabel={(t) => `Test ${t.label}. Press Enter for the row as NASA wrote it.`}
            rowProps={(t) => ({ 'data-drill': `test.${t.id}` })}
            highlight={(t) => t.id === row}
            caption={`The ${tests.length} tests of ${inv.displayName}`}
            maxRows={row ? 5000 : 150}
          />
        ) : null}
        {raw && profiles.some((p) => p.noteRows.length > 0) ? (
          <div className="mt-3">
            <p className="eyebrow mb-1">Note rows in the file, not counted as tests</p>
            <ul className="m-0 list-disc pl-5 text-[13px] text-muted">
              {profiles.flatMap((p) => p.noteRows).map((n) => (
                <li key={n.rowIndex}>
                  Row {n.rowIndex}: {Object.values(n.cells).filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-3" aria-label="The PSI record text">
        <h2 className="text-[22px]">The record, in NASA's words</h2>
        <Block title="Objectives" text={inv.objective} />
        <Block title="Hypothesis" text={inv.hypothesis} />
        <Block title="Approach" text={inv.approach} />
        <Block title="Research impacts and Earth benefits" text={inv.researchImpacts} />
        <Block title="Experiment hardware" text={`${inv.experimentHardware}${family ? `\n\nEMBER groups it under: ${family.name}. ${family.note}` : ''}`} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="files-title">
          <h2 id="files-title" className="text-[18px]">
            Data types in the archive
          </h2>
          {inv.files ? (
            <>
              <p className="mt-1 text-[13px] text-muted">
                <span className="num text-ink">{inv.files.total.toLocaleString('en-US')}</span> files listed, <span className="num">{formatBytes(inv.totalFileSizeBytes)}</span> in total.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <ul className="m-0 list-none p-0 text-[13px]">
                  {Object.entries(inv.files.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3 border-b border-line py-1">
                      <span>{k}</span>
                      <span className="num">{v}</span>
                    </li>
                  ))}
                </ul>
                <ul className="m-0 list-none p-0 text-[13px]">
                  {Object.entries(inv.files.byExtension).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3 border-b border-line py-1">
                      <span className="num">.{k}</span>
                      <span className="num">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-muted">PSI lists no data files for this record.</p>
          )}
        </section>

        <section className="card p-5" aria-labelledby="related-title">
          <h2 id="related-title" className="text-[18px]">
            Related investigations
          </h2>
          {inv.related.filter((a) => invByAcc[a]).length > 0 ? (
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
              {inv.related.filter((a) => invByAcc[a]).map((a) => (
                <li key={a}>
                  <ScenarioLink to={`/investigations/${a}`} className="chip">
                    {invByAcc[a].displayName}
                  </ScenarioLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-muted">The PSI record lists none among the combustion investigations.</p>
          )}
          <p className="eyebrow mb-1 mt-4">Same hardware family</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {snapshot.investigations.filter((i) => i.hardwareFamily === inv.hardwareFamily && i.accession !== inv.accession).map((i) => (
              <li key={i.accession}>
                <ScenarioLink to={`/investigations/${i.accession}`} className="chip">
                  {i.displayName}
                </ScenarioLink>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="pubs-title">
        <h2 id="pubs-title" className="text-[22px]">
          Publications <span className="num text-[16px] text-muted">{inv.publications.length}</span>
        </h2>
        {inv.publications.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">The PSI record lists no publications.</p>
        ) : (
          <ol className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14px]">
            {inv.publications.slice(0, 60).map((p, i) => (
              <li key={`${p.title}-${i}`}>
                <span>{p.title}</span>
                {p.authors ? <span className="text-muted">. {p.authors}</span> : null}
                {p.doi ? (
                  <>
                    {' '}
                    <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="num text-[13px]">
                      doi {p.doi}
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
