// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The drill panel. A drawer on desktop and a sheet on phones. Three levels with breadcrumbs.
import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronRight, ExternalLink, X } from 'lucide-react'
import type { DrillGroup, DrillPath, Test } from '../types.ts'
import { encodeDrill, resolveDrill } from '../lib/drill.ts'
import { isAssumed } from '../lib/coverage.ts'
import { atmToPsi, formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useDrill, useScenario } from '../state/hooks.ts'
import { DataTable } from './DataTable.tsx'
import type { Column } from './DataTable.tsx'
import { ScenarioLink } from './ui.tsx'

export function oxygenText(t: Test): string {
  if (t.o2 == null) return 'not stated'
  return `${formatPercent(t.o2)}${t.o2Source === 'assumed' ? ' assumed' : ''}`
}

export function pressureText(t: Test): string {
  if (t.pressureAtm == null) return 'not stated'
  return `${formatNumber(atmToPsi(t.pressureAtm), 1)} psi${t.pressureSource === 'assumed' ? ' assumed' : ''}`
}

const FLAG_WORDS: Record<string, string> = {
  approximate: 'The table marks this value as approximate',
  range: 'The table gives a range. EMBER reads the first value',
  'day-level': 'The table lists this value for a test day, not for one flame',
  'typo-fixed': 'EMBER corrected a typing error in this cell',
  'label-corrected': 'A column label was corrected. See Methods',
  'material-inherited': 'The material cell is empty. EMBER carries the material from the row above',
  continuation: 'This row continues the row above',
  'oxidizer-stream': 'An inverse flame. The oxygen value is the oxidizer stream, not a cabin atmosphere',
  'pressure-from-pinit': 'The table lists no mean pressure. EMBER uses the starting pressure',
}

