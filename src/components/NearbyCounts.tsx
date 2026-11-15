// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The card that leads the dashboard: how many NASA test records sit near the habitat, in all and
// by fuel class, with the caveats that belong to those counts under them. Every count opens
// exactly the rows it counts, and an empty class is written out instead of drawn as an empty bar.
import { Component, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { List } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardHeading, CardTitle, CardToolbar } from '@/components/ui/card.tsx'
import type { DrillPath } from '../types.ts'
import type { Point } from '../lib/coverage.ts'
import { NO_NEARBY, NOT_PROOF, nearbyDescription, nearbyRows } from '../lib/nearby.ts'
import type { NearbyRow, NearbySummary } from '../lib/nearby.ts'
import { useDrill } from '../state/hooks.ts'
import { ScenarioLink, SourcedNumber, drillProps } from './ui.tsx'

export const COUNT_ROW = 44
export const COUNT_LABEL_WIDTH = 150
const whole = (n: number): string => n.toLocaleString('en-US')
const rowsWord = (n: number): string => (n === 1 ? 'row' : 'rows')

// The bars come with the charting library, as a chunk of their own. The fetch starts as soon as
// this file loads, which is while the start page is still being read.
const loadChart = () => import('./NearbyChart.tsx')
const NearbyChart = lazy(loadChart)
if (typeof window !== 'undefined') void loadChart().catch(() => {})

// The same four rows as plain text. It shows until the bars arrive, and it stays if they never do,
// so the counts and their rows do not depend on the charting library.
function CountList({ rows, description }: { rows: NearbyRow[]; description: string }) {
  const { open } = useDrill()
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label={`Nearby test records by fuel class. ${description}`}>
      {rows.map((row) => (
        <li key={row.fuel} className="flex items-center text-[14px]" style={{ height: COUNT_ROW }}>
          <span className="shrink-0" style={{ width: COUNT_LABEL_WIDTH }}>
            {row.label}
          </span>
          <button type="button" className={`drillable border-0 bg-transparent p-0 text-[14px] ${row.count === 0 ? 'text-gap' : 'num text-ink'}`} {...drillProps([row.step], row.describe, open)} role={undefined}>
            {row.count === 0 ? NO_NEARBY : whole(row.count)}
          </button>
        </li>
      ))}
    </ul>
  )
}

class ChartBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function NearbyCounts({ summary, point, name }: { summary: NearbySummary; point: Point; name: string }) {
  const { open } = useDrill()
  const near = { kind: 'near' as const, o2: point.o2, pressureAtm: point.pressureAtm }
  const total: DrillPath = [near]
  const rows = nearbyRows(summary, point)
  const description = nearbyDescription(summary, point, name)
  const list = <CountList rows={rows} description={description} />

  return (
    <Card className="w-full" role="region" aria-labelledby="nearby-title">
      <CardHeader className="min-h-auto border-0 pb-0 pt-5">
        <CardHeading>
          <CardTitle id="nearby-title" className="stat-label !font-medium">
            Nearby evidence
          </CardTitle>
          <p className="text-[15px] text-muted">
            <SourcedNumber path={total} label={`${whole(summary.total)} NASA test ${summary.total === 1 ? 'record' : 'records'} near this habitat`} className="mr-2 text-[40px] leading-none text-ink">
              {whole(summary.total)}
            </SourcedNumber>
            nearby NASA test {summary.total === 1 ? 'record' : 'records'}
          </p>
        </CardHeading>
        <CardToolbar>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => open(total)}>
            <List size={14} aria-hidden="true" /> {summary.total === 0 ? 'Why there are none' : `View the ${whole(summary.total)} NASA ${rowsWord(summary.total)}`}
          </button>
        </CardToolbar>
      </CardHeader>

      <CardContent className="px-5 pb-3 pt-4">
        <ChartBoundary fallback={list}>
          <Suspense fallback={list}>
            <NearbyChart rows={rows} total={summary.total} description={description} />
          </Suspense>
        </ChartBoundary>
      </CardContent>

      <CardFooter className="min-h-0 flex-col items-start gap-2 py-4 text-[13px] text-muted">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          <li>Nearby is an oxygen and pressure rule. {NOT_PROOF}</li>
          {summary.assumed > 0 ? (
            <li>
              Includes{' '}
              <SourcedNumber path={[{ ...near, only: 'assumed' }]} label={`${whole(summary.assumed)} nearby ${rowsWord(summary.assumed)} with assumed coordinates`} className="text-ink">
                {whole(summary.assumed)}
              </SourcedNumber>{' '}
              {rowsWord(summary.assumed)} with assumed coordinates. Their tables state no atmosphere.
            </li>
          ) : null}
          {summary.inverse > 0 ? (
            <li>
              Includes{' '}
              <SourcedNumber path={[{ ...near, only: 'inverse' }]} label={`${whole(summary.inverse)} nearby inverse-flame ${rowsWord(summary.inverse)}`} className="text-ink">
                {whole(summary.inverse)}
              </SourcedNumber>{' '}
              inverse-flame {rowsWord(summary.inverse)}. Their oxygen value is the oxidizer stream, not cabin air.
            </li>
          ) : null}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <ScenarioLink to="/about?section=nearby">Definition and limits</ScenarioLink>
          <ScenarioLink to="/about?section=glossary">Glossary</ScenarioLink>
          <ScenarioLink to="/about?section=assumptions">Assumptions</ScenarioLink>
        </p>
      </CardFooter>
    </Card>
  )
}
