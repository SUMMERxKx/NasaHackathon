// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The chat panel. EMBER finds the NASA evidence first. A live model may then write a short answer
// from that evidence only, and every sentence is checked against its source before it is shown.
// If the model is away or its answer fails the check, the evidence itself is the answer.
// How all of this works is told on the About screen, not here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Bot, X } from 'lucide-react'
import type { AskRequest, CheckResult, EvidenceItem, PinnedAnswer, RetrievalResult, Scenario, Test } from '../../types.ts'
import { askLive, cacheKey, fetchHealth } from '../../lib/ask.ts'
import type { Health, LiveFailure } from '../../lib/ask.ts'
import { REFUSAL, checkAnswer } from '../../lib/grounding.ts'
import { appHref } from '../../lib/links.ts'
import { decodeVectors, scoreMeaning } from '../../lib/meaning.ts'
import { buildEngine, retrieve } from '../../lib/retrieve.ts'
import { formatNumber, formatPercent } from '../../lib/units.ts'
import { loadAskData, useAskData, useData } from '../../state/data.tsx'
import { useDrill, useScenario } from '../../state/hooks.ts'
import { useMeaning } from '../../state/meaning.ts'
import { fromHabitat, matchPreset, scenarioLine } from '../../state/scenario.ts'
import { oxygenText, pressureText } from '../DrillPanel.tsx'
import { ScenarioLink, usePrefersReducedMotion } from '../ui.tsx'

// Each example carries its own habitat. Two of them set the Exploration atmosphere.
export const CHIPS: { id: string; question: string; habitat: string | null }[] = [
  { id: 'chip-1-fire-at-34', question: 'What do we know about fire at 34 percent oxygen?', habitat: 'exploration' },
  { id: 'chip-2-fabrics', question: 'Which investigations tested fabrics?', habitat: null },
  { id: 'chip-3-carbon-dioxide', question: 'How was carbon dioxide tested as a suppressant?', habitat: null },
  { id: 'chip-4-cool-flame', question: 'What is a cool flame?', habitat: null },
  { id: 'chip-5-missing-for-moon', question: 'What is missing for the Moon?', habitat: 'exploration' },
  { id: 'chip-6-shared-hardware', question: 'Which experiments shared hardware?', habitat: null },
]

export const CHAT_NOTE = "Answers come from NASA's data. They can make mistakes, so check the sources."

type LiveState =
  | { kind: 'hidden' }
  | { kind: 'pinned'; answer: PinnedAnswer }
  | { kind: 'waiting' }
  | { kind: 'streaming'; text: string }
  | { kind: 'verified'; result: CheckResult }
  | { kind: 'refusal' }
  | { kind: 'unavailable'; reason: LiveFailure | 'rejected' }

type Turn = {
  id: number
  question: string
  phase: 'retrieving' | 'no_evidence' | 'evidence'
  items: EvidenceItem[]
  rows: RetrievalResult['rows']
  line: string
  notice: string | null
  live: LiveState
}

const cache = new Map<string, CheckResult>()
const isBusy = (turn: Turn | undefined): boolean => Boolean(turn && (turn.phase === 'retrieving' || (turn.phase === 'evidence' && (turn.live.kind === 'waiting' || turn.live.kind === 'streaming'))))

function Cite({ id, items, line, onGo }: { id: string; items: EvidenceItem[]; line: string; onGo: () => void }) {
  const item = items.find((i) => i.id === id)
  if (!item) {
    return (
      <span className="chat-cite" title={id === 'S' ? line : undefined}>
        {id}
      </span>
    )
  }
  return (
    <ScenarioLink to={appHref(item.href)} className="chat-cite" title={item.title} aria-label={`Source ${id}: ${item.title}`} onClick={onGo}>
      {id}
    </ScenarioLink>
  )
}

function Sentences({ segments, items, line, onGo }: { segments: { text: string; cites: string[] }[]; items: EvidenceItem[]; line: string; onGo: () => void }) {
  return (
    <p>
      {segments.map((s, i) => (
        <span key={i}>
          {s.text}
          {s.cites.map((id) => (
            <Cite key={id} id={id} items={items} line={line} onGo={onGo} />
          ))}
          {'. '}
        </span>
      ))}
    </p>
  )
}

