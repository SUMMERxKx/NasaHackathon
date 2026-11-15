// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The sections of the About screen: how EMBER answers the challenge, the data, every formula,
// every assumption, the limits, the visuals, the live answer, the SI disclosure and the sources.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Download, ExternalLink, Play } from 'lucide-react'
import { COVERAGE_FORMULA, DEFAULT_METHOD, PILLARS, computeCoverage, pillarLookup, scenarioPoint } from '../../lib/coverage.ts'
import { D_SQUARED_FORMULA } from '../../lib/droplet.ts'
import { SAFFIRE_2, burnLengthPairs } from '../../lib/lab.ts'
import { plottable } from '../../lib/mapLayout.ts'
import { NEARBY_RULE, NOT_PROOF, isInverseFlame } from '../../lib/nearby.ts'
import { RANK_FORMULAS, RANK_WEIGHTS } from '../../lib/ranking.ts'
import { byAccession, groupBy } from '../../lib/stats.ts'
import { formatNumber, formatPercent } from '../../lib/units.ts'
import { useData } from '../../state/data.tsx'
import { useCoverage, useScenario } from '../../state/hooks.ts'
import { EVALUATION_NOTE, LAST_EVALUATION, MEANING_CHECK, PASS_BARS } from '../../config/evaluation.ts'
import { GATES } from '../../three/flameParams.ts'
import { SCALE_NOTE } from '../../three/ramp.ts'
import { BASIS, DRIVERS } from '../../components/FireballStage.tsx'
import { CoverageDial, PILLAR_LABEL, PillarMini } from '../../components/Coverage.tsx'
import { ContextCardView, InsightCard } from '../../components/cards.tsx'
import { NotASafetyRating, ScenarioLink } from '../../components/ui.tsx'

const CHALLENGE: { asks: string; does: ReactNode }[] = [
  { asks: 'Summarize, rank and interpret the investigations', does: <>Plain summaries on every <ScenarioLink to="/investigations">investigation page</ScenarioLink>. A ranking with "Why this rank". <ScenarioLink to="/about?section=findings">Findings</ScenarioLink> with every number sourced.</> },
  { asks: '"Identify investigations most relevant to the fire safety needs of habitable crew environments, including spacecraft, space stations, bases on the lunar and Martian surfaces, and pressurized rovers"', does: <>Pick a habitat on the <ScenarioLink to="/dashboard">dashboard</ScenarioLink>. The presets are those environments. The nearby counts, the map and the ranking all answer for the one chosen.</> },
  { asks: '"Extract data that supports predictive modeling of flammability and fire scenarios in space exploration"', does: <>The whole normalized dataset as <a href="/data/tests.csv" download>one CSV</a>. The <ScenarioLink to="/lab">Lab</ScenarioLink> models, each checked against the real tests.</> },
  { asks: '"Highlight research that informs the development of next-generation fire safety controls and equipment"', does: <>"Informs" chips on every investigation, and a filter by equipment on <ScenarioLink to="/investigations">Investigations</ScenarioLink>.</> },
  { asks: '"Your dashboard could also address potential applications of the PSI data to fire safety on Earth"', does: <>The <ScenarioLink to="/about?section=earth">Back on Earth</ScenarioLink> section here, led by three NASA spinoffs.</> },
]

const PAPERS: { text: string; doi: string }[] = [
  { text: 'Dietrich and co-authors, Droplet Combustion Experiments Aboard the International Space Station, Microgravity Science and Technology, 2014. The d-squared law check. Listed in the PSI FLEX record.', doi: '10.1007/s12217-014-9372-2' },
  { text: 'Nayagam and co-authors, Can cool flames support quasi-steady alkane droplet burning?, Combustion and Flame, 2012. Background on cool flames.', doi: '10.1016/j.combustflame.2012.07.012' },
  { text: 'Olson and Ferkul, Microgravity flammability boundary for PMMA rods in axial stagnation flow, Combustion and Flame, 2017. Listed in the PSI BASS-II record.', doi: '10.1016/j.combustflame.2017.03.001' },
  { text: 'Urban and co-authors, Flame spread: Effects of microgravity and scale, Combustion and Flame, 2019. Listed in the PSI Saffire records.', doi: '10.1016/j.combustflame.2018.10.012' },
  { text: 'Meyer and co-authors, Smoke Characterization and Feasibility of the Moment Method for Spacecraft Fire Detection, Aerosol Science and Technology, 2015. Listed in the PSI SAME record.', doi: '10.1080/02786826.2015.1025124' },
]

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
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
  return <p className="num bg-surface-2 px-3 py-2 text-[13px] !max-w-none">{children}</p>
}

