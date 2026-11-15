// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Every shared type in one place. Types only, so it is safe to import anywhere.

export type Gravity = 0 | 0.166 | 0.38 | 1
export type Pillar = 'prevention' | 'detection' | 'suppression'
export type PillarOrFundamentals = Pillar | 'fundamentals'
export type FuelClass = 'solid' | 'liquid' | 'gas' | 'aerosol' | 'unknown'
export type Source = 'table' | 'assumed' | null

export type Scenario = {
  presetId: string | null
  o2: number
  pressurePsi: number
  gravity: Gravity
  flowCmS: number
  focus: Pillar | null
}

export type MethodConstants = {
  o2Scale: number
  pressureScale: number
  saturation: number
  fundamentalsWeight: number
  pillarWeights: Record<Pillar, number>
}

export type CoverageResult = {
  overall: number
  byPillar: Record<Pillar, { score: number; effectiveTests: number; assumedShare: number }>
  assumedShare: number
  nearbyByFuelClass: Record<string, number>
  nearbyTotal: number
  nearest: { testId: string; distance: number }[]
}

export type Test = {
  id: string
  accession: string
  table: string
  rowIndex: number
  label: string
  fuel: string | null
  fuelClass: FuelClass
  o2: number | null
  o2Source: Source
  pressureAtm: number | null
  pressureSource: Source
  flowCmS: number | null
  diluent: { n2?: number; co2?: number; he?: number } | null
  outcome: string | null
  extra: Record<string, string | number | boolean | null>
  raw: Record<string, string>
  flags?: string[]
}

export type Investigation = {
  accession: string
  displayName: string
  acronym: string | null
  title: string
  doi: string | null
  license: { id: string; name: string; link: string } | null
  projectType: string
  subResearchArea: string | null
  flightProgram: string | null
  managingCenter: string | null
  startDate: string | null
  endDate: string | null
  releaseDate: string | null
  modifiedDate: string | null
  objective: string
  approach: string
  hypothesis: string
  researchImpacts: string
  experimentHardware: string
  experimentHardwareLink: string | null
  keywords: string[]
  related: string[]
  contacts: { firstName: string; lastName: string; affiliation: string; role: string }[]
  publications: { title: string; authors: string; doi: string | null }[]
  tables: { file: string; rows: number }[]
  files: { total: number; byCategory: Record<string, number>; byExtension: Record<string, number> } | null
  totalFileSizeBytes: number | null
  thumbnail: string | null
  pillar: PillarOrFundamentals
  secondaryPillars: Pillar[]
  fuelClass: FuelClass
  hardwareFamily: string
  informs: string[]
  summary: { burned: string; varied: string; matters: string; generatedBy: string; reviewed: boolean }
  testCount: number
  psiUrl: string
}

export type ColumnClass = 'constant' | 'factor' | 'continuous' | 'identifier' | 'notes'

export type ColumnProfile = {
  header: string
  displayHeader: string
  corrected: boolean
  nonEmpty: number
  distinct: number
  numeric: boolean
  min: number | null
  median: number | null
  max: number | null
  unit: string | null
  klass: ColumnClass
  topValues: { value: string; count: number }[]
}

export type TableProfile = {
  accession: string
  table: string
  rows: number
  columns: ColumnProfile[]
  noteRows: { rowIndex: number; cells: Record<string, string> }[]
}

export type Habitat = {
  id: string
  name: string
  o2: number
  pressurePsi: number
  gravity: Gravity
  gravityLabel: string
  source: string
}

export type Assumption = {
  accession: string
  o2: number | null
  pressureAtm: number | null
  reason: string
  // The record or paper the value was checked against.
  source?: string
  status: 'needs human check' | 'confirmed' | 'changed'
}

export type HardwareFamily = { id: string; name: string; note: string }
export type EquipmentTag = { id: string; label: string }
export type GlossaryTerm = { id: string; term: string; definition: string; aliases: string[] }
export type ResourceLink = { name: string; url: string; kind: string; use: string }
export type ContextCard = {
  id: string
  kind: 'incident' | 'spinoff'
  title: string
  text: string
  url: string
  sourceName: string
  related?: string[]
}

export type Snapshot = {
  schemaVersion: 1
  buildId: string
  fetchedAt: string
  generatedBy: string
  counts: {
    investigations: number
    tables: number
    rows: number
    tests: number
    testsWithOxygen: number
    testsWithAssumedOxygen: number
    testsWithAssumedValue: number
    projectTypes: Record<string, number>
  }
  investigations: Investigation[]
  tests: Test[]
  tableProfiles: TableProfile[]
  habitats: Habitat[]
  assumptions: Assumption[]
  // One sentence on who reviewed the assumptions and when. Null while they are unreviewed.
  assumptionsReview: string | null
  // Table rows that record no test, left out of the tests and listed on About.
  droppedRows: { accession: string; table: string; rowIndex: number; label: string; reason: string; raw: Record<string, string> }[]
  labelCorrections: { accession: string; table: string; original: string; corrected: string; reason: string }[]
  glossary: GlossaryTerm[]
  hardwareFamilies: HardwareFamily[]
  equipmentTags: EquipmentTag[]
  equipmentBasis: { accession: string; tags: string[]; basis: string; status: string }[]
  resources: ResourceLink[]
  context: ContextCard[]
  quotes: {
    artemis: { text: string; attribution: string; url: string }
    watchFirst: { label: string; url: string }
  }
}

