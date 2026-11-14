// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The 24 investigations, ranked for the chosen habitat, with "Why this rank".
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Pillar } from '../types.ts'
import { useData } from '../state/data.tsx'
import { useRanking, useScenario } from '../state/hooks.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { FUEL_NAME, PILLAR_NAME, RankedCard } from '../components/cards.tsx'
import { Chip, EmptyState, ScenarioLink, Segmented } from '../components/ui.tsx'

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Newest' },
  { value: 'tests', label: 'Most tests' },
  { value: 'name', label: 'Name' },
]

export default function Investigations() {
  const { snapshot, invByAcc } = useData()
  const { scenario, setScenario, name } = useScenario()
  const ranking = useRanking()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') ?? 'relevance'
  const pillar = params.get('pillar') ?? ''
  const fuel = params.get('fuel') ?? ''
  const hw = params.get('hw') ?? ''
  const type = params.get('type') ?? ''
  const informs = params.get('informs') ?? ''
  const selected = (params.get('sel') ?? '').split(',').filter(Boolean)
  const set = useCallback(
    (key: string, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === '') next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )
  const toggleSelect = (accession: string) => {
    const next = selected.includes(accession) ? selected.filter((a) => a !== accession) : [...selected, accession].slice(-3)
    set('sel', next.join(','))
  }
  const position = useMemo(() => Object.fromEntries(ranking.map((r, i) => [r.accession, i + 1])), [ranking])
  const list = useMemo(() => {
    const rows = ranking.filter((r) => {
      const inv = invByAcc[r.accession]
      if (pillar && inv.pillar !== pillar && !inv.secondaryPillars.includes(pillar as Pillar)) return false
      if (fuel && inv.fuelClass !== fuel) return false
      if (hw && inv.hardwareFamily !== hw) return false
      if (type && inv.projectType !== type) return false
      if (informs && !inv.informs.includes(informs)) return false
      return true
    })
    if (sort === 'date') return [...rows].sort((a, b) => (invByAcc[b.accession].endDate ?? '').localeCompare(invByAcc[a.accession].endDate ?? ''))
    if (sort === 'tests') return [...rows].sort((a, b) => invByAcc[b.accession].testCount - invByAcc[a.accession].testCount)
    if (sort === 'name') return [...rows].sort((a, b) => invByAcc[a.accession].displayName.localeCompare(invByAcc[b.accession].displayName))
    return rows
  }, [ranking, invByAcc, pillar, fuel, hw, type, informs, sort])
  const types = Object.keys(snapshot.counts.projectTypes)
  const fuels = ['solid', 'liquid', 'gas', 'aerosol']

  return (
    <div className="page">
      <PageHeader
        title="Investigations"
        lead={`All ${snapshot.investigations.length} PSI combustion investigations, ranked for ${name}. The ranking is a transparent heuristic. Every bar opens the tests that were counted.`}
      />
      <div className="mb-5 flex flex-col gap-3" role="group" aria-label="List controls">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="field-label">Sort</span>
            <Segmented label="Sort" value={sort} options={SORTS} onChange={(v) => set('sort', v === 'relevance' ? '' : v)} />
          </div>
          <div>
            <span className="field-label">Focus pillar for the ranking</span>
            <Segmented
              label="Focus pillar"
              value={scenario.focus ?? 'none'}
              options={[{ value: 'none', label: 'None' }, { value: 'prevention', label: 'Prevention' }, { value: 'detection', label: 'Detection' }, { value: 'suppression', label: 'Suppression' }]}
              onChange={(v) => setScenario({ ...scenario, focus: v === 'none' ? null : (v as Pillar) }, { replace: true })}
            />
          </div>
          <label className="w-full sm:w-60">
            <span className="field-label">Hardware</span>
            <select className="select" value={hw} onChange={(e) => set('hw', e.target.value)}>
              <option value="">All hardware</option>
              {snapshot.hardwareFamilies.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full sm:w-56">
            <span className="field-label">Project type</span>
            <select className="select" value={type} onChange={(e) => set('type', e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Pillar</span>
          {['prevention', 'detection', 'suppression', 'fundamentals'].map((p) => (
            <Chip key={p} pressed={pillar === p} onClick={() => set('pillar', pillar === p ? '' : p)}>
              {PILLAR_NAME[p]}
            </Chip>
          ))}
          <span className="eyebrow ml-3 mr-1">Fuel</span>
          {fuels.map((f) => (
            <Chip key={f} pressed={fuel === f} onClick={() => set('fuel', fuel === f ? '' : f)}>
              {FUEL_NAME[f]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">What this informs</span>
          {snapshot.equipmentTags.map((tag) => (
            <Chip key={tag.id} pressed={informs === tag.id} onClick={() => set('informs', informs === tag.id ? '' : tag.id)}>
              {tag.label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mb-3 text-[13px] text-muted" role="status">
        Showing <span className="num text-ink">{list.length}</span> of {snapshot.investigations.length} investigations.
      </p>
      {list.length === 0 ? (
        <EmptyState title="No investigation matches these filters">Clear a filter to see more.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <RankedCard key={r.accession} inv={invByAcc[r.accession]} ranked={r} position={position[r.accession]} selected={selected.includes(r.accession)} onSelect={toggleSelect} />
          ))}
        </div>
      )}

      {selected.length >= 1 ? (
        <div className="no-print fixed inset-x-0 bottom-[72px] z-30 px-4 lg:bottom-4">
          <div className="card mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ boxShadow: 'var(--shadow-pop)' }}>
            <p className="text-[14px]">
              <span className="num">{selected.length}</span> selected: {selected.map((a) => invByAcc[a]?.displayName ?? a).join(', ')}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('sel', '')}>
                Clear
              </button>
              {selected.length >= 2 ? (
                <ScenarioLink to={`/compare?ids=${selected.join(',')}`} className="btn btn-primary btn-sm">
                  Compare {selected.length}
                </ScenarioLink>
              ) : (
                <span className="text-[13px] text-muted">Select one more to compare</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
