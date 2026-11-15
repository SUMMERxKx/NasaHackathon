// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The count chart itself: a horizontal bar chart on the team's chart component. One neutral
// series on a linear scale from zero, with the count written at the end of each bar. It loads
// as its own chunk, so the charting library never rides along with the start page.
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import type { BarShapeProps } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/line-charts-1.tsx'
import type { ChartConfig } from '@/components/ui/line-charts-1.tsx'
import { NO_NEARBY } from '../lib/nearby.ts'
import type { NearbyRow } from '../lib/nearby.ts'
import { useDrill } from '../state/hooks.ts'
import { COUNT_LABEL_WIDTH, COUNT_ROW } from './NearbyCounts.tsx'
import { drillProps } from './ui.tsx'

const chartConfig = {
  count: { label: 'Nearby test records', color: 'var(--muted)' },
} satisfies ChartConfig

const VALUE_GAP = 8
const BAR = 16
const whole = (n: number): string => n.toLocaleString('en-US')

const ChartLabel = ({ label, color }: { label: string; color: string }) => (
  <div className="flex items-center gap-1.5">
    <div className="size-3 border-2 bg-surface" style={{ borderColor: color }} />
    <span className="text-muted">{label}</span>
  </div>
)

// The tooltip of the team's chart component: a label, then one line for the series.
function CountTooltip({ active, payload, total }: { active?: boolean; payload?: ReadonlyArray<{ payload?: NearbyRow }>; total: number }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="min-w-[180px] border border-border bg-surface p-3 text-ink" style={{ boxShadow: 'var(--shadow-pop)' }}>
      <div className="mb-2.5 text-xs font-medium tracking-wide text-muted">{row.label}</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <ChartLabel label={`${chartConfig.count.label}:`} color={chartConfig.count.color} />
          <span className="num font-semibold">{row.count === 0 ? NO_NEARBY : whole(row.count)}</span>
        </div>
        <p className="text-xs text-muted">{row.count === 0 ? 'Select the row to see why.' : `${whole(row.count)} of ${whole(total)} nearby. Select the row to open them.`}</p>
      </div>
    </div>
  )
}

export default function NearbyChart({ rows, total, description }: { rows: NearbyRow[]; total: number; description: string }) {
  const { open } = useDrill()
  const height = rows.length * COUNT_ROW

  // One row of the chart: its class name, its bar and its count, as one control that opens its rows.
  const renderRow = (props: BarShapeProps) => {
    const row = props.payload as NearbyRow
    const y = props.y + props.height / 2
    return (
      <g className="drillable count-row" tabIndex={0} {...drillProps([row.step], row.describe, open)}>
        <rect x={0} y={y - COUNT_ROW / 2} width={props.parentViewBox.width} height={COUNT_ROW} fill="transparent" />
        <text x={props.x - COUNT_LABEL_WIDTH} y={y} dominantBaseline="central" fontSize={14} fill="var(--ink)">
          {row.label}
        </text>
        {row.count === 0 ? (
          <text x={props.x} y={y} dominantBaseline="central" fontSize={14} fill="var(--gap)">
            {NO_NEARBY}
          </text>
        ) : (
          <>
            <rect className="count-bar" x={props.x} y={y - BAR / 2} width={Math.max(2, props.width)} height={BAR} fill="var(--color-count)" />
            <text className="num" x={props.x + Math.max(2, props.width) + VALUE_GAP} y={y} dominantBaseline="central" fontSize={14} fill="var(--ink)">
              {whole(row.count)}
            </text>
          </>
        )}
      </g>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }} initialDimension={{ width: 520, height }} role="group" aria-label={`Nearby test records by fuel class. ${description}`}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={0} accessibilityLayer={false}>
        <XAxis type="number" dataKey="count" hide domain={[0, Math.max(1, ...rows.map((r) => r.count))]} />
        <YAxis type="category" dataKey="label" width={COUNT_LABEL_WIDTH} axisLine={false} tickLine={false} tick={false} />
        <ChartTooltip cursor={false} content={<CountTooltip total={total} />} />
        <Bar dataKey="count" fill="var(--color-count)" isAnimationActive={false} shape={renderRow} />
      </BarChart>
    </ChartContainer>
  )
}