// What EMBER is, how it answers the challenge and why the question matters.
export function OverviewSection() {
  const { snapshot } = useData()
  const incidents = snapshot.context.filter((c) => c.kind === 'incident')
  return (
    <>
      <Section id="overview" title="What EMBER is">
        <p>
          EMBER answers one question. For the crew habitat you care about, what does NASA's microgravity fire evidence cover, what does it tell us, and where are the gaps? On Earth, hot gas rises and a flame streams upward. In freefall nothing rises, so a flame becomes a slow sphere that feeds on whatever oxygen drifts in.
        </p>
        <p>
          Pick a habitat on the dashboard. EMBER counts the NASA test records near it, says what is missing, maps every real flight test, ranks the investigations and answers questions from that evidence. Every number opens the NASA rows it came from. The counts and the Evidence Coverage score describe evidence. Neither is a safety rating.
        </p>
        <p>
          <ScenarioLink to="/dashboard" extra={{ story: '1' }} className="btn btn-secondary btn-sm">
            <Play size={14} aria-hidden="true" /> Take the tour
          </ScenarioLink>
        </p>
      </Section>
    <Section id="challenge" title="How EMBER answers the challenge">
      <p>
        The Flame in Freefall challenge asks teams "to build an SI-powered, web-based dashboard that summarizes, ranks, and interprets combustion science investigations to deliver critical foundational insights for fire safety". It then names three abilities and one optional one. This table maps each to a place in EMBER.
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

      <Section id="why" title="Why this matters">
        <blockquote className="m-0 max-w-[70ch] border-l-2 border-ember pl-4 text-[18px]">
          <p>“{snapshot.quotes.artemis.text}”</p>
          <footer className="mt-2 text-[13px] text-muted">
            {snapshot.quotes.artemis.attribution}.{' '}
            <a href={snapshot.quotes.artemis.url} target="_blank" rel="noreferrer">
              Source
            </a>
          </footer>
        </blockquote>
        <div className="grid gap-4 md:grid-cols-3">
          {incidents.map((card) => (
            <ContextCardView key={card.id} card={card} />
          ))}
        </div>
        <p className="text-[14px]">
          <a href={snapshot.quotes.watchFirst.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            <Play size={14} aria-hidden="true" /> {snapshot.quotes.watchFirst.label} <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
        <p className="text-[13px] text-muted">These pages are context. They are not test data, and they stay out of the coverage score, the ranking and the map.</p>
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
    </>
  )
}

// All twelve insight cards. Every number is recomputed by the build and opens its rows.
export function FindingsSection() {
  const { insights } = useData()
  return (
    <Section id="findings" title="Findings">
      <p>Twelve findings, each computed from the PSI snapshot and recomputed by the build. Choose a number to open the rows behind it. A gap is a finding too. It tells mission designers what has not been tested yet.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((card) => (
          <InsightCard key={card.id} card={card} />
        ))}
      </div>
    </Section>
  )
}

