// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Methods and about: how EMBER answers the challenge, the data, every formula, every assumption,
// the limits, the SI disclosure, the ten challenge resources and the sources.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { COVERAGE_FORMULA, DEFAULT_METHOD } from '../lib/coverage.ts'
import { D_SQUARED_FORMULA } from '../lib/droplet.ts'
import { RANK_FORMULAS, RANK_WEIGHTS } from '../lib/ranking.ts'
import { useData } from '../state/data.tsx'
import { LAST_EVALUATION, PASS_BARS } from '../config/evaluation.ts'
import { GATES } from '../three/flameParams.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { ScenarioLink } from '../components/ui.tsx'

const SECTIONS: { id: string; label: string }[] = [
  { id: 'challenge', label: 'How EMBER answers the challenge' },
  { id: 'data', label: 'Data and snapshot' },
  { id: 'pipeline', label: 'The pipeline' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'corrections', label: 'Label corrections' },
  { id: 'limits', label: 'Limits' },
  { id: 'fireball', label: 'The fireball' },
  { id: 'evaluation', label: 'Live answer and evaluation' },
  { id: 'si', label: 'SI disclosure' },
  { id: 'resources', label: 'Challenge resources' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'sources', label: 'Sources' },
  { id: 'licence', label: 'Licence and team' },
]

const CHALLENGE: { asks: string; does: ReactNode }[] = [
  { asks: 'Summarize, rank and interpret the investigations', does: <>Plain summaries on every <ScenarioLink to="/investigations">investigation page</ScenarioLink>. A ranking with "Why this rank". Insight cards with every number sourced.</> },
  { asks: '"Identify investigations most relevant to the fire safety needs of habitable crew environments, including spacecraft, space stations, bases on the lunar and Martian surfaces, and pressurized rovers"', does: <>Pick a habitat on the <ScenarioLink to="/">Brief</ScenarioLink>. The presets are those environments. The ranking, the coverage score and the <ScenarioLink to="/map">map</ScenarioLink> all answer for the one chosen.</> },
  { asks: '"Extract data that supports predictive modeling of flammability and fire scenarios in space exploration"', does: <>The whole normalized dataset as <a href="/data/tests.csv" download>one CSV</a>. The <ScenarioLink to="/lab">Lab</ScenarioLink> models, each checked against the real tests.</> },
  { asks: '"Highlight research that informs the development of next-generation fire safety controls and equipment"', does: <>"What this informs" chips on every investigation, and a filter by equipment on <ScenarioLink to="/investigations">Investigations</ScenarioLink>.</> },
  { asks: '"Your dashboard could also address potential applications of the PSI data to fire safety on Earth"', does: <>The <ScenarioLink to="/earth">Earth</ScenarioLink> screen, led by three NASA spinoffs.</> },
]