// With no live answer, the evidence itself is the answer.
function EvidenceAnswer({ items }: { items: EvidenceItem[] }) {
  const { insightById } = useData()
  return (
    <div className="flex flex-col gap-2.5">
      {items.slice(0, 3).map((item) => {
        const card = item.kind === 'insight' ? insightById[item.id] : null
        const text = card ? card.detail : item.text
        return (
          <div key={item.id}>
            <p className="font-semibold">{item.title}</p>
            <p className="line-clamp-4 text-muted">{text}</p>
          </div>
        )
      })}
    </div>
  )
}

function Sources({ items, onGo }: { items: EvidenceItem[]; onGo: () => void }) {
  if (items.length === 0) return null
  return (
    <details className="mt-2 text-[12px]">
      <summary className="cursor-pointer select-none text-muted">
        Sources <span className="num">{items.length}</span>
      </summary>
      <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-1.5">
            <span className="num shrink-0 text-faint">{item.id}</span>
            <ScenarioLink to={appHref(item.href)} className="min-w-0 truncate" onClick={onGo}>
              {item.title}
            </ScenarioLink>
          </li>
        ))}
      </ul>
    </details>
  )
}

function MatchingRows({ rows }: { rows: NonNullable<RetrievalResult['rows']> }) {
  const { testById, invByAcc } = useData()
  const { open } = useDrill()
  const tests = useMemo(() => rows.testIds.map((id) => testById.get(id)).filter((t): t is Test => Boolean(t)), [rows, testById])
  if (tests.length === 0) return null
  return (
    <div className="mt-2 text-[12px]">
      <p className="text-muted">
        <span className="num text-ink">{tests.length}</span> matching tests
      </p>
      <ul className="m-0 mt-1 flex list-none flex-col p-0">
        {tests.slice(0, 4).map((t) => (
          <li key={t.id}>
            <button type="button" className="flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2" data-drill={`test.${t.id}`} onClick={() => open([{ kind: 'test', id: t.id }])}>
              <span className="min-w-0 truncate">
                {invByAcc[t.accession]?.displayName} <span className="num text-muted">{t.label}</span>
              </span>
              <span className="num shrink-0 text-muted">
                {oxygenText(t)}, {pressureText(t)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Answer({ turn, shown, onGo }: { turn: Turn; shown: number; onGo: () => void }) {
  if (turn.phase === 'retrieving') return <span className="chat-dots" aria-label="Looking" />
  if (turn.phase === 'no_evidence') return <p>{REFUSAL} Try one of the examples.</p>
  const live = turn.live
  return (
    <>
      {turn.notice ? <p className="mb-2 text-[12px] text-warn">{turn.notice}</p> : null}
      {live.kind === 'waiting' ? <span className="chat-dots" aria-label="Writing" /> : null}
      {live.kind === 'streaming' ? <p className={shown < live.text.length ? 'caret' : ''}>{live.text.slice(0, shown)}</p> : null}
      {live.kind === 'verified' ? <Sentences segments={live.result.segments.filter((s) => s.status === 'kept')} items={turn.items} line={turn.line} onGo={onGo} /> : null}
      {live.kind === 'pinned' ? <Sentences segments={live.answer.segments} items={turn.items} line={turn.line} onGo={onGo} /> : null}
      {live.kind === 'refusal' ? <p>{REFUSAL}</p> : null}
      {live.kind === 'hidden' || live.kind === 'unavailable' ? <EvidenceAnswer items={turn.items} /> : null}
      {live.kind !== 'waiting' && live.kind !== 'streaming' ? (
        <>
          {turn.rows ? <MatchingRows rows={turn.rows} /> : null}
          <Sources items={turn.items} onGo={onGo} />
        </>
      ) : null}
    </>
  )
}

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot } = useData()
  const { scenario, setScenario } = useScenario()
  const ask = useAskData()
  const [params] = useSearchParams()
  const reduced = usePrefersReducedMotion()
  const [health, setHealth] = useState<Health | null>(null)
  const [healthKnown, setHealthKnown] = useState(false)
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [shown, setShown] = useState(0)
  const run = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const engine = useMemo(() => (ask.data ? buildEngine(ask.data.search) : null), [ask.data])
  // Search by meaning. Its model loads in a Web Worker when the first question is typed.
  const embedding = ask.data?.search.embedding ?? null
  const vectors = useMemo(() => (embedding ? decodeVectors(embedding.vectors) : null), [embedding])
  const { embed: embedQuestion, start: startMeaning, status: meaningStatus } = useMeaning(embedding != null)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal).then((h) => {
      setHealth(h)
      setHealthKnown(true)
    })
    return () => {
      controller.abort()
      abort.current?.abort()
    }
  }, [])

  const patch = useCallback((id: number, next: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...next } : t))), [])

  const start = useCallback(
    async (question: string, chipId: string | null) => {
      if (!engine || !ask.data) return
      const text = question.replace(/\s+/g, ' ').trim().slice(0, 300)
      if (text === '') return
      const mine = ++run.current
      abort.current?.abort()
      setShown(0)
      setTurns((all) => [...all, { id: mine, question: text, phase: 'retrieving', items: [], rows: null, line: '', notice: null, live: { kind: 'hidden' } }])
      let current: Scenario = scenarioRef.current
      let notice: string | null = null
      const chip = chipId ? CHIPS.find((c) => c.id === chipId) : null
      const ctx = () => ({ scenario: current, investigations: snapshot.investigations, tests: snapshot.tests, habitats: snapshot.habitats })
      // If the model is ready the question is also matched by meaning. If not, keyword search answers alone.
      let scores: Map<string, number> | null = null
      if (embedding && vectors) {
        const vector = await embedQuestion(text)
        if (run.current !== mine) return
        if (vector) scores = scoreMeaning(vector, embedding, vectors)
      }
      const first = retrieve(text, engine, ctx(), scores)
      if (chip?.habitat) {
        const habitat = snapshot.habitats.find((h) => h.id === chip.habitat)
        if (habitat && current.presetId !== habitat.id) {
          current = fromHabitat(habitat, current.focus, current.flowCmS)
          setScenario(current, { replace: true })
          notice = `Habitat set to the ${habitat.name}.`
        }
      } else if (first.scenarioChange) {
        const merged: Scenario = { ...current, ...first.scenarioChange, presetId: null }
        const preset = matchPreset(merged, snapshot.habitats)
        const next = preset ? fromHabitat(preset, current.focus, current.flowCmS) : merged
        if (Math.abs(next.o2 - current.o2) > 0.0005 || Math.abs(next.pressurePsi - current.pressurePsi) > 0.05) {
          current = next
          setScenario(current, { replace: true })
          const bits = [first.scenarioChange.o2 != null ? `${formatPercent(first.scenarioChange.o2)} oxygen` : '', first.scenarioChange.pressurePsi != null ? `${formatNumber(first.scenarioChange.pressurePsi, 1)} psi` : ''].filter(Boolean)
          notice = `Habitat set to ${bits.join(' and ')}.`
        }
      }
      const retrieval = notice ? retrieve(text, engine, ctx(), scores) : first
      if (!retrieval.hasEvidence) {
        patch(mine, { phase: 'no_evidence' })
        return
      }
      let bundle = ask.data.evidence
      const line = scenarioLine(current, snapshot.habitats)
      const items = retrieval.pack.map((p) => bundle.items[p.evidenceId]).filter(Boolean)
      const base = { phase: 'evidence' as const, items, rows: retrieval.rows, line, notice }
      const pinnedAnswer = chip ? ask.data.pinned.answers.find((a) => a.id === chip.id && a.reviewed) : undefined
      if (pinnedAnswer) {
        patch(mine, { ...base, live: { kind: 'pinned', answer: pinnedAnswer } })
        return
      }
      if (!health?.configured) {
        patch(mine, { ...base, live: { kind: 'hidden' } })
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
        patch(mine, { ...base, live: hit.verdict === 'refusal' ? { kind: 'refusal' } : { kind: 'verified', result: hit } })
        return
      }
      patch(mine, { ...base, live: { kind: 'waiting' } })
      const controller = new AbortController()
      abort.current = controller
      let received = ''
      const result = await askLive(
        request,
        {
          onMeta: () => {},
          onDelta: (piece) => {
            received += piece
            if (run.current === mine) patch(mine, { live: { kind: 'streaming', text: received } })
          },
        },
        controller.signal,
      )
      if (run.current !== mine) return
      if (!result.ok) {
        patch(mine, { live: { kind: 'unavailable', reason: result.reason } })
        return
      }
      // If the function holds a newer evidence file than the browser, reload it once, then check.
      if (result.meta.bundleId !== bundle.bundleId) {
        try {
          bundle = (await loadAskData(true)).evidence
        } catch {
          // The check then runs against the evidence already loaded.
        }
      }
      const pack = items.map((i) => bundle.items[i.id] ?? i)
      const check = checkAnswer(result.text, pack, line)
      if (run.current !== mine) return
      if (check.verdict === 'rejected') {
        patch(mine, { live: { kind: 'unavailable', reason: 'rejected' } })
        return
      }
      cache.set(key, check)
      patch(mine, { live: check.verdict === 'refusal' ? { kind: 'refusal' } : { kind: 'verified', result: check } })
    },
    [engine, ask.data, snapshot, health, setScenario, embedding, vectors, embedQuestion, patch],
  )

  // A question in the address is asked once the search index has loaded.
  const asked = useRef<string | null>(null)
  const fromAddress = params.get('ask')
  useEffect(() => {
    if (!fromAddress || !engine || !healthKnown || asked.current === fromAddress) return
    asked.current = fromAddress
    void start(fromAddress, CHIPS.find((c) => c.question === fromAddress)?.id ?? null)
  }, [fromAddress, engine, healthKnown, start])

  const last = turns[turns.length - 1]
  const busy = isBusy(last)
  const submit = (question: string) => {
    if (busy) return
    setDraft('')
    void start(question, CHIPS.find((c) => c.question === question)?.id ?? null)
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(draft)
  }

  // Live text is revealed at a steady reading pace, however it arrives.
  const streamText = last?.phase === 'evidence' && last.live.kind === 'streaming' ? last.live.text : null
  useEffect(() => {
    if (streamText == null) return
    if (reduced) {
      setShown(streamText.length)
      return
    }
    if (shown >= streamText.length) return
    const timer = setTimeout(() => setShown((n) => Math.min(streamText.length, n + 3)), 24)
    return () => clearTimeout(timer)
  }, [streamText, shown, reduced])

  // The newest words stay in view.
  useEffect(() => {
    const node = list.current
    if (node && open) node.scrollTop = node.scrollHeight
  }, [turns, shown, open])
  useEffect(() => {
    if (!open) return
    input.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !new URLSearchParams(window.location.search).has('drill')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // On a phone the panel covers the page, so following a source closes it.
  const onGo = useCallback(() => {
    if (window.innerWidth < 640) onClose()
  }, [onClose])

  if (!open) return null
  return (
    <section className="chat-panel no-print" role="dialog" aria-label="Ask EMBER" data-meaning={meaningStatus}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ember text-on-ember">
          <Bot size={16} aria-hidden="true" />
        </span>
        <h2 className="flex-1 text-[15px]">Ask EMBER</h2>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close the chat">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div ref={list} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {ask.error ? <p className="text-[13px] text-muted">The search files did not load. Reload the page to try again.</p> : null}
        {turns.length === 0 && !ask.error ? (
          <div className="flex h-full flex-col justify-end gap-1.5">
            <p className="mb-1 text-[13px] text-muted">Ask about NASA's fire tests in plain words.</p>
            {CHIPS.map((chip) => (
              <button key={chip.id} type="button" className="chat-suggestion" disabled={!engine} onClick={() => submit(chip.question)}>
                {chip.question}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2">
              <p className="chat-bubble chat-bubble-user">{turn.question}</p>
              <div className="chat-bubble chat-bubble-bot" aria-busy={isBusy(turn)}>
                <Answer turn={turn} shown={shown} onGo={onGo} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t border-line px-3 pb-2 pt-3" role="search" aria-label="Ask a question">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-box" className="sr-only">
            Your question
          </label>
          <input
            ref={input}
            id="chat-box"
            className="input !min-h-10 !rounded-full"
            value={draft}
            maxLength={300}
            onChange={(e) => {
              startMeaning()
              setDraft(e.target.value)
            }}
            placeholder="Ask a question"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-icon !min-h-10 !w-10 shrink-0 !rounded-full" disabled={!engine || busy || draft.trim() === ''} aria-label="Send">
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] leading-snug text-faint">{CHAT_NOTE}</p>
      </form>
    </section>
  )
}
