// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The 24 investigations as one scannable list, ranked for the chosen habitat.
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import type { Pillar } from '../types.ts'
import { useData } from '../state/data.tsx'
import { useRanking, useScenario } from '../state/hooks.ts'
import { PageHeader } from '../components/AppShell.tsx'
import { FUEL_NAME, InvestigationRow, PILLAR_NAME } from '../components/cards.tsx'
import { Chip, EmptyState, ScenarioLink, Segmented } from '../components/ui.tsx'

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Newest' },
  { value: 'tests', label: 'Most tests' },
  { value: 'name', label: 'Name' },
]
const FUELS = ['solid', 'liquid', 'gas', 'aerosol']

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
  const filterCount = [pillar, fuel, hw, type, informs].filter(Boolean).length
  const [showFilters, setShowFilters] = useState(filterCount > 0)
  const [openRow, setOpenRow] = useState<string | null>(null)
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

  return (
    <div className="page">
      <PageHeader title="Investigations" lead={`Ranked for ${name}`} />
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="List controls">
        <div className="hide-scrollbar max-w-full overflow-x-auto">
          <Segmented label="Sort" value={sort} options={SORTS} onChange={(v) => set('sort', v === 'relevance' ? '' : v)} />
        </div>
        <div className="hide-scrollbar max-w-full overflow-x-auto">
          <Segmented
            label="Focus pillar for the ranking"
            value={scenario.focus ?? 'none'}
            options={[{ value: 'none', label: 'No focus' }, { value: 'prevention', label: 'Prevention' }, { value: 'detection', label: 'Detection' }, { value: 'suppression', label: 'Suppression' }]}
            onChange={(v) => setScenario({ ...scenario, focus: v === 'none' ? null : (v as Pillar) }, { replace: true })}
          />
        </div>
        <button type="button" className={`chip ${filterCount > 0 ? 'chip-on' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={13} aria-hidden="true" /> Filters{filterCount > 0 ? ` ${filterCount}` : ''}
        </button>
        <span className="num ml-auto text-[12px] text-muted" role="status">
          {list.length} of {snapshot.investigations.length}
        </span>
      </div>
      {showFilters ? (
        <div className="card mb-3 flex flex-col gap-2.5 p-3" role="group" aria-label="Filters">
          <div className="flex flex-wrap items-center gap-1.5">
            {['prevention', 'detection', 'suppression', 'fundamentals'].map((p) => (
              <Chip key={p} pressed={pillar === p} onClick={() => set('pillar', pillar === p ? '' : p)}>
                {PILLAR_NAME[p]}
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
            {FUELS.map((f) => (
              <Chip key={f} pressed={fuel === f} onClick={() => set('fuel', fuel === f ? '' : f)}>
                {FUEL_NAME[f]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="stat-label mr-1">Informs</span>
            {snapshot.equipmentTags.map((tag) => (
              <Chip key={tag.id} pressed={informs === tag.id} onClick={() => set('informs', informs === tag.id ? '' : tag.id)}>
                {tag.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select !min-h-9 sm:!w-60" name="hw" aria-label="Hardware" value={hw} onChange={(e) => set('hw', e.target.value)}>
              <option value="">All hardware</option>
              {snapshot.hardwareFamilies.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select className="select !min-h-9 sm:!w-56" name="type" aria-label="Project type" value={type} onChange={(e) => set('type', e.target.value)}>
              <option value="">All project types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState title="No investigation matches these filters">Clear a filter to see more.</EmptyState>
      ) : (
        <ol className="card m-0 list-none overflow-hidden p-0">
          {list.map((r) => (
            <InvestigationRow
              key={r.accession}
              inv={invByAcc[r.accession]}
              ranked={r}
              position={position[r.accession]}
              open={openRow === r.accession}
              onToggle={() => setOpenRow(openRow === r.accession ? null : r.accession)}
              selected={selected.includes(r.accession)}
              onSelect={toggleSelect}
            />
          ))}
        </ol>
      )}

      {selected.length >= 1 ? (
        <div className="no-print fixed inset-x-0 bottom-[128px] z-30 px-4 sm:bottom-[76px]">
          <div className="card mx-auto flex max-w-[640px] flex-wrap items-center justify-between gap-3 px-4 py-2.5" style={{ boxShadow: 'var(--shadow-pop)' }}>
            <p className="min-w-0 truncate text-[13px]">
              <span className="num">{selected.length}</span> selected: {selected.map((a) => invByAcc[a]?.displayName ?? a).join(', ')}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('sel', '')}>
                Clear
              </button>
              {selected.length >= 2 ? (
                <ScenarioLink to={`/investigations/compare?ids=${selected.join(',')}`} className="btn btn-primary btn-sm">
                  Compare {selected.length}
                </ScenarioLink>
              ) : (
                <span className="text-[12px] text-muted">Pick one more</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