const PAPERS: { text: string; doi: string }[] = [
  { text: 'Dietrich and co-authors, Droplet Combustion Experiments Aboard the International Space Station, Microgravity Science and Technology, 2014. The d-squared law check. Listed in the PSI FLEX record.', doi: '10.1007/s12217-014-9372-2' },
  { text: 'Nayagam and co-authors, Can cool flames support quasi-steady alkane droplet burning?, Combustion and Flame, 2012. Background on cool flames.', doi: '10.1016/j.combustflame.2012.07.012' },
  { text: 'Olson and Ferkul, Microgravity flammability boundary for PMMA rods in axial stagnation flow, Combustion and Flame, 2017. Listed in the PSI BASS-II record.', doi: '10.1016/j.combustflame.2017.03.001' },
  { text: 'Urban and co-authors, Flame spread: Effects of microgravity and scale, Combustion and Flame, 2019. Listed in the PSI Saffire records.', doi: '10.1016/j.combustflame.2018.10.012' },
  { text: 'Meyer and co-authors, Smoke Characterization and Feasibility of the Moment Method for Spacecraft Fire Detection, Aerosol Science and Technology, 2015. Listed in the PSI SAME record.', doi: '10.1080/02786826.2015.1025124' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="mb-4 text-[22px]">
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-[15px] [&_p]:max-w-[70ch]">{children}</div>
    </section>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="num rounded-control bg-surface-2 px-3 py-2 text-[13px] !max-w-none">{children}</p>
}

export default function Methods() {
  const { snapshot, insights } = useData()
  const [params] = useSearchParams()
  const section = params.get('section')
  useEffect(() => {
    if (!section) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section])
  const c = snapshot.counts
  const twice = insights.filter((i) => i.verified === 'snapshot and raw files').map((i) => i.id)
  const m = DEFAULT_METHOD
  return (
    <div className="page">
      <PageHeader title="Methods and about" lead="How EMBER is made, what it assumes, and what it cannot tell you. Every claim on screen traces to a PSI record, a PSI table row or a cited source." />
      <div className="grid gap-8 lg:grid-cols-12">
        <nav aria-label="Sections" className="lg:col-span-3">
          <ul className="m-0 flex list-none flex-wrap gap-1 p-0 lg:sticky lg:top-24 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="nav-link !min-h-9 text-[13px]">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 lg:col-span-9">
          <Section id="challenge" title="How EMBER answers the challenge">
            <p>
              The Flame in Freefall challenge asks teams "to build an SI-powered, web-based dashboard that summarizes, ranks, and interprets combustion science investigations to deliver critical foundational insights for fire safety". It then names three abilities and one optional one. This table maps each to a screen.
            </p>
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">The challenge asks for</th>
                    <th scope="col">Where EMBER does it</th>
                  </tr>
                </thead>
                <tbody>
                  {CHALLENGE.map((row) => (
                    <tr key={row.asks}>
                      <td className="!static max-w-[420px]">{row.asks}</td>
                      <td>{row.does}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="data" title="Data and snapshot">
            <p>
              Every number in EMBER comes from NASA's Physical Sciences Informatics (PSI) repository at psi.nasa.gov. The snapshot was taken on <span className="num">{snapshot.fetchedAt.slice(0, 10)}</span>. It holds <span className="num">{c.investigations}</span> combustion investigations, <span className="num">{c.tables}</span> experimental tables with <span className="num">{c.rows.toLocaleString('en-US')}</span> rows, and <span className="num">{c.tests.toLocaleString('en-US')}</span> normalized tests. A table row that lists several oxygen levels for one test day becomes one test per level, and note rows are kept apart, which is why the two counts differ.
            </p>
            <p>
              The PSI service does not allow calls from a browser on another site, so the data is fetched once at build time and committed to the repository. The site reads only that committed snapshot. It cannot go down because PSI is down. The raw cell is kept beside every value EMBER read from it, and drill-through ends on exactly that.
            </p>
            <p>
              <a href="/data/tests.csv" download className="btn btn-primary">
                <Download size={16} aria-hidden="true" /> Download the whole normalized dataset, CSV
              </a>
            </p>
            <p className="text-[13px] text-muted">
              One row per test, with the oxygen fraction, the pressure in atmospheres, a source column that says table or assumed for each, the fuel, the outcome and the droplet values. The file was produced by SI-drafted code from NASA PSI data. Most PSI records carry the CC0-1.0 licence.
            </p>
            <p>Three PSI endpoints are used, with no key and no login: the investigation search listing, the investigation record, and the experimental table download.</p>
          </Section>

          <Section id="pipeline" title="The pipeline">
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5">
              <li>Fetch. A script downloads the records and tables one request at a time, trims the records and drops every email address. It never runs in a deploy.</li>
              <li>Normalize. One tolerant number parser reads the cells. A cell is a number only if it starts with a digit, a minus sign or a decimal point, so a note such as "LOW O2" is not read as 2.</li>
              <li>Insights. Twelve cards are computed from the snapshot. Their wording is filled in from the numbers.</li>
              <li>
                Verify, twice. Level 1 recomputes every number from the snapshot. Level 2 recomputes the headline cards ({twice.join(', ')}) straight from the raw CSV files with separate code that does not use the normalizer. Cards that pass both carry a "Verified twice" mark.
              </li>
              <li>Evidence bundle and search index. One file of citable items is built. The site serves it and the server function reads the same file.</li>
            </ol>
            <p>Steps 2 to 5 give byte-identical files from the same inputs. Every build reruns them and fails if a committed file differs, which catches a number edited by hand.</p>
          </Section>

          <Section id="formulas" title="Formulas">
            <h3 className="text-[18px]">Atmospheres and units</h3>
            <Formula>1 atm = 101.325 kPa = 14.696 psi = 760 mmHg. 1 bar = 0.98692 atm. ppO2 = xO2 × P.</Formula>
            <p>The normoxic line on the map is every atmosphere with the same oxygen partial pressure as sea level air: xO2 × P = 0.2095 atm. Flammability does not follow this line. Lower pressure with more oxygen keeps breathing normal and makes most materials easier to burn.</p>
            <h3 className="text-[18px]">Evidence Coverage</h3>
            <p>The score measures how much real flight evidence sits close to the chosen atmosphere. It is not a safety rating.</p>
            <Formula>{COVERAGE_FORMULA}</Formula>
            <Formula>
              overall = {m.pillarWeights.prevention} × prevention + {m.pillarWeights.detection} × detection + {m.pillarWeights.suppression} × suppression. Fundamentals tests, and tests of an investigation's secondary pillar, count at a weight of {m.fundamentalsWeight}.
            </Formula>
            <p>
              The constants {m.o2Scale}, {m.pressureScale}, {m.saturation}, {m.fundamentalsWeight} and the pillar weights are design choices by the team. Ten effective tests give a score of 63 and thirty give 95. Gravity is handled as a separate flag and is not folded into the number.
            </p>
            <h3 className="text-[18px]">Relevance ranking</h3>
            <p>A transparent heuristic. Each ranked card shows its four parts.</p>
            <Formula>
              score = 100 × ({RANK_WEIGHTS.A} × A + {RANK_WEIGHTS.F} × F + {RANK_WEIGHTS.P} × P + {RANK_WEIGHTS.D} × D)
            </Formula>
            {(['A', 'F', 'P', 'D'] as const).map((part) => (
              <Formula key={part}>
                {RANK_FORMULAS[part].label}: {RANK_FORMULAS[part].formula}
              </Formula>
            ))}
            <h3 className="text-[18px]">Droplet burning</h3>
            <Formula>{D_SQUARED_FORMULA} K is the burning rate constant in mm² per second.</Formula>
            <p>Source: Dietrich and co-authors, 2014, listed in the PSI FLEX record. The Lab checks this law against every FLEX test that has all four values.</p>
            <h3 className="text-[18px]">The Moon Base region</h3>
            <p>Oxygen of 30 percent or more at 10.2 psi or less, from the challenge statement. A test is inside it only when its table states both values. Tests within 5 percent above the pressure line are reported as on the edge.</p>
          </Section>

          <Section id="assumptions" title="Declared assumptions">
            <p>
              Some PSI tables do not state an atmosphere. EMBER then uses a declared assumption. Assumed values are drawn as hollow marks, carry the word assumed in every table, and count at half weight in the coverage score. They are never presented as measured. <span className="num">{c.testsWithAssumedOxygen}</span> tests have an assumed oxygen value and <span className="num">{c.testsWithAssumedValue}</span> have at least one assumed value.
            </p>
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Investigation</th>
                    <th scope="col">Oxygen</th>
                    <th scope="col">Pressure</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.assumptions.map((a) => (
                    <tr key={a.accession}>
                      <td>
                        <ScenarioLink to={`/investigations/${a.accession}`}>{snapshot.investigations.find((i) => i.accession === a.accession)?.displayName ?? a.accession}</ScenarioLink>
                      </td>
                      <td className="num">{a.o2 == null ? 'from the table' : `${a.o2 * 100}% assumed`}</td>
                      <td className="num">{a.pressureAtm == null ? 'from the table' : `${a.pressureAtm} atm assumed`}</td>
                      <td className="max-w-[360px]">{a.reason}</td>
                      <td className="text-warn">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-muted">The pillar of each investigation, its hardware family and what it informs are also drafts by SI. Each carries the status "needs human check" until the team confirms it from the PSI record.</p>
          </Section>

          <Section id="corrections" title="Label corrections">
            <p>Some column headers lost a subscript, a superscript or a symbol in the PSI files. EMBER shows a corrected label and keeps the original in the raw view.</p>
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Table</th>
                    <th scope="col">As in the file</th>
                    <th scope="col">Shown as</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.labelCorrections.map((l) => (
                    <tr key={l.table + l.original}>
                      <td>{snapshot.investigations.find((i) => i.accession === l.accession)?.displayName ?? l.accession}</td>
                      <td className="num">{l.original}</td>
                      <td className="num">{l.corrected}</td>
                      <td className="max-w-[360px]">{l.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>A few cells are corrected too, and each such test is flagged: the ACME BRE oxygen values 3400% and 2100% are read as 34 and 21, and fuel names that count up through CH5, CH6 and so on in two ACME tables are read as the fuel in the first row.</p>
          </Section>

          <Section id="limits" title="Limits">
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
              <li>The Evidence Coverage score counts evidence. It is not a safety rating. EMBER never says a material, an atmosphere or a habitat is safe or unsafe.</li>
              <li>The ranking is a heuristic. Its weights are the team's judgment.</li>
              <li>The PSI test tables are summaries. The full datasets, with video and sensor files, are far larger and are not read by EMBER.</li>
              <li>Assumed atmospheres are marked and count at half weight. They are still assumptions.</li>
              <li>PSI holds no partial-gravity combustion tests. Nothing here describes how a flame behaves on the Moon or Mars.</li>
              <li>Tests of inverse gas flames reach 85 percent oxygen. That is the oxidizer stream and not a cabin atmosphere.</li>
              <li>The Lab models are simple fits to the tables. They are not design tools.</li>
              <li>The answer checker proves that ids and numbers match the evidence. It cannot prove that a sentence means what its source means.</li>
            </ul>
          </Section>

          <Section id="fireball" title="The fireball">
            <p>
              The fireball on the Brief is an SI-generated illustration, drawn by shader code in the browser with three.js. Every view of it carries a visible label. There are no model files. It is driven by the NASA tests near the chosen atmosphere: the burning rate and the outcomes come from the FLEX table, and the listed flame temperature comes from the ACME gas flame tables. The three numbers beside it each open their rows.
            </p>
            <p>
              The temperature scale has two labelled ends, about 300 K for cabin air and about 2,300 K for a typical flame, from page 8 of NASA's Researcher's Guide to Combustion Science. The pattern between them is drawn, not computed. No pressure effect on the flame is drawn, because the tables do not show one. No shape between the Earth flame and the fireball is drawn, because no partial-gravity test exists.
            </p>
            <p>
              Two details wait on a check by the team's science lead. The mark on the temperature scale {GATES.tadConfirmed ? 'moves, now that' : 'does not move until'} the ACME column headed Tad (K) is confirmed as the adiabatic flame temperature. The droplet in the Lab {GATES.burningRateUnitConfirmed ? 'is animated, now that' : 'is not animated until'} the FLEX burning rate unit is confirmed as mm² per second.
            </p>
          </Section>

          <Section id="evaluation" title="Live answer and evaluation">
            <p>
              On the Ask screen a live language model may write a short answer. It is reached through OpenRouter from one server function on Vercel. The first choice is Claude Haiku 5.5 and the backup is GPT-6 Luna. The browser sends the question, the habitat and a list of evidence ids. The function looks up the evidence text itself, so the model only ever sees text that EMBER built from NASA data. EMBER does not store questions.
            </p>
            <p>The browser then checks the answer. A sentence is removed when it cites no source or an unknown one, when it holds a number that is not in its source, when it says safe or unsafe or calls anything a safety rating, or when it shares too few words with its source. Fewer than two surviving sentences and the live answer is dropped. The evidence answer always stays on screen.</p>
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table className="data-table">
                <caption className="sr-only">The pass bars of the evaluation</caption>
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">How it is measured</th>
                    <th scope="col">Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {PASS_BARS.map((bar) => (
                    <tr key={bar.measure}>
                      <td>{bar.measure}</td>
                      <td>{bar.how}</td>
                      <td>{bar.pass}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {LAST_EVALUATION ? (
              <div className="table-wrap" style={{ maxHeight: 'none' }}>
                <table className="data-table">
                  <caption className="sr-only">The last evaluation run</caption>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">Date</th>
                      <th scope="col">Answer rate</th>
                      <th scope="col">Sentence quality</th>
                      <th scope="col">Trick questions</th>
                      <th scope="col">Verdict language</th>
                      <th scope="col">First word</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LAST_EVALUATION.map((run) => (
                      <tr key={run.model}>
                        <td>{run.model}</td>
                        <td className="num">{run.date}</td>
                        <td className="num">{run.answerRate}</td>
                        <td className="num">{run.sentenceQuality}</td>
                        <td className="num">{run.trickQuestions}</td>
                        <td className="num">{run.verdictLanguage}</td>
                        <td className="num">{run.medianFirstWordSeconds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-control bg-surface-2 px-3 py-2 text-[14px]">The evaluation set is fixed: 12 real questions and 5 trick questions. Retrieval recall is tested on every build. The answer rate and the other live measures are published here after the first run against the live model. No result is shown until it has been measured.</p>
            )}
          </Section>

          <Section id="si" title="SI disclosure">
            <p>Super Intelligence (SI) is the event's word for AI. The organizers confirmed to the team on 14 November 2026 that using AI is allowed. This is how it was used.</p>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
              <li>Research and planning. An SI assistant helped read the challenge, probe the PSI service and write the build plan.</li>
              <li>Code. The application code, the build scripts and the tests were drafted with an SI coding assistant (Claude Code with the Fable 5.2 model) during the event and reviewed by the team. Source files carry a one-line SI header.</li>
              <li>Words. The plain summaries of each investigation, the wording of the insight cards, the glossary and the context cards were drafted by SI from PSI text and NASA pages. They are marked "SI drafted, checked against PSI data". The numbers in them are computed from the data, not written by SI.</li>
              <li>Data files. Every generated data file carries a generatedBy field that says how it was made.</li>
              <li>The live models. Claude Haiku 5.5 and GPT-6 Luna, reached through OpenRouter, answer questions on the Ask screen from the NASA evidence shown and nothing else. Each answer names the path that produced it.</li>
              <li>The fireball. Its shader code is SI-assisted and what it draws is treated as SI-generated visual content, so every view carries the label "SI-generated illustration". No SI image or video generator was used.</li>
              <li>Search by meaning, when enabled, runs a small open embedding model in the browser.</li>
            </ul>
            <p>
              What the team did themselves: chose and shaped the concept, made the design and story decisions, checks the science and every insight against the data, confirms the declared assumptions, reviews the pinned answers, tests the app and records the demo. No NASA logo, insignia or mission patch is used anywhere. The full statement is in SI-DISCLOSURE.md in the repository.
            </p>
          </Section>

          <Section id="resources" title="The ten challenge resources">
            <p>The ten NASA Data and Resources links from the challenge Resources tab. The first is the data. The rest are context and stay out of the score, the ranking and the map.</p>
            <ol className="m-0 flex list-decimal flex-col gap-3 pl-5">
              {snapshot.resources.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                  <span className="block text-[14px] text-muted">{r.use}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="glossary" title="Glossary">
            <dl className="m-0 grid gap-4 md:grid-cols-2">
              {snapshot.glossary.map((g) => (
                <div key={g.id} id={`G-${g.id}`}>
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="m-0 text-[14px] text-muted">{g.definition}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="sources" title="Sources">
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14px]">
              <li>
                NASA Physical Sciences Informatics repository, <a href="https://psi.nasa.gov" target="_blank" rel="noreferrer">psi.nasa.gov</a>. The {c.investigations} combustion investigations are listed on the <ScenarioLink to="/investigations">Investigations</ScenarioLink> screen, each with its accession, DOI and licence.
              </li>
              <li>
                The challenge statement, <a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall" target="_blank" rel="noreferrer">Flame in Freefall</a>, NASA Space Apps Challenge 2026.
              </li>
              <li>
                A Researcher's Guide to: Combustion Science, NASA, 2015 (
                <a href="https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf" target="_blank" rel="noreferrer">PDF</a>).
              </li>
              <li>
                NASA exploration atmosphere reports: <a href="https://ntrs.nasa.gov/citations/20130013505" target="_blank" rel="noreferrer">NTRS 20130013505</a> and <a href="https://ntrs.nasa.gov/citations/20150021491" target="_blank" rel="noreferrer">NTRS 20150021491</a>. Only the abstracts were read.
              </li>
              {PAPERS.map((p) => (
                <li key={p.doi}>
                  {p.text}{' '}
                  <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="num">
                    doi {p.doi}
                  </a>
                </li>
              ))}
              <li>Open source libraries: React, React Router, Vite, TypeScript, Tailwind CSS, d3 modules, MiniSearch, three.js, Motion, Lucide, and the Inter, Space Grotesk and JetBrains Mono typefaces. Versions and licences are in SOURCES.md in the repository.</li>
            </ul>
          </Section>

          <Section id="licence" title="Licence and team">
            <p>
              EMBER is open source under the Apache 2.0 licence. The code is at{' '}
              <a href="https://github.com/SUMMERxKx/NasaHackathon" target="_blank" rel="noreferrer">
                github.com/SUMMERxKx/NasaHackathon
              </a>
              . It was built by team Low Cortisol Gng for the NASA Space Apps Challenge 2026, with NASA open data from the PSI repository. NASA does not endorse this project.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
