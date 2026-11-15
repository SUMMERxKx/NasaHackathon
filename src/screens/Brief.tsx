// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Brief: the fireball, the habitat picker, the coverage dial, the top insights and investigations,
// the biggest gaps and three real incidents.
import { useMemo } from 'react'
import { ArrowRight, ExternalLink, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { computeCoverage, scenarioPoint } from '../lib/coverage.ts'
import { useData } from '../state/data.tsx'
import { useCoverage, useRanking, useScenario } from '../state/hooks.ts'
import { fromHabitat } from '../state/scenario.ts'
import { CoverageDial, CoveragePanel } from '../components/Coverage.tsx'
import { FireballStage } from '../components/FireballStage.tsx'
import { HabitatCard, habitatFacts } from '../components/Habitat.tsx'
import { ContextCardView, InsightCard, RankedCard, surfaceInsights } from '../components/cards.tsx'
import { NotASafetyRating, ScenarioLink, SourcedNumber } from '../components/ui.tsx'

function Hero() {
  return (
    <section className="dot-grid -mx-4 mb-8 px-4 py-6 md:-mx-6 md:px-6 md:py-10" aria-labelledby="page-title">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5 lg:pt-6">
          <p className="eyebrow">EMBER · a fire evidence map for crew habitats</p>
          <h1 id="page-title" tabIndex={-1} className="text-[36px] leading-[1.05] outline-none md:text-[48px]">
            What do we really know about fire where you are going?
          </h1>
          <p className="prose-width text-[18px] text-muted">
            On Earth, hot gas rises and a flame streams upward. In freefall nothing rises, so a flame becomes a slow sphere that feeds on whatever oxygen drifts in. EMBER shows what NASA's flight tests cover for the habitat you care about, and where the gaps are.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#habitats" className="btn btn-primary">
              Pick your habitat <ArrowRight size={16} aria-hidden="true" />
            </a>
            <ScenarioLink to="/" extra={{ story: '1' }} className="btn btn-ghost">
              <Play size={16} aria-hidden="true" /> Play the story
            </ScenarioLink>
          </div>
          <p className="text-[13px] text-muted">Built with NASA open data from the PSI repository. Every number opens the NASA rows it came from.</p>
        </div>
        <div>
          <FireballStage />
          <p className="mt-3 text-[13px]">
            <a href="https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
              See real flame photos from the space station on nasa.gov <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

function CompareHabitats() {
  const data = useData()
  const { scenario, setScenario } = useScenario()
  const rows = useMemo(() => data.habitats.map((h) => ({ h, coverage: computeCoverage(data.tests, data.lookup, scenarioPoint(h)) })), [data])
  return (
    <section aria-labelledby="compare-habitats" className="mt-10">
      <h2 id="compare-habitats" className="text-[22px]">
        Compare habitats
      </h2>
      <p className="mt-1 text-[14px] text-muted">Evidence Coverage for every preset, side by side. Choose one to switch to it.</p>
      <ul className="hide-scrollbar m-0 mt-4 flex list-none snap-x gap-3 overflow-x-auto p-0 pb-1 md:grid md:grid-cols-6 md:overflow-visible">
        {rows.map(({ h, coverage }) => (
          <li key={h.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setScenario(fromHabitat(h, scenario.focus, scenario.flowCmS))}
              aria-pressed={scenario.presetId === h.id}
              className={`card flex w-[136px] flex-col items-center gap-1 p-3 text-center transition-colors hover:bg-surface-2 md:w-full ${scenario.presetId === h.id ? 'border-ember' : ''}`}
            >
              <CoverageDial coverage={coverage} size={120} interactive={false} label={h.name} />
              <span className="text-[13px] font-semibold leading-tight">{h.name}</span>
              <span className="num text-[11px] text-muted">{habitatFacts(h)}</span>
            </button>
          </li>
        ))}
      </ul>
      <NotASafetyRating className="mt-3" />
    </section>
  )
}

export default function Brief() {
  const data = useData()
  const { scenario, name, setScenario } = useScenario()
  const coverage = useCoverage()
  const ranking = useRanking()
  const { snapshot } = data
  const surfaced = useMemo(() => surfaceInsights(data.insights, scenario).slice(0, 3), [data.insights, scenario])
  const gaps = data.insights.filter((c) => c.pillar === 'gap')
  const incidents = snapshot.context.filter((c) => c.kind === 'incident')
  const nearbyTotal = coverage.nearbyTotal
  return (
    <div className="page">
      <Hero />

      <section id="habitats" aria-labelledby="habitats-title" className="scroll-mt-24">
        <h2 id="habitats-title" className="text-[22px]">
          Pick your habitat
        </h2>
        <p className="mt-1 text-[14px] text-muted">Each preset is an atmosphere a crew may live in. Use the habitat control in the top bar for a custom one.</p>
        <div className="hide-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-6">
          {snapshot.habitats.map((h) => (
            <HabitatCard key={h.id} habitat={h} selected={scenario.presetId === h.id} onPick={() => setScenario(fromHabitat(h, scenario.focus, scenario.flowCmS))} />
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <section className="card p-5 lg:col-span-5" aria-labelledby="coverage-title">
          <h2 id="coverage-title" className="mb-4 text-[18px]">
            {name}
          </h2>
          <CoveragePanel coverage={coverage} name={name} focus={scenario.focus} onFocus={(focus) => setScenario({ ...scenario, focus })} />
          <p className="mt-4 text-[13px] text-muted">
            <SourcedNumber path={[{ kind: 'near', o2: scenario.o2, pressureAtm: scenarioPoint(scenario).pressureAtm }]} label={`${nearbyTotal} tests within one unit of this habitat`}>
              {nearbyTotal}
            </SourcedNumber>{' '}
            tests sit within one unit of distance of this atmosphere.{' '}
            <ScenarioLink to="/map">See them on the map</ScenarioLink>
          </p>
        </section>

        <section className="lg:col-span-7" aria-labelledby="insights-title">
          <h2 id="insights-title" className="mb-4 text-[22px]">
            What the evidence says for this habitat
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {surfaced.map((card, i) => (
                <motion.div key={card.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
                  <InsightCard card={card} compact />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="top-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="top-title" className="text-[22px]">
              Most relevant investigations
            </h2>
            <ScenarioLink to="/investigations" className="text-[14px]">
              All {snapshot.investigations.length}
            </ScenarioLink>
          </div>
          <div className="flex flex-col gap-3">
            {ranking.slice(0, 5).map((r, i) => (
              <RankedCard key={r.accession} inv={data.invByAcc[r.accession]} ranked={r} position={i + 1} compact />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">A relevance ranking for this habitat. It is a transparent heuristic, not a verdict.</p>
        </section>

        <section className="lg:col-span-5" aria-labelledby="gaps-title">
          <h2 id="gaps-title" className="mb-4 text-[22px]">
            Biggest gaps
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {gaps.map((card) => (
              <li key={card.id} className="card border-l-2 border-l-gap p-4">
                <p className="text-[28px] leading-none">
                  <SourcedNumber path={[{ kind: 'insight', id: card.id, number: card.primary }]} label={`${card.display[card.primary]}. ${card.headline}`}>
                    {card.display[card.primary]}
                  </SourcedNumber>
                </p>
                <p className="mt-2 text-[14px] font-semibold">{card.headline}</p>
                <p className="mt-1 text-[13px] text-muted">{card.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">A gap is a finding. It tells mission designers what has not been tested yet.</p>
        </section>
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer font-display text-[18px] font-semibold">See all {data.insights.length} insight cards</summary>
        <p className="mt-1 text-[14px] text-muted">Every number is computed from the PSI snapshot and recomputed by the build. Choose a number to open the rows behind it.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.insights.map((card) => (
            <InsightCard key={card.id} card={card} />
          ))}
        </div>
      </details>

      <CompareHabitats />

      <section aria-labelledby="why-title" className="mt-10">
        <h2 id="why-title" className="text-[22px]">
          Why this matters
        </h2>
        <blockquote className="prose-width mt-3 border-l-2 border-ember pl-4 text-[18px]">
          <p>“{snapshot.quotes.artemis.text}”</p>
          <footer className="mt-2 text-[13px] text-muted">
            {snapshot.quotes.artemis.attribution}.{' '}
            <a href={snapshot.quotes.artemis.url} target="_blank" rel="noreferrer">
              Source
            </a>
          </footer>
        </blockquote>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {incidents.map((card) => (
            <ContextCardView key={card.id} card={card} />
          ))}
        </div>
        <p className="mt-4 text-[14px]">
          <a href={snapshot.quotes.watchFirst.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            <Play size={14} aria-hidden="true" /> {snapshot.quotes.watchFirst.label} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      </section>
    </div>
  )
}
