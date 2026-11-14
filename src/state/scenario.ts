// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The habitat lives in the URL, so any view can be shared as a link.
import type { Gravity, Habitat, Pillar, Scenario } from '../types.ts'

export const DEFAULT_FLOW = 20
export const LIMITS = { o2: [0.12, 1], pressurePsi: [3, 15], flow: [0, 50] } as const
export const GRAVITIES: Gravity[] = [0, 0.166, 0.38, 1]
export const SCENARIO_KEYS = ['h', 'o2', 'p', 'g', 'flow', 'focus'] as const
const PILLARS: Pillar[] = ['prevention', 'detection', 'suppression']

const clamp = (value: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, value))
const round1 = (value: number): number => Math.round(value * 10) / 10

export function fromHabitat(h: Habitat, focus: Pillar | null = null, flowCmS = DEFAULT_FLOW): Scenario {
  return { presetId: h.id, o2: h.o2, pressurePsi: h.pressurePsi, gravity: h.gravity, flowCmS, focus }
}

function readNumber(params: URLSearchParams, key: string): number | null {
  const text = params.get(key)
  if (text == null || text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

// Values are parsed, clamped and validated. Anything invalid falls back to the ISS cabin.
export function parseScenario(params: URLSearchParams, habitats: Habitat[]): Scenario {
  const fallback = habitats.find((h) => h.id === 'iss') ?? habitats[0]
  const focusText = params.get('focus')
  const focus = PILLARS.includes(focusText as Pillar) ? (focusText as Pillar) : null
  const flowRaw = readNumber(params, 'flow')
  const flowCmS = flowRaw == null ? DEFAULT_FLOW : Math.round(clamp(flowRaw, LIMITS.flow))
  const o2Raw = readNumber(params, 'o2')
  const pRaw = readNumber(params, 'p')
  const gRaw = readNumber(params, 'g')
  const hasCustom = o2Raw != null || pRaw != null || gRaw != null
  const preset = habitats.find((h) => h.id === params.get('h'))
  if (!hasCustom) return fromHabitat(preset ?? fallback, focus, flowCmS)
  const base = preset ?? fallback
  const gravity = GRAVITIES.includes(gRaw as Gravity) ? (gRaw as Gravity) : base.gravity
  const custom: Scenario = {
    presetId: null,
    o2: o2Raw == null ? base.o2 : round1(clamp(o2Raw, [12, 100])) / 100,
    pressurePsi: pRaw == null ? base.pressurePsi : round1(clamp(pRaw, LIMITS.pressurePsi)),
    gravity,
    flowCmS,
    focus,
  }
  const same = matchPreset(custom, habitats)
  return same ? { ...custom, presetId: same.id } : custom
}

export function matchPreset(s: Scenario, habitats: Habitat[]): Habitat | null {
  return (
    habitats.find(
      (h) => Math.abs(h.o2 - s.o2) < 0.0005 && Math.abs(h.pressurePsi - s.pressurePsi) < 0.05 && h.gravity === s.gravity,
    ) ?? null
  )
}

// If custom values equal a preset, the URL collapses to h=.
export function scenarioParams(s: Scenario, habitats: Habitat[]): Record<string, string> {
  const out: Record<string, string> = {}
  const preset = (s.presetId ? habitats.find((h) => h.id === s.presetId) : null) ?? matchPreset(s, habitats)
  if (preset && matchPreset(s, [preset])) {
    if (preset.id !== 'iss') out.h = preset.id
  } else {
    out.o2 = String(round1(s.o2 * 100))
    out.p = String(round1(s.pressurePsi))
    out.g = String(s.gravity)
  }
  if (s.flowCmS !== DEFAULT_FLOW) out.flow = String(s.flowCmS)
  if (s.focus) out.focus = s.focus
  return out
}

// Writes the habitat into a set of search parameters and keeps everything else.
export function applyScenario(current: URLSearchParams, s: Scenario, habitats: Habitat[]): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of SCENARIO_KEYS) next.delete(key)
  for (const [key, value] of Object.entries(scenarioParams(s, habitats))) next.set(key, value)
  return next
}

// The habitat part of a query string, for internal links. Screen-level parameters are dropped.
export function scenarioQuery(current: URLSearchParams): string {
  const next = new URLSearchParams()
  for (const key of SCENARIO_KEYS) {
    const value = current.get(key)
    if (value != null) next.set(key, value)
  }
  const text = next.toString()
  return text ? `?${text}` : ''
}

export function scenarioName(s: Scenario, habitats: Habitat[]): string {
  const preset = s.presetId ? habitats.find((h) => h.id === s.presetId) : null
  return preset ? preset.name : 'Custom habitat'
}

export function gravityLabel(g: Gravity): string {
  if (g === 0) return 'microgravity'
  if (g === 0.166) return 'Moon gravity 0.166 g'
  if (g === 0.38) return 'Mars gravity 0.38 g'
  return 'Earth gravity 1 g'
}

export const isPartialGravity = (g: Gravity): boolean => g === 0.166 || g === 0.38

// The habitat line that is sent to the model as evidence item S.
export function scenarioLine(s: Scenario, habitats: Habitat[]): string {
  const pct = Math.round(s.o2 * 1000) / 10
  return `${scenarioName(s, habitats)}. ${pct}% oxygen, ${round1(s.pressurePsi)} psi, ${gravityLabel(s.gravity)}.`
}