// The coverage score for the chosen habitat: the dial, the three pillars and what the dim part
// of each bar means. It moved here from the dashboard, with every row link intact.
function CoverageDetails() {
  const { scenario, name } = useScenario()
  const coverage = useCoverage()
  return (
    <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5" role="group" aria-label={`Evidence Coverage for ${name}`}>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <CoverageDial coverage={coverage} size={160} label={name} />
        <NotASafetyRating />
      </div>
      <div className="min-w-0 flex-1">
        <p className="!max-w-none text-[15px] font-semibold">
          {name}{' '}
          <span className="num text-[13px] font-normal text-muted">
            {formatPercent(scenario.o2)} oxygen · {formatNumber(scenario.pressurePsi, 1)} psi
          </span>
        </p>
        <div className="mt-2 max-w-[420px]">
          <PillarMini coverage={coverage} />
        </div>
        <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-[13px] text-muted">
          {PILLARS.map((pillar) => {
            const p = coverage.byPillar[pillar]
            return (
              <li key={pillar}>
                {PILLAR_LABEL[pillar]}: <span className="num text-ink">{Math.round(p.score)}</span> out of 100, from <span className="num text-ink">{formatNumber(p.effectiveTests, 1)}</span> effective tests. <span className="num text-ink">{formatPercent(p.assumedShare, 0)}</span> of that rests on assumed values.
              </li>
            )
          })}
        </ul>
        <p className="mt-3 !max-w-none text-[13px] text-muted">
          The bright part of a bar and the solid part of the dial come from values stated in the tables. The dim and hatched part is the share that rests on an assumed oxygen or pressure value. Choose the dial or a bar to open the rows behind it. This is the score for the habitat chosen on the <ScenarioLink to="/dashboard">dashboard</ScenarioLink>.
        </p>
      </div>
    </div>
  )
}

