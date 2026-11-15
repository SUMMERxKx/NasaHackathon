// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The cards and rows: insight, ranked investigation, incident and spinoff.
import type { ReactNode } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import type { ContextCard, Insight, Investigation, Scenario } from '../types.ts'
import { markPath } from '../lib/mapLayout.ts'
import { RANK_FORMULAS, RANK_WEIGHTS } from '../lib/ranking.ts'
import type { RankParts, Ranked } from '../lib/ranking.ts'
import { useData } from '../state/data.tsx'
import { bar } from './Coverage.tsx'
import { Chip, ScenarioLink, SourcedNumber, VerifiedMark, useDrillDescribed } from './ui.tsx'

export const PILLAR_NAME: Record<string, string> = {
  prevention: 'Prevention',
  detection: 'Detection',
  suppression: 'Suppression',
  fundamentals: 'Fundamentals',
  gap: 'Evidence gap',
  method: 'Method',
  data: 'Data',
}

export const FUEL_NAME: Record<string, string> = { solid: 'Solid materials', liquid: 'Liquid fuels', gas: 'Gas flames', aerosol: 'Smoke and aerosols', unknown: 'Not classed' }

const INSIGHT_ORDER = ['I1', 'I2', 'I3', 'I5', 'I7', 'I4', 'I6', 'I8', 'I9', 'I10', 'I11', 'I12']

export function insightApplies(card: Insight, scenario: Scenario): boolean {
  const when = card.appliesWhen
  if (!when) return true
  if (when.minO2 != null && scenario.o2 < when.minO2) return false
  if (when.maxO2 != null && scenario.o2 > when.maxO2) return false
  if (when.gravity && !when.gravity.includes(scenario.gravity)) return false
  return true
}

// Cards with a condition that matches this habitat come first.
export function surfaceInsights(insights: Insight[], scenario: Scenario): Insight[] {
  const rank = (id: string) => (INSIGHT_ORDER.indexOf(id) < 0 ? 99 : INSIGHT_ORDER.indexOf(id))
  return insights
    .filter((card) => insightApplies(card, scenario))
    .sort((a, b) => Number(Boolean(b.appliesWhen)) - Number(Boolean(a.appliesWhen)) || rank(a.id) - rank(b.id))
}

export function InsightCard({ card, compact = false }: { card: Insight; compact?: boolean }) {
  const gap = card.pillar === 'gap'
  return (
    <article className={`card flex h-full flex-col gap-3 p-4 md:p-5 ${gap ? 'border-l-2 border-l-gap' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${gap ? 'chip-gap' : ''}`}>{PILLAR_NAME[card.pillar]}</span>
        <span className="chip chip-source">{card.id}</span>
        <VerifiedMark level={card.verified} />
      </div>
      <p className="text-[36px] leading-none md:text-[48px]">
        <SourcedNumber path={[{ kind: 'insight', id: card.id, number: card.primary }]} label={`${card.display[card.primary]}. ${card.headline}`}>
          {card.display[card.primary]}
        </SourcedNumber>
      </p>
      <h3 className="text-[16px] font-semibold leading-snug">{card.headline}</h3>
      {!compact ? <p className="text-[14px] text-muted">{card.detail}</p> : null}
    </article>
  )
}

const PART_KEYS: (keyof RankParts)[] = ['A', 'F', 'P', 'D']

