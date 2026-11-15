// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The habitat, the derived scores and the drill path, all read from the URL.
import { useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { CoverageResult, DrillPath, Habitat, Scenario } from '../types.ts'
import { computeCoverage, scenarioPoint } from '../lib/coverage.ts'
import type { Point } from '../lib/coverage.ts'
import { decodeDrill, encodeDrill } from '../lib/drill.ts'
import { rankAll } from '../lib/ranking.ts'
import type { Ranked } from '../lib/ranking.ts'
import { useData } from './data.tsx'
import { applyScenario, parseScenario, scenarioName, scenarioQuery } from './scenario.ts'

export function useScenario(): {
  scenario: Scenario
  point: Point
  name: string
  habitat: Habitat | null
  setScenario: (next: Scenario, options?: { replace?: boolean }) => void
  query: string
} {
  const { habitats } = useData()
  const [params, setParams] = useSearchParams()
  const key = ['h', 'o2', 'p', 'g', 'flow', 'focus'].map((k) => params.get(k) ?? '').join('|')
  const scenario = useMemo(() => parseScenario(params, habitats), [key, habitats]) // eslint-disable-line react-hooks/exhaustive-deps
  const point = useMemo(() => scenarioPoint(scenario), [scenario])
  const setScenario = useCallback(
    (next: Scenario, options?: { replace?: boolean }) => {
      setParams((current) => applyScenario(current, next, habitats), { replace: options?.replace ?? false })
    },
    [setParams, habitats],
  )
  const habitat = scenario.presetId ? (habitats.find((h) => h.id === scenario.presetId) ?? null) : null
  return { scenario, point, name: scenarioName(scenario, habitats), habitat, setScenario, query: scenarioQuery(params) }
}

export function useCoverage(): CoverageResult {
  const data = useData()
  const { point } = useScenario()
  return useMemo(() => computeCoverage(data.tests, data.lookup, point), [data, point])
}

export function useCoverageAt(point: Point): CoverageResult {
  const data = useData()
  return useMemo(() => computeCoverage(data.tests, data.lookup, point), [data, point.o2, point.pressureAtm]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useRanking(): Ranked[] {
  const data = useData()
  const { scenario, point } = useScenario()
  return useMemo(
    () => rankAll(data.snapshot.investigations, data.testsByAcc, point, scenario.focus),
    [data, point, scenario.focus],
  )
}

// The drill path lives in one query parameter beside the habitat.
// Opening a level pushes one history entry, so Back steps up one level.
export function useDrill(): {
  path: DrillPath | null
  open: (path: DrillPath) => void
  close: () => void
  hrefFor: (path: DrillPath) => string
} {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const text = params.get('drill')
  const path = useMemo(() => decodeDrill(text), [text])
  const hrefFor = useCallback(
    (next: DrillPath) => {
      const p = new URLSearchParams(params)
      p.set('drill', encodeDrill(next))
      return `${location.pathname}?${p.toString()}`
    },
    [params, location.pathname],
  )
  // The opener keeps one identity for the life of the screen. The map hands it to every mark,
  // so a new one on each address change would redraw two thousand marks.
  const latest = useRef(hrefFor)
  latest.current = hrefFor
  const open = useCallback((next: DrillPath) => navigate(latest.current(next), { preventScrollReset: true }), [navigate])
  const close = useCallback(() => {
    const p = new URLSearchParams(params)
    p.delete('drill')
    const q = p.toString()
    navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true, preventScrollReset: true })
  }, [navigate, params, location.pathname])
  return { path, open, close, hrefFor }
}