export function MethodsSection() {
  const { snapshot, insights, tests, invByAcc } = useData()
  const c = snapshot.counts
  const twice = insights.filter((i) => i.verified === 'snapshot and raw files').map((i) => i.id)
  const m = DEFAULT_METHOD
  const unplotted = groupBy(tests.filter((t) => !plottable(t)), (t) => t.accession)
  const unplottedCount = tests.filter((t) => !plottable(t)).length
  const keptAsWritten = burnLengthPairs(tests).filter((p) => p.thicknessLikely)
  // What the inverse flame rows add to the Exploration score, worked out from the snapshot.
  const inverseShare = useMemo(() => {
    const exploration = snapshot.habitats.find((h) => h.id === 'exploration')
    if (!exploration) return null
    const lookup = pillarLookup(snapshot.investigations)
    const point = scenarioPoint(exploration)
    return { with: Math.round(computeCoverage(tests, lookup, point).overall), without: Math.round(computeCoverage(tests.filter((t) => !isInverseFlame(t)), lookup, point).overall) }
  }, [snapshot, tests])
  // An assumption with no value reads "from the table" only when that table really states the value.
  const statedInTable = (accession: string, field: 'o2' | 'pressure'): boolean =>
    tests.some((t) => t.accession === accession && (field === 'o2' ? t.o2Source === 'table' : t.pressureSource === 'table'))
  return (
    <>
    <Section id="data" title="Data and snapshot">
      <p>
        Every number in EMBER comes from NASA's Physical Sciences Informatics (PSI) repository at psi.nasa.gov. The snapshot was taken on <span className="num">{snapshot.fetchedAt.slice(0, 10)}</span>. It holds <span className="num">{c.investigations}</span> combustion investigations, <span className="num">{c.tables}</span> experimental tables with <span className="num">{c.rows.toLocaleString('en-US')}</span> rows, and <span className="num">{c.tests.toLocaleString('en-US')}</span> normalized tests. A table row that lists several oxygen levels for one test day becomes one test per level, note rows are kept apart, and <span className="num">{snapshot.droppedRows.length}</span> rows that record no test are left out and <ScenarioLink to="/about?section=dropped">listed</ScenarioLink>, which is why the two counts differ.
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
      <p>The normoxic line on the map is every atmosphere with the same oxygen partial pressure as sea level air: xO2 × P = 0.2095 atm. Flammability does not follow this line. The line uses the dry gas. NASA's breathing standard also takes away water vapour in the lungs, so it rates 34 percent oxygen at 8.2 psi as mild hypoxia. More oxygen at lower pressure also makes most materials easier to burn.</p>
      <h3 id="nearby" className="scroll-mt-24 text-[18px]">Nearby test records</h3>
      <p>The dashboard leads with counts of nearby test records. {NEARBY_RULE}</p>
      <Formula>nearby when √(dx² + dp²) ≤ 1, dx = Δoxygen ÷ {m.o2Scale}, dp = Δln(pressure) ÷ {m.pressureScale}</Formula>
      <p>
        The counts describe the snapshot. They are rows of NASA test tables, not unique experiments, and many rows can share one condition. {NOT_PROOF} A row with an assumed oxygen or pressure value counts as nearby at its assumed position, and the dashboard states how many such rows there are. Rows of inverse gas flames count too, and their oxygen value is the oxidizer stream. A count is not a probability, a risk score or a prediction.
      </p>
      <h3 id="coverage" className="scroll-mt-24 text-[18px]">Evidence Coverage</h3>
      <p>The score measures how much real flight evidence sits close to the chosen atmosphere. It is not a safety rating. It is a heuristic of the team and it lives here, with its formula, and not on the dashboard. It sums a weight over every usable row, not only the nearby ones, so a large table can fill the score while a material or gravity gap remains. Inverse gas flame rows count in the score too, although their oxygen value is the burner stream.{inverseShare ? ` Without them Exploration would score ${inverseShare.without} instead of ${inverseShare.with}.` : ''}</p>
      <CoverageDetails />
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
      <p>The law is a classical result (Godsave 1953, Spalding 1953). The FLEX data: Dietrich and co-authors, 2014, listed in the PSI FLEX record. NASA's detailed FLEX results (NASA/TP-2015-216046, Table IX) give the burning rate in mm² per second. The Lab checks this law against every FLEX test that has all four values and a defined model end.</p>
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
                <td className="num">{a.o2 == null ? (statedInTable(a.accession, 'o2') ? 'from the table' : 'not stated') : `${Math.round(a.o2 * 1000) / 10}% assumed`}</td>
                <td className="num">{a.pressureAtm == null ? (statedInTable(a.accession, 'pressure') ? 'from the table' : 'not stated') : `${a.pressureAtm} atm assumed`}</td>
                <td className="max-w-[360px]">
                  {a.reason}
                  {a.source ? <span className="mt-1 block text-[12px] text-muted">Source: {a.source}</span> : null}
                </td>
                <td className={a.status === 'needs human check' ? 'text-warn' : ''}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {snapshot.assumptionsReview ? <p className="bg-surface-2 px-3 py-2 text-[14px]">{snapshot.assumptionsReview} Each value still draws hollow and counts at half weight, because it is not a value from NASA's table. Where a paper gives the value, the source cites it.</p> : null}
      <p>Measured ISS cabin oxygen ran from about 20 to 23 percent. EMBER uses 21.0 percent for every assumed cabin air value, the same as the ISS cabin habitat.</p>
      <p>SAME, SAME-R and DAFT are smoke and dust tests for fire detectors. Nothing burned in them. SAME and SAME-R stay on the map as smoke and aerosol tests, because they count toward detection. DAFT states no oxygen, so it is not plotted.</p>
      <p className="text-[13px] text-muted">The pillar of each investigation, its hardware family and what it informs are also drafts by SI. Each carries the status "needs human check" until the team confirms it from the PSI record. The full list is under SI disclosure.</p>
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
      <p>A few cells are corrected too, and each such test is flagged: the ACME BRE oxygen value 3400% is read as 34, and fuel names that count up through CH5, CH6 and so on in two ACME tables are read as the fuel in the first row. The ACME s-Flame days run in helium record helium as the other gas.</p>
      <h3 id="dropped" className="scroll-mt-24 text-[18px]">Rows that are not tests</h3>
      <p>These table rows record no test. EMBER leaves them out of the tests, still counts them as table rows, and lists them here.</p>
      <div className="table-wrap" style={{ maxHeight: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col">Row</th>
              <th scope="col">Why it is left out</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.droppedRows.map((d) => (
              <tr key={d.table + d.rowIndex}>
                <td>{invByAcc[d.accession]?.displayName ?? d.accession}</td>
                <td className="num">{d.label}</td>
                <td className="max-w-[360px]">{d.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 id="kept-as-written" className="scroll-mt-24 text-[18px]">Source text kept as written</h3>
      <p>Some cells look like a typing slip but are not corrected, because the right value is not confirmed. EMBER shows and stores them exactly as NASA wrote them, marks them where they appear, and lists them here.</p>
      <div className="table-wrap" style={{ maxHeight: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col">Rows</th>
              <th scope="col">As in the file</th>
              <th scope="col">Likely reading</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupBy(keptAsWritten, (p) => p.thickness)).map(([raw, list]) => (
              <tr key={raw}>
                <td>{invByAcc[SAFFIRE_2]?.displayName ?? SAFFIRE_2}, Samle Thickness</td>
                <td className="num">
                  {list.map((p, i) => (
                    <span key={p.testId}>
                      {i > 0 ? ', ' : ''}
                      <ScenarioLink to={`/investigations/${SAFFIRE_2}?row=${encodeURIComponent(p.testId)}`}>{p.label}</ScenarioLink>
                    </span>
                  ))}
                </td>
                <td className="num">{raw}</td>
                <td className="num">{list[0].thicknessLikely}, unconfirmed</td>
                <td className="text-warn">needs the science lead's check</td>
              </tr>
            ))}
            <tr>
              <td>{invByAcc['PSI-106']?.displayName ?? 'PSI-106'}, Test Date</td>
              <td className="num">last row</td>
              <td className="num">2012-MAR-23 Last day of testing: SPICE testing</td>
              <td>a SPICE test day filed under SLICE</td>
              <td>kept where NASA filed it. SPICE and SLICE share one assumed atmosphere, so its mark is in the right place.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>

      <Section id="unplotted" title="Tests that are not on the map">
        <p>
          <span className="num">{unplottedCount}</span> tests have no oxygen or pressure value in their table and no declared assumption. They are not dropped. They are listed on the page of their investigation.
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {Object.keys(unplotted).sort(byAccession).map((accession) => (
            <li key={accession}>
              <ScenarioLink to={`/investigations/${accession}`} className="chip">
                {invByAcc[accession].displayName} <span className="num">{unplotted[accession].length}</span>
              </ScenarioLink>
            </li>
          ))}
        </ul>
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
    </>
  )
}

export function VisualsSection() {
  return (
    <>
    <Section id="fireball" title="The fireball">
      <p>
        The fireball in the <ScenarioLink to="/lab/flame">Lab</ScenarioLink> is an SI-generated illustration, drawn by shader code in the browser with three.js. Every view of it carries a small SI mark in its corner. There are no model files. It is driven by the NASA tests near the chosen atmosphere: the burning rate and the outcomes come from the FLEX table, and the listed flame temperature comes from the ACME gas flame tables. The three numbers beside it each open their rows.
      </p>
      <p>
        The temperature scale has two labelled ends, about 300 K for cabin air and about 2,300 K for a typical flame, from page 8 of NASA's Researcher's Guide to Combustion Science. The pattern between them is drawn, not computed. No pressure effect on the flame is drawn, because EMBER does not model one. No shape between the Earth flame and the fireball is drawn, because no partial-gravity test exists.
      </p>
      <p>
        The mark on the temperature scale {GATES.tadConfirmed ? 'moves with the habitat. It shows the calculated adiabatic flame temperature from the ACME column headed Tad (K), the median of normal hot flames near the chosen oxygen. Inverse flames and cool flames are left out.' : 'does not move until the ACME column headed Tad (K) is confirmed as the adiabatic flame temperature.'} The droplet in the Lab {GATES.burningRateUnitConfirmed ? 'is animated, with the FLEX burning rate read in mm² per second.' : 'is not animated until the FLEX burning rate unit is confirmed as mm² per second.'} Both readings were reviewed by the EMBER team on 15 November 2026 against NASA/TP-2015-216046 and the ACME publications. A combustion researcher should confirm before this is used for design.
      </p>
      <p className="text-[14px] text-muted">
          {SCALE_NOTE} Pressure changes which tests are near. EMBER draws no pressure effect that the tables do not show.{' '}
          <a href="https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/" target="_blank" rel="noreferrer">
            Source, page 8
          </a>
        </p>
        <p>
          <a href="https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            See real flame photos from the space station on nasa.gov <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      </Section>

      <Section id="drivers" title="What drives the fireball">
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px]">
          {DRIVERS.map((d) => (
            <li key={d.change} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
              <span className="font-semibold">{d.control}</span>
              <span className="text-muted">{d.change}.</span>
              <span className="text-[11px] uppercase tracking-wide text-faint">{BASIS[d.basis]}</span>
            </li>
          ))}
        </ul>
        <p>With fewer than ten droplet tests within range of the habitat the fireball fades. With none it is drawn as a ghost: an outline with no heat map. That gap is the finding.</p>
      </Section>

      <Section id="sky" title="The sky on the start page">
        <p>
          The start page shows a sky of ember-coloured gas printed in halftone dots, with a round flame in freefall. It is a shader drawn in the browser, adapted from an open component and tuned with SI help. It is decoration and carries no data. It carries the same small SI mark.
        </p>
      </Section>
    </>
  )
}

export function AnswersSection() {
  return (
    <>
      <Section id="answers" title="How an answer is made">
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-5">
          <li>EMBER searches its own evidence: the findings, the investigations, the glossary and the methods. If nothing matches, it says so and calls no model.</li>
          <li>A live model may then write three to six sentences from that evidence only. It never sees anything else.</li>
          <li>Your browser checks each sentence: its source must exist, its numbers must be in that source, and it may not call anything safe or unsafe. A sentence that fails is removed.</li>
          <li>If the model is away, slow, or its answer fails the check, the evidence itself is shown as the answer. The sources are listed under every answer.</li>
        </ol>
        <p>Six example questions carry a pinned answer. Each was written by the live model, passed the same check, and was then read by the team.</p>
        <p>Your question is sent to a language model through OpenRouter. Do not enter personal information. If no live model is set up, answers are built in your browser and nothing you type leaves the page.</p>
        <p>Search is by keyword, with aliases. When a question is typed, a small open embedding model also loads in the browser and matches by meaning. Its files are served by this site.</p>
      </Section>
    <Section id="evaluation" title="Live answer and evaluation">
      <p>
        In the chat panel a live language model may write a short answer. It is reached through OpenRouter from one server function on Vercel. The first choice is Claude Haiku 5.5 and the backup is GPT-6 Luna. The browser sends the question, the habitat and a list of evidence ids. The function looks up the evidence text itself, so the model only ever sees text that EMBER built from NASA data. EMBER does not store questions.
      </p>
      <p>The browser then checks the answer. A sentence is removed when it cites no source or an unknown one, when it holds a number that is not in its source, when it says safe or unsafe or calls anything a safety rating, or when it shares too few words with its source. Fewer than two surviving sentences and the live answer is dropped. The evidence then stands as the answer, and the sources are always listed under it.</p>
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
        <>
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
          <p className="text-[14px] text-muted">{EVALUATION_NOTE}</p>
          <p className="bg-surface-2 px-3 py-2 text-[14px]">
            {MEANING_CHECK ?? 'The Meaning measure is still open. The checker proves that ids and numbers match the evidence. The team\'s science lead has not yet read the verified answers against their sources.'}
          </p>
        </>
      ) : (
        <p className="bg-surface-2 px-3 py-2 text-[14px]">The evaluation set is fixed: 12 real questions and 5 trick questions. Retrieval recall is tested on every build. The answer rate and the other live measures are published here after the first run against the live model. No result is shown until it has been measured.</p>
      )}
    </Section>
    </>
  )
}

export function DisclosureSection() {
  const { snapshot } = useData()
  return (
    <>
    <Section id="si" title="SI disclosure">
      <p>Super Intelligence (SI) is the event's word for AI. The organizers confirmed to the team on 14 November 2026 that using AI is allowed. This is how it was used.</p>
      <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
        <li>Research and planning. An SI assistant helped read the challenge, probe the PSI service and write the build plan.</li>
        <li>Code. The application code, the build scripts and the tests were drafted with an SI coding assistant (Claude Code with the Fable 5.2 model) during the event and reviewed by the team. Source files carry a one-line SI header.</li>
        <li>Words. The plain summaries of each investigation, the wording of the insight cards, the glossary and the context cards were drafted by SI from PSI text and NASA pages. The numbers in them are computed from the data, not written by SI.</li>
        <li>Data files. Every generated data file carries a generatedBy field that says how it was made.</li>
        <li>The live models. Claude Haiku 5.5 and GPT-6 Luna, reached through OpenRouter, answer questions in the chat panel from the NASA evidence and nothing else.</li>
        <li>The fireball. Its shader code is SI-assisted and what it draws is treated as SI-generated visual content, so every view carries a small SI mark in its corner. The halftone sky on the start page carries the same mark. No SI image or video generator was used.</li>
        <li>Search by meaning, when enabled, runs a small open embedding model in the browser.</li>
      </ul>
      <p>
        What the team did themselves: chose and shaped the concept, made the design and story decisions, checks the science and every insight against the data, confirms the declared assumptions, reviews the pinned answers, tests the app and records the demo. No NASA logo, insignia or mission patch is used anywhere. The full statement is in SI-DISCLOSURE.md in the repository.
      </p>
    </Section>

      <Section id="drafts" title="What is SI drafted, what the team reviewed, and what still needs a human check">
        <p>The main screens carry no tags, to keep them clean. This is the full list.</p>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          <li>SI drafted, checked against PSI data: the plain summary of every investigation, the wording of the twelve findings, the glossary, the incident and spinoff cards, and the bullet points in the Lab notes.</li>
          <li>SI drafted, needs human check: the pillar of each investigation, its hardware family, and what it informs.</li>
          <li>SI drafted, reviewed by the EMBER team on 15 November 2026: the declared assumptions for tables that state no atmosphere, and the two readings behind the fireball, the ACME flame temperature column and the FLEX burning rate unit. A combustion researcher should confirm before this is used for design. Their status is in the table under Data and methods.</li>
          <li>Live answers in the chat panel are written by a language model and checked by code. Pinned answers were also read by the team.</li>
          <li>SI-generated visuals: the fireball and the sky on the start page. Each carries a small SI mark.</li>
        </ul>
        <div className="table-wrap" style={{ maxHeight: 360 }}>
          <table className="data-table">
            <caption className="sr-only">What each investigation informs, with its basis and status</caption>
            <thead>
              <tr>
                <th scope="col">Investigation</th>
                <th scope="col">Informs</th>
                <th scope="col">Basis</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.equipmentBasis.map((row) => (
                <tr key={row.accession}>
                  <td>
                    <ScenarioLink to={`/investigations/${row.accession}`}>{snapshot.investigations.find((i) => i.accession === row.accession)?.displayName ?? row.accession}</ScenarioLink>
                  </td>
                  <td>{row.tags.map((id) => snapshot.equipmentTags.find((t) => t.id === id)?.label ?? id).join(', ')}</td>
                  <td className="max-w-[420px]">{row.basis}</td>
                  <td className="text-warn">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

export function SourcesSection() {
  const { snapshot } = useData()
  const c = snapshot.counts
  return (
    <>
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
        <li>Open source libraries: React, React Router, Vite, TypeScript, Tailwind CSS, d3 modules, Recharts, MiniSearch, three.js, Motion, Lucide, clsx, tailwind-merge, class-variance-authority, and the Inter, Space Grotesk and JetBrains Mono typefaces. Versions and licences are in SOURCES.md in the repository.</li>
      </ul>
    </Section>

      <Section id="snapshot" title="Snapshot and repository">
        <p>
          PSI snapshot taken on <span className="num">{snapshot.fetchedAt.slice(0, 10)}</span>. Built with NASA open data from the PSI repository. Apache 2.0 licence.{' '}
          <a href="https://github.com/SUMMERxKx/NasaHackathon" target="_blank" rel="noreferrer">
            Repository
          </a>
        </p>
      </Section>
    </>
  )
}
