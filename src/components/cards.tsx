// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The cards: insight, ranked investigation, incident and spinoff.
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ExternalLink } from 'lucide-react'
import type { ContextCard, Insight, Investigation, Scenario } from '../types.ts'
import { RANK_FORMULAS, RANK_WEIGHTS } from '../lib/ranking.ts'
import type { RankParts, Ranked } from '../lib/ranking.ts'
import { formatBytes } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { Chip, ScenarioLink, SiTag, SourcedNumber, VerifiedMark, useDrillProps } from './ui.tsx'

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

const INSIGHT_ORDER = ['I1', 'I2', 'I3', 'I12', 'I5', 'I7', 'I4', 'I6', 'I8', 'I9', 'I10', 'I11']

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
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <SiTag />
      </div>
    </article>
  )
}

const PART_KEYS: (keyof RankParts)[] = ['A', 'F', 'P', 'D']

export function WhyRankBars({ ranked }: { ranked: Ranked }) {
  const props = useDrillProps()
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
              className="drillable rounded px-1 py-0.5 hover:bg-surface-2"
              tabIndex={0}
              title={`${info.formula} Value ${value.toFixed(2)}, weight ${RANK_WEIGHTS[part]}.`}
              {...props([{ kind: 'rank', accession: ranked.accession, part }], `${info.label} for ${name}: ${value.toFixed(2)}. ${info.formula} Press Enter for the tests that were counted.`)}
            >
              <span className="flex items-baseline justify-between gap-1 text-[11px] text-muted">
                <span className="truncate">{info.label}</span>
                <span className="num text-ink">{value.toFixed(2)}</span>
              </span>
              <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-freefall" style={{ width: `${value * 100}%`, transition: 'width var(--t-scene) var(--ease-out)' }} />
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
        <span key={id} className="chip chip-ok" title="What this investigation informs. Drafted by SI, to be checked by the team.">
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

export function Thumb({ inv, size = 64 }: { inv: Investigation; size?: number }) {
  if (!inv.thumbnail) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-control bg-surface-2 text-center text-[10px] font-semibold text-muted" style={{ width: size, height: size }} aria-hidden="true">
        {inv.displayName.slice(0, 10)}
      </span>
    )
  }
  return <img src={inv.thumbnail} alt="" loading="lazy" width={size} height={size} className="shrink-0 rounded-control object-cover" style={{ width: size, height: size }} />
}

export function RankedCard({
  inv,
  ranked,
  position,
  compact = false,
  selected,
  onSelect,
}: {
  inv: Investigation
  ranked: Ranked
  position: number
  compact?: boolean
  selected?: boolean
  onSelect?: (accession: string) => void
}) {
  return (
    <motion.article layout="position" transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }} className={`card flex flex-col gap-3 p-4 ${selected ? 'border-ember' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="num w-6 shrink-0 pt-1 text-[14px] text-muted" aria-label={`Rank ${position}`}>
          {position}
        </span>
        <Thumb inv={inv} size={compact ? 44 : 64} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-tight">
            <ScenarioLink to={`/investigations/${inv.accession}`} className="text-ink">
              {inv.displayName}
            </ScenarioLink>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{inv.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="num block text-[22px] leading-none">{Math.round(ranked.score)}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted">relevance</span>
        </div>
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-1.5">
          <InvestigationChips inv={inv} />
          <InformsChips inv={inv} />
        </div>
      ) : null}
      {!compact ? (
        <p className="num text-[12px] text-muted">
          {inv.testCount} {inv.testCount === 1 ? 'test' : 'tests'} · {years(inv)} · archive {formatBytes(inv.totalFileSizeBytes)}
        </p>
      ) : null}
      <WhyRankBars ranked={ranked} />
      <p className="text-[13px] text-muted">{ranked.reason}</p>
      {onSelect ? (
        <label className="mt-auto flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={Boolean(selected)} onChange={() => onSelect(inv.accession)} className="h-4 w-4 accent-[var(--ember)]" />
          Select to compare
        </label>
      ) : null}
    </motion.article>
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
