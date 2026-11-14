// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Ask. The evidence answer appears at once with no model. The live answer streams above it and
// can only add to it. Every live sentence is checked against its source before it counts as checked.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CircleDashed, Send } from 'lucide-react'
import type { AskRequest, CheckResult, EvidenceItem, PinnedAnswer, RetrievalResult, Scenario, Test } from '../types.ts'
import { askLive, cacheKey, fetchHealth } from '../lib/ask.ts'
import type { Health, LiveFailure } from '../lib/ask.ts'
import { REFUSAL, checkAnswer } from '../lib/grounding.ts'
import { buildEngine, retrieve } from '../lib/retrieve.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { loadAskData, useAskData, useData } from '../state/data.tsx'
import { useDrill, useScenario } from '../state/hooks.ts'
import { fromHabitat, matchPreset, scenarioLine } from '../state/scenario.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { DataTable } from '../components/DataTable.tsx'
import type { Column } from '../components/DataTable.tsx'
import { oxygenText, pressureText } from '../components/DrillPanel.tsx'
import { PILLAR_NAME } from '../components/cards.tsx'
import { QuietLine, ScenarioLink, SiTag, Skeleton, SourcedNumber, usePrefersReducedMotion } from '../components/ui.tsx'

// Each chip carries its own habitat. Chips 1 and 5 set the Exploration atmosphere and say so.
export const CHIPS: { id: string; question: string; habitat: string | null }[] = [
  { id: 'chip-1-fire-at-34', question: 'What do we know about fire at 34 percent oxygen?', habitat: 'exploration' },
  { id: 'chip-2-fabrics', question: 'Which investigations tested fabrics?', habitat: null },
  { id: 'chip-3-carbon-dioxide', question: 'How was carbon dioxide tested as a suppressant?', habitat: null },
  { id: 'chip-4-cool-flame', question: 'What is a cool flame?', habitat: null },
  { id: 'chip-5-missing-for-moon', question: 'What is missing for the Moon?', habitat: 'exploration' },
  { id: 'chip-6-shared-hardware', question: 'Which experiments shared hardware?', habitat: null },
]

type LiveState =
  | { kind: 'hidden' }
  | { kind: 'pinned'; answer: PinnedAnswer }
  | { kind: 'waiting' }
  | { kind: 'streaming'; label: string; text: string }
  | { kind: 'verified'; label: string; result: CheckResult; cached: boolean }
  | { kind: 'refusal'; label: string }
  | { kind: 'unavailable'; reason: LiveFailure | 'rejected' }

type AskState =
  | { phase: 'idle' }
  | { phase: 'retrieving'; question: string }
  | { phase: 'no_evidence'; question: string }
  | { phase: 'evidence'; question: string; retrieval: RetrievalResult; items: EvidenceItem[]; line: string; live: LiveState; notice: string | null }

const KIND_WORDS: Record<string, string> = { insight: 'Insight', investigation: 'Investigation', glossary: 'Glossary', habitat: 'Habitat', method: 'Method', hardware: 'Hardware', context: 'Context, not test data' }
const cache = new Map<string, { label: string; result: CheckResult }>()

