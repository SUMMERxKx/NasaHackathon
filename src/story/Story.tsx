// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The guided story: five steps that drive the real app. It is the demo path, playable by anyone.
// Every number in a caption is read from the data when the story runs. Nothing is typed in by hand.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { inverseClause } from '../lib/regions.ts'
import type { Data } from '../state/data.tsx'
import { useData } from '../state/data.tsx'

export type StoryStep = {
  path: string
  habitat: string
  params: Record<string, string>
  template: string
}

export const STORY_STEPS: StoryStep[] = [
  { path: '/dashboard', habitat: 'iss', params: {}, template: 'NASA has burned things in orbit for decades. Near the ISS cabin, the evidence is deep.' },
  { path: '/dashboard', habitat: 'exploration', params: {}, template: 'A Moon Base will run richer in oxygen at lower pressure. Watch the evidence thin out.' },
  { path: '/dashboard', habitat: 'exploration', params: { zoom: 'moon' }, template: 'Every mark is a real test. In this region there are {moonTests}, and {moonGas} of them are gas flames{moonInverse}.' },
  { path: '/dashboard', habitat: 'exploration', params: { drill: 'insight.I1.maxSolidO2Pct' }, template: 'Solid material tests that state their oxygen stop at {maxSolid}%. That gap is the finding.' },
  { path: '/dashboard', habitat: 'exploration', params: { ask: 'What is missing for the Moon?' }, template: 'Ask in plain words. Every sentence is checked against its source.' },
]

export function storyCaption(step: StoryStep, data: Data): string {
  const i1 = data.insightById.I1
  const i2 = data.insightById.I2
  const moonTests = i2?.numbers.moonRegionTests
  const moonGas = i2?.numbers.moonRegionGas
  const moonInverse = i2?.numbers.moonRegionInverse
  const values: Record<string, string> = {
    moonTests: String(moonTests ?? ''),
    moonGas: moonGas === moonTests ? 'all' : String(moonGas ?? ''),
    // An inverse flame's oxygen is the burner stream, not the chamber, so the caption says how many.
    moonInverse: moonGas && moonInverse ? `, ${inverseClause(moonGas, moonInverse)}` : '',
    maxSolid: (i1?.display.maxSolidO2Pct ?? '').replace('%', ''),
  }
  return step.template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

export function storyHref(n: number): string {
  const step = STORY_STEPS[n - 1]
  const query = new URLSearchParams()
  if (step.habitat !== 'iss') query.set('h', step.habitat)
  for (const [key, value] of Object.entries(step.params)) query.set(key, value)
  query.set('story', String(n))
  return `${step.path}?${query.toString()}`
}

export function StoryStepper() {
  const data = useData()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const raw = Number(params.get('story'))
  const n = Number.isInteger(raw) && raw >= 1 && raw <= STORY_STEPS.length ? raw : null
  const step = n ? STORY_STEPS[n - 1] : null
  // A step drives the real app: the right screen, the right habitat and the right panel.
  useEffect(() => {
    if (!n || !step) return
    const habitat = params.get('h') ?? 'iss'
    const onStep = location.pathname === step.path && habitat === step.habitat && Object.entries(step.params).every(([k, v]) => k === 'drill' || params.get(k) === v)
    if (!onStep) navigate(storyHref(n), { replace: true })
  }, [n, step, location.pathname, params, navigate])
  if (!n || !step) return null
  const exit = new URLSearchParams(params)
  exit.delete('story')
  const exitHref = `${location.pathname}${exit.toString() ? `?${exit.toString()}` : ''}`
  return (
    <motion.aside
      className="no-print fixed inset-x-0 top-2 z-[70] px-3 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:top-auto sm:w-[520px] sm:px-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      aria-label="The guided tour"
    >
      <div className="card card-solid flex flex-col gap-2 border-ember px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            The Moon Base tour · step <span className="num">{n}</span> of <span className="num">{STORY_STEPS.length}</span>
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug" role="status">
            {storyCaption(step, data)}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {n > 1 ? (
            <Link to={storyHref(n - 1)} className="btn btn-ghost btn-sm" preventScrollReset>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </Link>
          ) : null}
          {n < STORY_STEPS.length ? (
            <Link to={storyHref(n + 1)} className="btn btn-primary btn-sm">
              Next <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <Link to={exitHref} className="btn btn-primary btn-sm" preventScrollReset>
              Finish
            </Link>
          )}
          <Link to={exitHref} className="btn btn-ghost btn-icon btn-sm" aria-label="Exit the tour" preventScrollReset>
            <X size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.aside>
  )
}