export type InsightEvidence = { accession: string; table?: string; testIds?: string[]; field?: string }

export type Insight = {
  id: string
  pillar: Pillar | 'gap' | 'method' | 'fundamentals' | 'data'
  headline: string
  detail: string
  numbers: Record<string, number>
  display: Record<string, string>
  primary: string
  evidence: InsightEvidence[]
  // The rows behind each number, by number key. A number with no entry uses all evidence rows.
  byNumber: Record<string, string[]>
  highlight?: string
  formula?: string
  appliesWhen?: { minO2?: number; maxO2?: number; gravity?: number[] }
  generatedBy: string
  reviewed: boolean
  verified: 'snapshot' | 'snapshot and raw files'
}

export type InsightsFile = { schemaVersion: 1; buildId: string; generatedBy: string; insights: Insight[] }

export type EvidenceKind = 'insight' | 'investigation' | 'glossary' | 'habitat' | 'method' | 'hardware' | 'context'

export type EvidenceItem = {
  id: string
  kind: EvidenceKind
  title: string
  text: string
  href: string
}

export type EvidenceBundle = {
  schemaVersion: 1
  bundleId: string
  generatedBy: string
  items: Record<string, EvidenceItem>
}

export type SearchDoc = {
  id: string
  evidenceId: string
  kind: string
  title: string
  acronym?: string
  keywords?: string
  summary?: string
  body: string
  appliesWhen?: { minO2?: number; maxO2?: number; gravity?: number[] }
}

export type SearchIndexFile = {
  schemaVersion: 1
  buildId: string
  generatedBy: string
  docs: SearchDoc[]
  aliases: Record<string, string[]>
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2'
    dtype: 'q8'
    dim: 384
    encoding: 'int8-base64'
    chunkDocIds: string[]
    vectors: string
  } | null
}

// The rows of the nearby subset that carry one caveat.
export type NearbySubset = 'assumed' | 'inverse'

export type DrillStep =
  | { kind: 'coverage'; pillar: Pillar | 'overall' }
  | { kind: 'region'; id: 'moon' }
  // The nearby rule around one point. A fuel class or a subset narrows it to those rows only.
  | { kind: 'near'; o2: number; pressureAtm: number; fuel?: FuelClass; only?: NearbySubset }
  | { kind: 'stack'; o2: number; pressureAtm: number }
  | { kind: 'rank'; accession: string; part: 'A' | 'F' | 'P' | 'D' }
  | { kind: 'insight'; id: string; number: string }
  | { kind: 'column'; accession: string; table: number; column: number; value: string }
  | { kind: 'fireball'; readout: 'burningRate' | 'outcomes' | 'flameTemperature' | 'nearest' }
  | { kind: 'bin'; chart: 'dsquared' | 'validation' | 'extinction' | 'burnLength'; key: string }
  | { kind: 'investigation'; accession: string }
  | { kind: 'test'; id: string }
  // The map filter a mark was drawn under. It narrows the mark before it to the tests of the filter.
  | { kind: 'scope'; pillar?: PillarOrFundamentals; fuel?: FuelClass; inv?: string; hw?: string; q?: string }

export type DrillPath = DrillStep[]

export type DrillGroup = {
  accession: string
  testIds: string[]
  count: number
  assumed: number
  effective?: number
}

export type DrillResult = {
  level: 'mark' | 'investigation' | 'test'
  title: string
  formula: string | null
  note: string | null
  groups: DrillGroup[]
  edge: DrillGroup[]
  testIds: string[]
  total: number
  highlightTestId: string | null
  test: Test | null
  crumbs: { label: string; path: DrillPath }[]
  // Where to go next when a mark has no rows behind it.
  links: { label: string; to: string }[]
}

export type RemovalReason = 'no_citation' | 'unknown_id' | 'number_not_in_source' | 'verdict_language' | 'low_overlap'

export type CheckedSegment = {
  text: string
  cites: string[]
  status: 'kept' | 'removed'
  reason?: RemovalReason
}

export type CheckResult = {
  verdict: 'verified' | 'refusal' | 'rejected'
  segments: CheckedSegment[]
  kept: number
  removed: number
}

export type PinnedAnswer = {
  id: string
  question: string
  scenario: Scenario | null
  evidenceIds: string[]
  segments: { text: string; cites: string[] }[]
  model: string
  generatedBy: string
  generatedAt: string
  bundleId: string
  check: { verdict: 'verified'; removed: number }
  reviewed: boolean
  reviewNote: string
}

export type PinnedAnswersFile = { schemaVersion: 1; generatedBy: string; answers: PinnedAnswer[] }

export type RetrievalResult = {
  mode: 'keyword' | 'keyword+meaning'
  hasEvidence: boolean
  pack: { evidenceId: string; score: number; matchedDocIds: string[] }[]
  // total is the full number of matching tests. testIds lists at most the first 300.
  rows: { filter: string; testIds: string[]; total: number } | null
  scenarioChange: Partial<Scenario> | null
}

export type AskRequest = {
  question: string
  scenario: { presetId: string | null; o2: number; pressurePsi: number; gravity: Gravity }
  evidenceIds: string[]
  use?: 'backup'
}