function SourceChip({ id, onHover, onGo }: { id: string; onHover: (id: string | null) => void; onGo: (id: string) => void }) {
  return (
    <button
      type="button"
      className="chip chip-source mx-0.5 align-baseline"
      style={{ minHeight: 22, padding: '0 6px' }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onClick={() => onGo(id)}
      aria-label={`Source ${id}. Go to this evidence.`}
    >
      {id}
    </button>
  )
}

function Segments({ segments, onHover, onGo, ticks }: { segments: { text: string; cites: string[] }[]; onHover: (id: string | null) => void; onGo: (id: string) => void; ticks: number }) {
  return (
    <p className="prose-width text-[17px] leading-relaxed">
      {segments.map((s, i) => (
        <span key={i}>
          {s.text}
          {s.cites.map((id) => (
            <SourceChip key={id} id={id} onHover={onHover} onGo={onGo} />
          ))}
          {i < ticks ? <Check size={14} className="mr-1 inline text-ok" aria-hidden="true" /> : null}
          {'. '}
        </span>
      ))}
    </p>
  )
}

function EvidenceCard({ item, active, onHover }: { item: EvidenceItem; active: boolean; onHover: (id: string | null) => void }) {
  const { insightById } = useData()
  const card = item.kind === 'insight' ? insightById[item.id] : null
  return (
    <article
      id={`evidence-${item.id}`}
      tabIndex={-1}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      className={`card flex flex-col gap-2 p-4 outline-none transition-all ${active ? 'border-freefall -translate-y-0.5' : ''} ${item.kind === 'context' ? 'border-dashed' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip chip-source">{item.id}</span>
        <span className="chip">{card ? PILLAR_NAME[card.pillar] : KIND_WORDS[item.kind]}</span>
        {item.kind !== 'habitat' && item.id !== 'S' ? <SiTag label="SI drafted" /> : null}
      </div>
      {card ? (
        <p className="text-[28px] leading-none">
          <SourcedNumber path={[{ kind: 'insight', id: card.id, number: card.primary }]} label={`${card.display[card.primary]}. ${card.headline}`}>
            {card.display[card.primary]}
          </SourcedNumber>
        </p>
      ) : null}
      <h3 className="text-[16px] leading-snug">{item.title}</h3>
      <p className="text-[14px] text-muted">{card ? card.detail : item.text}</p>
      {item.id !== 'S' ? (
        <ScenarioLink to={item.href} className="mt-auto text-[13px]">
          {item.kind === 'investigation' ? 'Open the investigation' : item.kind === 'insight' ? 'Open the rows behind it' : 'Open'}
        </ScenarioLink>
      ) : null}
    </article>
  )
}

export default function Ask() {
  const data = useData()
  const { snapshot, testById, invByAcc } = data
  const { scenario, setScenario } = useScenario()
  const { open } = useDrill()
  const ask = useAskData()
  const [params, setParams] = useSearchParams()
  const reduced = usePrefersReducedMotion()
  const [health, setHealth] = useState<Health | null>(null)
  const [healthKnown, setHealthKnown] = useState(false)
  const [draft, setDraft] = useState(params.get('q') ?? '')
  const [state, setState] = useState<AskState>({ phase: 'idle' })
  const [hover, setHover] = useState<string | null>(null)
  const [shown, setShown] = useState(0)
  const [ticks, setTicks] = useState(0)
  const run = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario
  const engine = useMemo(() => (ask.data ? buildEngine(ask.data.search) : null), [ask.data])

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal).then((h) => {
      setHealth(h)
      setHealthKnown(true)
    })
    return () => controller.abort()
  }, [])

  const goTo = useCallback((id: string) => {
    const node = document.getElementById(`evidence-${id}`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.focus({ preventScroll: true })
  }, [])

  const start = useCallback(
    async (question: string, chipId: string | null) => {
      if (!engine || !ask.data) return
      const mine = ++run.current
      abort.current?.abort()
      const text = question.replace(/\s+/g, ' ').trim().slice(0, 300)
      if (text === '') return
      setShown(0)
      setTicks(0)
      setState({ phase: 'retrieving', question: text })
      let current: Scenario = scenarioRef.current
      let notice: string | null = null
      const chip = chipId ? CHIPS.find((c) => c.id === chipId) : null
      const ctx = () => ({ scenario: current, investigations: snapshot.investigations, tests: snapshot.tests, habitats: snapshot.habitats })
      const first = retrieve(text, engine, ctx())
      if (chip?.habitat) {
        const habitat = snapshot.habitats.find((h) => h.id === chip.habitat)
        if (habitat && current.presetId !== habitat.id) {
          current = fromHabitat(habitat, current.focus, current.flowCmS)
          setScenario(current, { replace: true })
          notice = `Habitat set to the ${habitat.name} for this question.`
        }
      } else if (first.scenarioChange) {
        const merged: Scenario = { ...current, ...first.scenarioChange, presetId: null }
        const preset = matchPreset(merged, snapshot.habitats)
        const next = preset ? fromHabitat(preset, current.focus, current.flowCmS) : merged
        if (Math.abs(next.o2 - current.o2) > 0.0005 || Math.abs(next.pressurePsi - current.pressurePsi) > 0.05) {
          current = next
          setScenario(current, { replace: true })
          const bits = [first.scenarioChange.o2 != null ? `${formatPercent(first.scenarioChange.o2)} oxygen` : '', first.scenarioChange.pressurePsi != null ? `${formatNumber(first.scenarioChange.pressurePsi, 1)} psi` : ''].filter(Boolean)
          notice = `Habitat set to ${bits.join(' and ')} from your question.`
        }
      }
      const retrieval = notice ? retrieve(text, engine, ctx()) : first
      if (!retrieval.hasEvidence) {
        setState({ phase: 'no_evidence', question: text })
        return
      }
      let bundle = ask.data.evidence
      const line = scenarioLine(current, snapshot.habitats)
      const items = retrieval.pack.map((p) => bundle.items[p.evidenceId]).filter(Boolean)
      const base = { phase: 'evidence' as const, question: text, retrieval, items, line, notice }
      const pinnedAnswer = chip ? ask.data.pinned.answers.find((a) => a.id === chip.id && a.reviewed) : undefined
      if (pinnedAnswer) {
        setState({ ...base, live: { kind: 'pinned', answer: pinnedAnswer } })
        return
      }
      if (!health?.configured) {
        setState({ ...base, live: { kind: 'hidden' } })
        return
      }
      const request: AskRequest = {
        question: text,
        scenario: { presetId: current.presetId, o2: current.o2, pressurePsi: current.pressurePsi, gravity: current.gravity },
        evidenceIds: items.map((i) => i.id).slice(0, 7),
      }
      const key = cacheKey(request)
      const hit = cache.get(key)
      if (hit) {
        setState({ ...base, live: hit.result.verdict === 'refusal' ? { kind: 'refusal', label: hit.label } : { kind: 'verified', label: hit.label, result: hit.result, cached: true } })
        setTicks(99)
        return
      }
      setState({ ...base, live: { kind: 'waiting' } })
      const controller = new AbortController()
      abort.current = controller
      let label = ''
      let received = ''
      const result = await askLive(
        request,
        {
          onMeta: (meta) => {
            label = meta.label
          },
          onDelta: (piece) => {
            received += piece
            if (run.current === mine) setState({ ...base, live: { kind: 'streaming', label, text: received } })
          },
        },
        controller.signal,
      )
      if (run.current !== mine) return
      if (!result.ok) {
        setState({ ...base, live: { kind: 'unavailable', reason: result.reason } })
        return
      }
      // If the function holds a newer evidence file than the browser, reload it once, then check.
      if (result.meta.bundleId !== bundle.bundleId) {
        try {
          bundle = (await loadAskData(true)).evidence
        } catch {
          // The check then runs against the evidence already on screen.
        }
      }
      const pack = items.map((i) => bundle.items[i.id] ?? i)
      const check = checkAnswer(result.text, pack, line)
      if (run.current !== mine) return
      if (check.verdict === 'rejected') {
        setState({ ...base, live: { kind: 'unavailable', reason: 'rejected' } })
        return
      }
      cache.set(key, { label: result.meta.label, result: check })
      setState({ ...base, live: check.verdict === 'refusal' ? { kind: 'refusal', label: result.meta.label } : { kind: 'verified', label: result.meta.label, result: check, cached: false } })
    },
    [engine, ask.data, snapshot, health, setScenario],
  )

  // A question in the address is asked once the search index has loaded.
  const asked = useRef<string | null>(null)
  useEffect(() => {
    const q = params.get('q')
    if (!q || !engine || !healthKnown || asked.current === q) return
    asked.current = q
    setDraft(q)
    void start(q, CHIPS.find((c) => c.question === q)?.id ?? null)
  }, [params, engine, healthKnown, start])

  const submit = (question: string) => {
    const text = question.replace(/\s+/g, ' ').trim()
    if (!text) return
    asked.current = null
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('q', text.slice(0, 300))
        return next
      },
      { preventScrollReset: true },
    )
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(draft)
  }

  // Live text is revealed at a steady reading pace, however it arrives.
  const live = state.phase === 'evidence' ? state.live : null
  const streamText = live?.kind === 'streaming' ? live.text : ''
  useEffect(() => {
    if (live?.kind !== 'streaming') return
    if (reduced) {
      setShown(streamText.length)
      return
    }
    if (shown >= streamText.length) return
    const timer = setTimeout(() => setShown((n) => Math.min(streamText.length, n + 3)), 24)
    return () => clearTimeout(timer)
  }, [live?.kind, streamText, shown, reduced])
  // When the check ends, each kept sentence gains a tick, one after another.
  const keptCount = live?.kind === 'verified' ? live.result.kept : live?.kind === 'pinned' ? live.answer.segments.length : 0
  useEffect(() => {
    if (keptCount === 0 || ticks >= keptCount) return
    const timer = setTimeout(() => setTicks((n) => n + 1), reduced ? 0 : 60)
    return () => clearTimeout(timer)
  }, [keptCount, ticks, reduced])

  const rows = state.phase === 'evidence' && state.retrieval.rows ? state.retrieval.rows : null
  const rowTests = useMemo(() => (rows ? rows.testIds.map((id) => testById.get(id)).filter((t): t is Test => Boolean(t)) : []), [rows, testById])
  const rowColumns: Column<Test>[] = [
    { key: 'inv', header: 'Investigation', cell: (t) => invByAcc[t.accession].displayName, sort: (t) => invByAcc[t.accession].displayName },
    { key: 'label', header: 'Test', cell: (t) => t.label, sort: (t) => t.label },
    { key: 'fuel', header: 'Fuel or material', cell: (t) => t.fuel ?? 'not stated', sort: (t) => t.fuel },
    { key: 'o2', header: 'Oxygen', cell: (t) => oxygenText(t), sort: (t) => t.o2, numeric: true },
    { key: 'p', header: 'Pressure', cell: (t) => pressureText(t), sort: (t) => t.pressureAtm, numeric: true },
  ]
  const statusLine =
    live?.kind === 'pinned'
      ? 'Pinned answer, reviewed by the team'
      : live?.kind === 'verified' || live?.kind === 'refusal' || live?.kind === 'streaming'
        ? `Live model, ${live.label || 'answering'}`
        : live?.kind === 'waiting'
          ? 'Live model, waiting for the first word'
          : live?.kind === 'unavailable'
            ? 'Evidence answer, live model unavailable'
            : 'Evidence answer'

  return (
    <div className="page flex flex-col">
      <PageHeader title="Ask EMBER" lead="Ask in plain words. EMBER finds the NASA evidence first. A live language model may then write a short answer from that evidence only, and every sentence is checked against its source." />

      <form onSubmit={onSubmit} className="card sticky bottom-[64px] z-20 order-last mt-6 p-3 md:static md:order-none md:mt-0 md:p-4" role="search" aria-label="Ask a question">
        <label htmlFor="ask-box" className="field-label">
          Your question
        </label>
        <div className="flex gap-2">
          <input
            id="ask-box"
            className="input !min-h-12 text-[16px]"
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="For example: what is missing for the Moon?"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={!engine || draft.trim() === ''}>
            <Send size={16} aria-hidden="true" /> Ask
          </button>
        </div>
        <ul className="hide-scrollbar m-0 mt-3 flex list-none gap-2 overflow-x-auto p-0 md:flex-wrap" aria-label="Example questions">
          {CHIPS.map((chip) => (
            <li key={chip.id} className="shrink-0">
              <button
                type="button"
                className="chip"
                disabled={!engine}
                onClick={() => {
                  setDraft(chip.question)
                  submit(chip.question)
                }}
              >
                {chip.question}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-muted">
          {health?.configured ? 'Your question is sent to a language model through OpenRouter. Do not enter personal information.' : 'No live model is set up on this site right now, so answers are built in your browser from the NASA evidence. Nothing you type leaves this page.'}
        </p>
      </form>

      <div className="mt-6 flex flex-col gap-6" aria-live="off">
        {ask.error ? <QuietLine>The search files did not load. Reload the page to try again.</QuietLine> : null}
        {!engine && !ask.error ? <Skeleton className="h-24 w-full" /> : null}
        {state.phase === 'retrieving' ? <Skeleton className="h-40 w-full" /> : null}

        {state.phase === 'no_evidence' ? (
          <section className="card p-5" aria-labelledby="none-title">
            <h2 id="none-title" className="text-[20px]">
              {REFUSAL}
            </h2>
            <p className="mt-2 text-[14px] text-muted">EMBER found nothing in the NASA evidence that matches "{state.question}". No model was called. Try one of the example questions.</p>
          </section>
        ) : null}

        {state.phase === 'evidence' ? (
          <>
            {state.notice ? (
              <p className="chip chip-warn self-start whitespace-normal py-1" role="status">
                {state.notice}
              </p>
            ) : null}

            {state.live.kind !== 'hidden' ? (
              <section className="card border-freefall p-5" aria-labelledby="live-title" aria-busy={state.live.kind === 'waiting' || state.live.kind === 'streaming'}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="live-title" className="text-[16px]">
                    {state.live.kind === 'pinned' ? 'Pinned answer, limited to the NASA evidence shown below' : 'Live model answer, limited to the NASA evidence shown below'}
                  </h2>
                  {state.live.kind === 'verified' || state.live.kind === 'pinned' ? (
                    <span className="chip chip-ok">
                      <Check size={12} aria-hidden="true" /> Sources and numbers checked
                    </span>
                  ) : state.live.kind === 'waiting' || state.live.kind === 'streaming' ? (
                    <span className="chip">
                      <CircleDashed size={12} aria-hidden="true" /> Checking
                    </span>
                  ) : null}
                </div>
                {state.live.kind === 'waiting' ? <Skeleton className="h-16 w-full" /> : null}
                {state.live.kind === 'streaming' ? <p className={`prose-width text-[17px] leading-relaxed ${shown < state.live.text.length ? 'caret' : ''}`}>{state.live.text.slice(0, shown)}</p> : null}
                {state.live.kind === 'verified' ? (
                  <div role="status">
                    <Segments segments={state.live.result.segments.filter((s) => s.status === 'kept')} onHover={setHover} onGo={goTo} ticks={ticks} />
                    {state.live.result.removed > 0 ? (
                      <p className="mt-2 text-[13px] text-muted">
                        {state.live.result.removed} {state.live.result.removed === 1 ? 'sentence was' : 'sentences were'} removed by the source check.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {state.live.kind === 'pinned' ? (
                  <div role="status">
                    <Segments segments={state.live.answer.segments} onHover={setHover} onGo={goTo} ticks={ticks} />
                    <p className="mt-2 text-[13px] text-muted">
                      Written by {state.live.answer.model}, then read by the team. {state.live.answer.reviewNote}
                    </p>
                  </div>
                ) : null}
                {state.live.kind === 'refusal' ? <p className="text-[17px]" role="status">{REFUSAL}</p> : null}
                {state.live.kind === 'unavailable' ? (
                  <QuietLine>
                    {state.live.reason === 'rate_limited'
                      ? 'Live answers are busy. Try again in a minute. The evidence answer is below.'
                      : state.live.reason === 'rejected'
                        ? 'The live answer did not pass the source check, so it is not shown. The evidence answer is below.'
                        : 'The live model did not answer in time. The evidence answer is below.'}
                  </QuietLine>
                ) : null}
                <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
                  {statusLine}
                  {state.live.kind === 'verified' && state.live.cached ? '. Shown from this visit, with no new call' : ''}. The check proves that ids and numbers match the evidence. It cannot prove that a sentence means what its source means, so read the evidence below.
                </p>
              </section>
            ) : (
              <QuietLine>Evidence answer. The live model is not set up on this site, so this is built in your browser from the NASA evidence.</QuietLine>
            )}

            <section aria-labelledby="evidence-title">
              <h2 id="evidence-title" className="text-[22px]">
                Evidence answer
              </h2>
              <p className="mb-4 mt-1 text-[14px] text-muted">
                What EMBER found for "{state.question}", with no model. Habitat: <span className="num text-ink">[S]</span> {state.line}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {state.items.map((item) => (
                  <EvidenceCard key={item.id} item={item} active={hover === item.id} onHover={setHover} />
                ))}
              </div>
            </section>

            {rows && rowTests.length > 0 ? (
              <section aria-labelledby="rows-title">
                <h2 id="rows-title" className="text-[18px]">
                  Matching test rows
                </h2>
                <p className="mb-3 mt-1 text-[14px] text-muted">
                  <span className="num text-ink">{rowTests.length}</span> tests with {rows.filter}.
                </p>
                <DataTable rows={rowTests} columns={rowColumns} rowKey={(t) => t.id} onRow={(t) => open([{ kind: 'test', id: t.id }])} rowLabel={(t) => `Test ${t.label}. Press Enter for the NASA row.`} rowProps={(t) => ({ 'data-drill': `test.${t.id}` })} caption="Test rows that match the condition named in the question" maxRows={40} />
              </section>
            ) : null}
          </>
        ) : null}

        {state.phase === 'idle' && engine ? (
          <section className="card p-5">
            <h2 className="text-[18px]">How an answer is made</h2>
            <ol className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14px] text-muted">
              <li>EMBER searches its own evidence: insight cards, investigations, the glossary and the methods. If nothing matches, it says so and calls no model.</li>
              <li>The evidence answer appears at once. It is built in your browser and it never leaves the screen.</li>
              <li>A live model may then write three to six sentences from that evidence only. It never sees anything else.</li>
              <li>Your browser checks each sentence: its source must exist, its numbers must be in that source, and it may not call anything safe or unsafe.</li>
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  )
}
