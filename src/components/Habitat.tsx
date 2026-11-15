// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The habitat picker. It sits at the right end of the top bar and drives everything under it.
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Gravity, Scenario } from '../types.ts'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useScenario } from '../state/hooks.ts'
import { GRAVITIES, fromHabitat, gravityLabel, matchPreset } from '../state/scenario.ts'
import { Segmented, Slider } from './ui.tsx'

export const GRAVITY_SHORT: Record<string, string> = { 0: '0 g', 0.166: 'Moon', 0.38: 'Mars', 1: '1 g' }

export function habitatFacts(s: { o2: number; pressurePsi: number }): string {
  return `${formatPercent(s.o2)} O2 · ${formatNumber(s.pressurePsi, 1)} psi`
}

// The custom controls. A drag redraws the page at most once every 120 ms.
function CustomHabitat() {
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
    timer.current = setTimeout(() => setScenario(next, { replace: true }), 120)
  }
  return (
    <div className="grid gap-3 px-2 pb-2 pt-3 sm:grid-cols-2">
      <Slider label="Oxygen" min={12} max={100} step={0.5} value={Math.round(draft.o2 * 1000) / 10} display={formatPercent(draft.o2)} onChange={(v) => change({ o2: v / 100 })} />
      <Slider label="Pressure" min={3} max={15} step={0.1} value={draft.pressurePsi} display={`${formatNumber(draft.pressurePsi, 1)} psi`} onChange={(v) => change({ pressurePsi: v })} />
      <div className="sm:col-span-2">
        <Slider label="Air flow" min={0} max={50} step={1} value={draft.flowCmS} display={`${draft.flowCmS} cm/s`} onChange={(v) => change({ flowCmS: v })} />
      </div>
      <div className="sm:col-span-2">
        <span className="field-label">Gravity</span>
        <Segmented
          label="Gravity"
          value={String(draft.gravity)}
          options={GRAVITIES.map((g) => ({ value: String(g), label: GRAVITY_SHORT[String(g)] }))}
          onChange={(v) => change({ gravity: Number(v) as Gravity })}
        />
      </div>
    </div>
  )
}

function HabitatList({ onPick }: { onPick: () => void }) {
  const data = useData()
  const { scenario, setScenario } = useScenario()
  const [custom, setCustom] = useState(scenario.presetId == null)
  return (
    <div className="p-2">
      <ul className="m-0 flex list-none flex-col p-0" role="listbox" aria-label="Habitats">
        {data.habitats.map((h) => {
          const selected = scenario.presetId === h.id
          return (
            <li key={h.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => {
                  setScenario(fromHabitat(h, scenario.focus, scenario.flowCmS))
                  onPick()
                }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${selected ? 'bg-surface-2' : ''}`}
              >
                <span className="flex w-4 shrink-0 justify-center text-ember">{selected ? <Check size={14} aria-hidden="true" /> : null}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{h.name}</span>
                  <span className="num block truncate text-[11px] leading-tight text-muted">
                    {habitatFacts(h)} · {GRAVITY_SHORT[String(h.gravity)]}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-1 border-t border-line pt-1">
        <button type="button" aria-expanded={custom} onClick={() => setCustom((v) => !v)} className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${scenario.presetId == null ? 'bg-surface-2' : ''}`}>
          <span className="flex w-4 shrink-0 justify-center text-ember">
            <SlidersHorizontal size={14} aria-hidden="true" />
          </span>
          <span className="flex-1 text-[14px] font-semibold">Custom</span>
          <ChevronDown size={14} aria-hidden="true" className={`text-muted transition-transform ${custom ? 'rotate-180' : ''}`} />
        </button>
        {custom ? <CustomHabitat /> : null}
      </div>
    </div>
  )
}

export function HabitatPicker() {
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
    <div ref={wrap} className="habitat-picker no-print">
      <button ref={button} type="button" id="habitat-picker" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)} className="habitat-button">
        <span className="min-w-0">
          <span className="stat-label block !text-[9px] leading-tight text-ember" aria-hidden="true">
            Habitat
          </span>
          <span className="block truncate text-[13px] font-semibold leading-tight">{name}</span>
          <span className="num hidden truncate text-[11px] leading-tight text-muted lg:block">
            {habitatFacts(scenario)} · {GRAVITY_SHORT[String(scenario.gravity)]}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-ember transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="sr-only">Change the habitat. Now {name}, {gravityLabel(scenario.gravity)}.</span>
      </button>
      {open ? (
        <div className="habitat-pop" role="dialog" aria-label="Choose a habitat">
          <HabitatList onPick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  )
}
