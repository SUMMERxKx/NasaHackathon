// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Loads the committed data files for the tests. Node only.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvidenceBundle, InsightsFile, PinnedAnswersFile, Scenario, SearchIndexFile, Snapshot } from '../types.ts'
import { buildData } from '../state/data.tsx'
import type { Data } from '../state/data.tsx'
import { fromHabitat } from '../state/scenario.ts'

const root = join(import.meta.dirname, '..', '..')
const read = <T>(name: string): T => JSON.parse(readFileSync(join(root, 'public/data', name), 'utf8')) as T

export const snapshot = read<Snapshot>('snapshot.json')
export const insightsFile = read<InsightsFile>('insights.json')
export const evidence = read<EvidenceBundle>('evidence.json')
export const searchIndex = read<SearchIndexFile>('search-index.json')
export const pinned = read<PinnedAnswersFile>('pinned-answers.json')
export const evalSet = JSON.parse(readFileSync(join(root, 'data/manual/eval-questions.json'), 'utf8')) as {
  real: { n: number; question: string; habitat?: string; mustRetrieve?: string[]; mustRetrieveAny?: string; mustRetrieveOneOf?: string[] }[]
  trick: { n: string; question: string }[]
  chips: { id: string; question: string; habitat: string | null }[]
}
export const data: Data = buildData(snapshot, insightsFile)
export const preset = (id: string): Scenario => fromHabitat(snapshot.habitats.find((h) => h.id === id) ?? snapshot.habitats[0])