function Crumbs({ pageName, crumbs, hrefFor, onClose }: { pageName: string; crumbs: { label: string; path: DrillPath }[]; hrefFor: (p: DrillPath) => string; onClose: () => void }) {
  return (
    <nav aria-label="Drill path" className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
      <button type="button" className="px-1 hover:text-ink" onClick={onClose}>
        {pageName}
      </button>
      {crumbs.map((crumb, i) => (
        <span key={encodeDrill(crumb.path)} className="inline-flex items-center gap-1">
          <ChevronRight size={12} aria-hidden="true" />
          {i === crumbs.length - 1 ? (
            <span aria-current="page" className="font-semibold text-ink">{crumb.label}</span>
          ) : (
            <Link to={hrefFor(crumb.path)} preventScrollReset className="px-1 text-muted hover:text-ink">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function Groups({ title, groups, base, hrefFor }: { title: string; groups: DrillGroup[]; base: DrillPath; hrefFor: (p: DrillPath) => string }) {
  const { invByAcc } = useData()
  if (groups.length === 0) return null
  return (
    <section>
      <h3 className="eyebrow mb-2">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {groups.map((g) => {
          const inv = invByAcc[g.accession]
          return (
            <li key={g.accession}>
              <Link
                to={hrefFor([...base, { kind: 'investigation', accession: g.accession }])}
                preventScrollReset
                className="card flex items-center justify-between gap-3 px-4 py-3 text-ink no-underline transition-colors hover:bg-surface-2 hover:no-underline"
              >
                <span>
                  <span className="font-semibold">{inv?.displayName ?? g.accession}</span>
                  <span className="ml-2 text-[12px] text-muted">{g.accession}</span>
                  {g.assumed > 0 ? <span className="mt-0.5 block text-[12px] text-warn">{g.assumed === g.count ? 'All values assumed' : `${g.assumed} with an assumed value`}</span> : null}
                </span>
                <span className="flex items-center gap-3 text-right">
                  {g.effective != null ? (
                    <span className="text-[12px] text-muted">
                      <span className="num block text-[15px] text-ink">{formatNumber(g.effective, 1)}</span>effective
                    </span>
                  ) : null}
                  <span className="text-[12px] text-muted">
                    <span className="num block text-[15px] text-ink">{g.count}</span>
                    {g.count === 1 ? 'test' : 'tests'}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="text-muted" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TestTable({ tests, onOpen, highlight }: { tests: Test[]; onOpen: (t: Test) => void; highlight: string | null }) {
  const columns: Column<Test>[] = [
    { key: 'label', header: 'Test', cell: (t) => t.label, sort: (t) => t.label },
    { key: 'fuel', header: 'Fuel or material', cell: (t) => t.fuel ?? 'not stated', sort: (t) => t.fuel },
    { key: 'o2', header: 'Oxygen', cell: (t) => oxygenText(t), sort: (t) => t.o2, numeric: true },
    { key: 'p', header: 'Pressure', cell: (t) => pressureText(t), sort: (t) => t.pressureAtm, numeric: true },
    { key: 'out', header: 'Outcome', cell: (t) => t.outcome ?? '', sort: (t) => t.outcome },
  ]
  return (
    <DataTable
      rows={tests}
      columns={columns}
      rowKey={(t) => t.id}
      onRow={onOpen}
      rowLabel={(t) => `Test ${t.label}, ${oxygenText(t)} oxygen, ${pressureText(t)}. Press Enter for the row as NASA wrote it.`}
      highlight={(t) => t.id === highlight}
      caption="The tests behind this mark. Choose a row to see it as NASA wrote it."
      maxRows={150}
    />
  )
}

export function TestDetail({ test }: { test: Test }) {
  const { invByAcc, snapshot } = useData()
  const inv = invByAcc[test.accession]
  const profile = snapshot.tableProfiles.find((p) => p.table === test.table)
  const headerNote = (header: string) => profile?.columns.find((c) => c.header === header && c.corrected)?.displayHeader
  const read: [string, string][] = [
    ['Oxygen', oxygenText(test)],
    ['Pressure', test.pressureAtm == null ? 'not stated' : `${pressureText(test)} (${formatNumber(test.pressureAtm, 3)} atm)`],
    ['Fuel or material', test.fuel ?? 'not stated'],
    ['Fuel class', test.fuelClass],
  ]
  if (test.flowCmS != null) read.push(['Flow', `${formatNumber(test.flowCmS, 1)} cm/s`])
  if (test.outcome) read.push(['Outcome', test.outcome])
  if (test.diluent) {
    const d = test.diluent
    read.push(['Other gases', [d.n2 ? `nitrogen ${formatNumber(d.n2, 3)}` : '', d.co2 ? `carbon dioxide ${formatNumber(d.co2, 3)}` : '', d.he ? `helium ${formatNumber(d.he, 3)}` : ''].filter(Boolean).join(', ') || 'none listed'])
  }
  return (
    <div className="flex flex-col gap-5">
      {isAssumed(test) ? (
        <p className="border border-line bg-surface-2 px-3 py-2 text-[13px]">
          <strong className="text-warn">Assumed.</strong> The table for this test does not state{' '}
          {test.o2Source === 'assumed' && test.pressureSource === 'assumed' ? 'an atmosphere' : test.o2Source === 'assumed' ? 'an oxygen level' : 'a pressure'}. EMBER uses a declared assumption and counts this test at half weight.
        </p>
      ) : null}
      <section>
        <h3 className="eyebrow mb-2">What EMBER read from it</h3>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
          {read.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="num m-0">{v}</dd>
            </div>
          ))}
        </dl>
        {test.flags && test.flags.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-[13px] text-muted">
            {test.flags.map((f) => (
              <li key={f}>{FLAG_WORDS[f] ?? f}.</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section>
        <h3 className="eyebrow mb-2">The row as NASA wrote it</h3>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Every cell of row {test.rowIndex} in {test.table}</caption>
            <tbody>
              {Object.entries(test.raw).map(([header, cell]) => (
                <tr key={header}>
                  <th scope="row" className="!static max-w-[220px] whitespace-normal align-top font-medium">
                    {header}
                    {headerNote(header) ? <span className="block text-[11px] font-normal text-warn">read as {headerNote(header)}</span> : null}
                  </th>
                  <td className="num">{cell === '' ? <span className="text-faint">empty</span> : cell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Row {test.rowIndex} of {test.table}
        </p>
      </section>
      <div className="flex flex-wrap gap-2">
        <ScenarioLink to={`/investigations/${test.accession}?row=${encodeURIComponent(test.id)}`} className="btn btn-secondary btn-sm">
          Open {inv?.displayName ?? test.accession}
        </ScenarioLink>
        <a href={inv?.psiUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          The record on psi.nasa.gov <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

export function DrillPanel({ pageName }: { pageName: string }) {
  const data = useData()
  const { scenario } = useScenario()
  const { path, close, open, hrefFor } = useDrill()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = path ? encodeDrill([path[0]]) : null
  const pathKey = path ? encodeDrill(path) : null
  const result = useMemo(() => (path ? resolveDrill(path, data, scenario) : null), [pathKey, data, scenario]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pathKey) return
    headingRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathKey, close])

  // When the panel closes, focus returns to the mark that opened it. The app shell keeps this
  // component mounted with no path, so this effect still runs on close. A move to another
  // page is left alone.
  const lastFirst = useRef<{ step: string; page: string } | null>(null)
  useEffect(() => {
    if (firstStep) {
      lastFirst.current = { step: firstStep, page: window.location.pathname }
      return
    }
    const last = lastFirst.current
    lastFirst.current = null
    if (!last || last.page !== window.location.pathname) return
    const mark = document.querySelector<HTMLElement | SVGElement>(`[data-drill="${CSS.escape(last.step)}"]`)
    mark?.focus({ preventScroll: true })
  }, [firstStep])

  if (!path || !result) return null
  const base: DrillPath = [path[0]]
  const invStep = path.find((s) => s.kind === 'investigation')
  const trail: DrillPath = invStep && path[0].kind !== 'investigation' && path[0].kind !== 'test' ? [...base, invStep] : base
  const tests = result.testIds.map((id) => data.testById.get(id)).filter((t): t is Test => Boolean(t))
  const showGroups = result.level === 'mark' && (result.groups.length > 1 || result.edge.length > 0 || result.groups.some((g) => g.effective != null))
  const openTest = (t: Test) => open(path[0].kind === 'test' ? [{ kind: 'test', id: t.id }] : [...trail, { kind: 'test', id: t.id }])

  return (
    <>
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} onClick={close} aria-hidden="true" />
      <motion.aside
        className="drill-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <Crumbs pageName={pageName} crumbs={result.crumbs} hrefFor={hrefFor} onClose={close} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm shrink-0" onClick={close} aria-label="Close the drill panel">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <motion.div
          key={pathKey}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div>
            <h2 id="drill-title" ref={headingRef} tabIndex={-1} className="text-[20px] leading-snug outline-none">
              {result.title}
            </h2>
            {result.formula ? <p className="num mt-3 bg-surface-2 px-3 py-2 text-[12px] text-muted">{result.formula}</p> : null}
            {result.note ? <p className="mt-3 text-[14px] text-muted">{result.note}</p> : null}
          </div>
          {result.level === 'test' && result.test ? <TestDetail test={result.test} /> : null}
          {showGroups ? <Groups title="Investigations behind this mark" groups={result.groups} base={base} hrefFor={hrefFor} /> : null}
          {result.level === 'mark' && result.edge.length > 0 ? <Groups title="Sitting on its edge" groups={result.edge} base={base} hrefFor={hrefFor} /> : null}
          {result.level !== 'test' && tests.length > 0 && (result.level === 'investigation' || !showGroups) ? (
            <section>
              <h3 className="eyebrow mb-2">
                {tests.length} {tests.length === 1 ? 'test' : 'tests'}
              </h3>
              <TestTable tests={tests} onOpen={openTest} highlight={result.highlightTestId} />
            </section>
          ) : null}
          {result.level === 'mark' && showGroups && tests.length > 0 && tests.length <= 12 ? (
            <section>
              <h3 className="eyebrow mb-2">All {tests.length} tests</h3>
              <TestTable tests={tests} onOpen={openTest} highlight={result.highlightTestId} />
            </section>
          ) : null}
          <p className="mt-auto text-[12px] text-muted">Every row is from the NASA PSI repository. This address opens the same panel for anyone.</p>
        </motion.div>
      </motion.aside>
    </>
  )
}
