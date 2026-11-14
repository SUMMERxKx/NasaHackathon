// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The habitat control. It is always visible, because it drives everything.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Gravity, Habitat, Scenario } from '../types.ts'
import { computeCoverage, scenarioPoint } from '../lib/coverage.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useScenario } from '../state/hooks.ts'
import { GRAVITIES, fromHabitat, gravityLabel, matchPreset } from '../state/scenario.ts'
import { CoverageDial } from './Coverage.tsx'
import { Segmented, Slider } from './ui.tsx'

const GRAVITY_SHORT: Record<string, string> = { 0: '0 g', 0.166: 'Moon', 0.38: 'Mars', 1: '1 g' }

export function habitatFacts(s: { o2: number; pressurePsi: number }): string {
  return `${formatPercent(s.o2)} O2 · ${formatNumber(s.pressurePsi, 1)} psi`
}

export function HabitatCard({ habitat, selected, onPick }: { habitat: Habitat; selected: boolean; onPick: () => void }) {
  const data = useData()
  const coverage = useMemo(() => computeCoverage(data.tests, data.lookup, scenarioPoint(habitat)), [data, habitat])
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`card flex w-[168px] shrink-0 snap-start flex-col gap-2 p-3 text-left transition-colors hover:bg-surface-2 md:w-auto ${
        selected ? 'border-ember glow-ember' : ''
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-[15px] font-semibold leading-tight">{habitat.name}</span>
        <CoverageDial coverage={coverage} size={72} interactive={false} label={habitat.name} />
      </span>
      <span className="num text-[12px] text-muted">{habitatFacts(habitat)}</span>
      <span className="text-[12px] text-muted">{habitat.gravityLabel}</span>
    </button>
  )
}

// Preset picks push a history entry. Slider drags replace the entry, at most once every 150 ms.
export function HabitatPicker({ onClose }: { onClose?: () => void }) {
  const { habitats } = useData()
  const { scenario, setScenario } = useScenario()
  const [draft, setDraft] = useState<Scenario>(scenario)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setDraft(scenario), [scenario])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const change = (patch: Partial<Scenario>) => {
    const merged = { ...draft, ...patch, presetId: null }
    const same = matchPreset(merged, habitats)
    const next = { ...merged, presetId: same ? same.id : null }
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setScenario(next, { replace: true }), 150)
  }
  return (
    <div className="p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px]">Pick your habitat</h2>
        {onClose ? (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close the habitat picker">
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {habitats.map((h) => (
          <HabitatCard key={h.id} habitat={h} selected={scenario.presetId === h.id} onPick={() => setScenario(fromHabitat(h, scenario.focus, scenario.flowCmS))} />
        ))}
      </div>
      <h3 className="eyebrow mb-3 mt-5">Custom habitat</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Slider label="Oxygen" min={12} max={100} step={0.5} value={Math.round(draft.o2 * 1000) / 10} display={formatPercent(draft.o2)} onChange={(v) => change({ o2: v / 100 })} />
        <Slider label="Pressure" min={3} max={15} step={0.1} value={draft.pressurePsi} display={`${formatNumber(draft.pressurePsi, 1)} psi`} onChange={(v) => change({ pressurePsi: v })} />
        <Slider label="Ventilation flow" min={0} max={50} step={1} value={draft.flowCmS} display={`${draft.flowCmS} cm/s`} onChange={(v) => change({ flowCmS: v })} />
        <div>
          <span className="field-label">Gravity</span>
          <Segmented
            label="Gravity"
            value={String(draft.gravity)}
            options={GRAVITIES.map((g) => ({ value: String(g), label: GRAVITY_SHORT[String(g)] }))}
            onChange={(v) => change({ gravity: Number(v) as Gravity })}
          />
        </div>
      </div>
      <p className="mt-4 text-[12px] text-muted">The habitat is kept in the address, so any view can be shared as a link.</p>
    </div>
  )
}

export function HabitatPill() {
  const { scenario, name } = useScenario()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        ref={button}
        type="button"
        id="habitat-pill"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 text-left transition-colors hover:border-muted md:px-4"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-habitat" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight">{name}</span>
          <span className="num block truncate text-[11px] leading-tight text-muted">
            {habitatFacts(scenario)} · {GRAVITY_SHORT[String(scenario.gravity)]}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted" />
        <span className="sr-only">Change the habitat. Now {name}, {gravityLabel(scenario.gravity)}.</span>
      </button>
      {open ? (
        <>
          <div className="scrim md:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="habitat-pop" role="dialog" aria-label="Habitat picker">
            <HabitatPicker onClose={() => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  )
}
