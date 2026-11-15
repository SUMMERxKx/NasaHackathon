// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Earth: three NASA spinoffs, then the Earth benefits named in the PSI records themselves.
import type { Investigation } from '../types.ts'
import { useData } from '../state/data.tsx'
import { PageHeader } from '../components/AppShell.tsx'
import { ContextCardView } from '../components/cards.tsx'
import { ScenarioLink } from '../components/ui.tsx'

const GROUPS: { id: string; title: string; lead: string; pillars: string[] }[] = [
  { id: 'detection', title: 'Detection', lead: 'Smoke and aerosol research that informs fire detectors.', pillars: ['detection'] },
  { id: 'suppression', title: 'Suppression', lead: 'Extinction research that informs how fires are put out.', pillars: ['suppression'] },
  { id: 'materials', title: 'Materials', lead: 'Flammability research that informs which materials are chosen.', pillars: ['prevention'] },
  { id: 'efficiency', title: 'Combustion efficiency', lead: 'Flame research that informs cleaner and more efficient engines and power plants.', pillars: ['fundamentals'] },
]

const EARTH_WORDS = /earth|terrestrial|engine|emission|pollut|power plant|efficien|detector|industr|vehicle|transport|fuel econom/i

// The sentences of the PSI record that name a benefit on Earth, in NASA's own words.
export function earthSentences(inv: Investigation): string[] {
  const sentences = inv.researchImpacts.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z(0-9])/)
  return sentences.filter((s) => EARTH_WORDS.test(s) && s.length > 40).slice(0, 2)
}

export default function Earth() {
  const { snapshot, invByAcc } = useData()
  const spinoffs = snapshot.context.filter((c) => c.kind === 'spinoff')
  return (
    <div className="page">
      <PageHeader title="Back on Earth" lead="Fire research for space also pays off on the ground. Three NASA spinoffs lead this page. Under them are the Earth benefits that the PSI records themselves name." />

      <section aria-labelledby="spinoffs-title">
        <h2 id="spinoffs-title" className="mb-4 text-[22px]">
          Three NASA spinoffs
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {spinoffs.map((card) => (
            <ContextCardView key={card.id} card={card}>
              {card.related ? (
                <p className="text-[13px]">
                  PSI investigations that studied smoke and dust particles:{' '}
                  {card.related.filter((a) => invByAcc[a]).map((a, i) => (
                    <span key={a}>
                      {i > 0 ? ', ' : ''}
                      <ScenarioLink to={`/investigations/${a}`}>{invByAcc[a].displayName}</ScenarioLink>
                    </span>
                  ))}
                </p>
              ) : null}
            </ContextCardView>
          ))}
        </div>
        <p className="prose-width mt-4 text-[14px] text-muted">
          The challenge statement adds: "Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth, and NASA technology has similarly led to improvements in terrestrial smoke detection and firefighter gear, including protective clothing and air tanks."{' '}
          <a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall" target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
        <p className="mt-2 text-[13px] text-muted">These pages are context. They are not test data, and they stay out of the coverage score, the ranking and the map.</p>
      </section>

      {GROUPS.map((group) => {
        const cards = snapshot.investigations.filter((inv) => group.pillars.includes(inv.pillar)).map((inv) => ({ inv, sentences: earthSentences(inv) })).filter((c) => c.sentences.length > 0)
        if (cards.length === 0) return null
        return (
          <section key={group.id} aria-labelledby={`${group.id}-title`} className="mt-10">
            <h2 id={`${group.id}-title`} className="text-[22px]">
              {group.title}
            </h2>
            <p className="mb-4 mt-1 text-[14px] text-muted">{group.lead}</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cards.map(({ inv, sentences }) => (
                <article key={inv.accession} className="card flex flex-col gap-2 p-4">
                  <h3 className="text-[16px]">
                    <ScenarioLink to={`/investigations/${inv.accession}`} className="text-ink">
                      {inv.displayName}
                    </ScenarioLink>
                  </h3>
                  <blockquote className="m-0 border-l-2 border-line pl-3 text-[14px] text-muted">{sentences.join(' ')}</blockquote>
                  <p className="mt-auto pt-1 text-[12px] text-faint">
                    From the research impacts field of the PSI record{' '}
                    <a href={inv.psiUrl} target="_blank" rel="noreferrer" className="num">
                      {inv.accession}
                    </a>
                    , in NASA's words.
                  </p>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