export function WhyRankBars({ ranked }: { ranked: Ranked }) {
  const props = useDrillDescribed()
  const { invByAcc } = useData()
  const name = invByAcc[ranked.accession]?.displayName ?? ranked.accession
  return (
    <div>
      <p className="eyebrow mb-1.5">Why this rank</p>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0 sm:grid-cols-4">
        {PART_KEYS.map((part) => {
          const value = ranked.parts[part]
          const info = RANK_FORMULAS[part]
          return (
            <li
              key={part}
              className="drillable px-1 py-0.5 hover:bg-surface-2"
              tabIndex={0}
              {...props([{ kind: 'rank', accession: ranked.accession, part }], `${info.label} for ${name}. ${info.formula} Weight ${RANK_WEIGHTS[part]}. Press Enter for the tests that were counted.`)}
            >
              <span className="flex items-baseline justify-between gap-1 text-[11px] text-muted">
                <span className="truncate">{info.label}</span>
                <span className="num text-ink">{value.toFixed(2)}</span>
              </span>
              <span className="mt-0.5 block h-1.5 overflow-hidden bg-line">
                <span className="block h-full bg-freefall" style={bar(value * 100)} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function InvestigationChips({ inv }: { inv: Investigation }) {
  const { snapshot } = useData()
  const family = snapshot.hardwareFamilies.find((f) => f.id === inv.hardwareFamily)
  return (
    <>
      <Chip>{PILLAR_NAME[inv.pillar]}</Chip>
      <Chip>{FUEL_NAME[inv.fuelClass]}</Chip>
      {family ? <Chip title={family.name}>{family.name.replace('Combustion Integrated Rack', 'CIR').replace('Microgravity Science Glovebox', 'Glovebox').replace('Multi-user Droplet Combustion Apparatus', 'MDCA')}</Chip> : null}
    </>
  )
}

export function InformsChips({ inv }: { inv: Investigation }) {
  const { snapshot } = useData()
  if (inv.informs.length === 0) return null
  return (
    <>
      {inv.informs.map((id) => (
        <span key={id} className="chip chip-ok" title="What this investigation informs">
          Informs: {snapshot.equipmentTags.find((t) => t.id === id)?.label.toLowerCase()}
        </span>
      ))}
    </>
  )
}

export function years(inv: Investigation): string {
  const a = inv.startDate?.slice(0, 4)
  const b = inv.endDate?.slice(0, 4)
  if (a && b) return a === b ? a : `${a} to ${b}`
  return a ?? b ?? 'dates not listed'
}

// A neutral tile for each investigation: the shape and colour of its fuel class.
// EMBER uses no NASA logo, badge or patch, so no image from the record is shown here.
export function Thumb({ inv, size = 64 }: { inv: Investigation; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center border border-line bg-surface-2" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.5} height={size * 0.5} viewBox="-10 -10 20 20">
        <path d={markPath(inv.fuelClass, 6.5)} fill={inv.fuelClass === 'unknown' ? 'none' : `var(--fuel-${inv.fuelClass})`} stroke={`var(--fuel-${inv.fuelClass})`} strokeWidth={1.5} fillOpacity={/microgravity/i.test(inv.projectType) ? 0.9 : 0.15} />
      </svg>
    </span>
  )
}

// One investigation as a scannable row: rank, name, a few facts and its relevance for the habitat.
// The parts of the ranking sit behind the arrow.
export function InvestigationRow({
  inv,
  ranked,
  position,
  open,
  onToggle,
  selected,
  onSelect,
}: {
  inv: Investigation
  ranked: Ranked
  position: number
  open: boolean
  onToggle: () => void
  selected: boolean
  onSelect: (accession: string) => void
}) {
  return (
    <li className={`border-b border-line last:border-b-0 ${selected ? 'bg-surface-2' : ''}`}>
      <div className="flex items-center gap-1 pr-1 md:pr-2">
        <ScenarioLink to={`/investigations/${inv.accession}`} className="row-link min-w-0 flex-1 !px-3 !py-2.5 md:!px-4">
          <span className="num w-5 shrink-0 text-[12px] text-faint" aria-label={`Rank ${position}`}>
            {position}
          </span>
          <Thumb inv={inv} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{inv.displayName}</span>
            <span className="block truncate text-[12px] text-muted">
              {PILLAR_NAME[inv.pillar]} · {FUEL_NAME[inv.fuelClass]} · <span className="num">{inv.testCount}</span> {inv.testCount === 1 ? 'test' : 'tests'} · {years(inv)}
            </span>
          </span>
          <span className="hidden h-1.5 w-24 overflow-hidden bg-line md:block" aria-hidden="true">
            <span className="block h-full bg-ember" style={bar(ranked.score)} />
          </span>
          <span className="num w-8 shrink-0 text-right text-[17px] text-ink" title="Relevance for this habitat, out of 100">
            {Math.round(ranked.score)}
          </span>
        </ScenarioLink>
        <button type="button" className="btn btn-ghost btn-icon btn-sm shrink-0" aria-expanded={open} aria-label={`Why ${inv.displayName} has this rank`} title="Why this rank" onClick={onToggle}>
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <input type="checkbox" name={`compare-${inv.accession}`} checked={selected} onChange={() => onSelect(inv.accession)} className="h-4 w-4 shrink-0 accent-[var(--ember)]" aria-label={`Select ${inv.displayName} to compare`} title="Select to compare" />
      </div>
      {open ? (
        <div className="flex flex-col gap-3 px-4 pb-4 pt-1 md:pl-[76px]">
          <WhyRankBars ranked={ranked} />
          <p className="text-[13px] text-muted">{ranked.reason}</p>
          <div className="flex flex-wrap gap-1.5">
            <InvestigationChips inv={inv} />
            <InformsChips inv={inv} />
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function ContextCardView({ card, children }: { card: ContextCard; children?: ReactNode }) {
  return (
    <article className="card flex h-full flex-col gap-2 p-4 md:p-5">
      <span className="chip self-start">{card.kind === 'incident' ? 'Real incident' : 'NASA spinoff'}</span>
      <h3 className="text-[18px]">{card.title}</h3>
      <p className="text-[14px] text-muted">{card.text}</p>
      {children}
      <a href={card.url} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px]">
        {card.sourceName} <ExternalLink size={12} aria-hidden="true" />
      </a>
    </article>
  )
}
