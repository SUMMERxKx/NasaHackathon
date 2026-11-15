// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Loads the snapshot and the insights once and builds the lookup maps.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EvidenceBundle, Insight, InsightsFile, Investigation, PinnedAnswersFile, SearchIndexFile, Snapshot, Test } from '../types.ts'
import { pillarLookup } from '../lib/coverage.ts'
import type { PillarLookup } from '../lib/coverage.ts'
import type { DrillData } from '../lib/drill.ts'

declare const __BUILD_ID__: string

export type Data = DrillData & {
  snapshot: Snapshot
  insightById: Record<string, Insight>
  lookup: PillarLookup
}

export const SCHEMA_VERSION = 1

export function buildData(snapshot: Snapshot, insightsFile: InsightsFile): Data {
  const invByAcc: Record<string, Investigation> = {}
  const testsByAcc: Record<string, Test[]> = {}
  const testById = new Map<string, Test>()
  for (const inv of snapshot.investigations) {
    invByAcc[inv.accession] = inv
    testsByAcc[inv.accession] = []
  }
  for (const t of snapshot.tests) {
    testById.set(t.id, t)
    ;(testsByAcc[t.accession] ??= []).push(t)
  }
  const insightById: Record<string, Insight> = {}
  for (const card of insightsFile.insights) insightById[card.id] = card
  return {
    snapshot,
    tests: snapshot.tests,
    testById,
    testsByAcc,
    invByAcc,
    insights: insightsFile.insights,
    insightById,
    habitats: snapshot.habitats,
    lookup: pillarLookup(snapshot.investigations),
  }
}

const buildId = (): string => (typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev')

// Data is fetched from the site root with the build id, so a browser never shows an older build's numbers.
// A response that is not JSON counts as a failed fetch, because the rewrite rule answers a missing file
// with the app's own page.
export async function fetchJson<T>(name: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}?v=${buildId()}`, { signal })
  if (!response.ok) throw new Error(`Could not load ${name}`)
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${name} is not JSON`)
  }
}

export function checkSchema(snapshot: { schemaVersion?: number }, insights: { schemaVersion?: number }): void {
  if (snapshot.schemaVersion !== SCHEMA_VERSION || insights.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('The data files are from a different version of EMBER')
  }
}

const DataContext = createContext<Data | null>(null)

export function useData(): Data {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData needs a DataProvider')
  return data
}

export function StaticDataProvider({ data, children }: { data: Data; children: ReactNode }) {
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>
}

type LoadState = { status: 'loading' } | { status: 'ready'; data: Data } | { status: 'error'; message: string }

const LoadContext = createContext<{ state: LoadState; retry: () => void } | null>(null)

// Starts the download at once and holds its state. It renders its children straight away, so the
// hero paints with no wait. Screens that need the data sit under a DataGate.
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    Promise.all([fetchJson<Snapshot>('snapshot.json', controller.signal), fetchJson<InsightsFile>('insights.json', controller.signal)])
      .then(([snapshot, insights]) => {
        checkSchema(snapshot, insights)
        setState({ status: 'ready', data: buildData(snapshot, insights) })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'The data did not load' })
      })
    return () => controller.abort()
  }, [attempt])
  const value = useMemo(() => ({ state, retry: () => setAttempt((n) => n + 1) }), [state])
  return <LoadContext.Provider value={value}>{children}</LoadContext.Provider>
}

// Shows the skeleton until the data is ready, then hands it to everything below.
export function DataGate({ children, skeleton }: { children: ReactNode; skeleton: ReactNode }) {
  const ready = useContext(DataContext)
  const load = useContext(LoadContext)
  if (ready) return <>{children}</>
  if (!load || load.state.status === 'loading') return <>{skeleton}</>
  if (load.state.status === 'error') return <LoadError message={load.state.message} onRetry={load.retry} />
  return <DataContext.Provider value={load.state.data}>{children}</DataContext.Provider>
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="page flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-[28px]">EMBER could not load its data</h1>
      <p className="text-muted">{message}. The NASA snapshot ships with the site, so a reload usually fixes this.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Retry
      </button>
    </main>
  )
}

// The chat files load the first time the chat panel opens.
export type AskData = { evidence: EvidenceBundle; search: SearchIndexFile; pinned: PinnedAnswersFile }
let askPromise: Promise<AskData> | null = null

export function loadAskData(force = false): Promise<AskData> {
  if (!askPromise || force) {
    askPromise = Promise.all([
      fetchJson<EvidenceBundle>('evidence.json'),
      fetchJson<SearchIndexFile>('search-index.json'),
      fetchJson<PinnedAnswersFile>('pinned-answers.json').catch(() => ({ schemaVersion: 1 as const, generatedBy: '', answers: [] })),
    ]).then(([evidence, search, pinned]) => ({ evidence, search, pinned }))
    askPromise.catch(() => {
      askPromise = null
    })
  }
  return askPromise
}

export function useAskData(): { data: AskData | null; error: boolean } {
  const [data, setData] = useState<AskData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    loadAskData()
      .then((d) => live && setData(d))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [])
  return useMemo(() => ({ data, error }), [data, error])
}
