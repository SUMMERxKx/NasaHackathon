// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The fireball's stage: the poster or the live view, the temperature scale, the view switch,
// three sourced numbers and the small SI mark. Nothing is conveyed by the canvas alone.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Camera, Flame, Play } from 'lucide-react'
import { formatNumber } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useScenario } from '../state/hooks.ts'
import { GATES, flameParams } from '../three/flameParams.ts'
import type { FlameParams } from '../three/flameParams.ts'
import { CAMERA, SCALE, SI_LABEL, SI_MARK, STAGE, kelvinToT, rampCss, rampGradient } from '../three/ramp.ts'
import { SourcedNumber, useCountUp, usePrefersReducedMotion } from './ui.tsx'

const LiveFireball = lazy(() => import('../three/Fireball.tsx'))

export type FlameView = 'heat' | 'camera'
export type DropletState = { scale: number; flameOn: boolean } | null

// A still picture drawn from the same ramp colours, with the label inside it.
// It is what a visitor sees before the 3D code arrives, when anything fails, and under reduced motion.
export function FireballPoster({ params, view, droplet = null, showEarth = true }: { params: FlameParams; view: FlameView; droplet?: DropletState; showEarth?: boolean }) {
  const top = params.inputs.tempTop
  const hot = view === 'heat' ? rampCss(top) : CAMERA.pale
  const mid = view === 'heat' ? rampCss(top * 0.72) : CAMERA.blue
  const cool = view === 'heat' ? rampCss(top * 0.4) : CAMERA.deep
  const opacity = params.ghost ? 0 : 0.35 + 0.65 * params.inputs.evidence
  const dropletR = 13 * (droplet ? droplet.scale : 1)
  const flameOn = droplet ? droplet.flameOn : true
  const earth = params.shape === 'earth'
  return (
    <svg viewBox="0 0 360 240" className="h-full w-full" role="img" aria-label={`${SI_LABEL}. A burning fuel droplet in freefall: a small sphere of liquid inside a sphere of flame${showEarth ? ', beside a small teardrop flame as on Earth' : ''}.`}>
      <defs>
        <radialGradient id="poster-ball" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cool} stopOpacity="0.25" />
          <stop offset="48%" stopColor={mid} stopOpacity="0.75" />
          <stop offset="70%" stopColor={hot} />
          <stop offset="84%" stopColor={mid} stopOpacity="0.7" />
          <stop offset="100%" stopColor={cool} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="poster-earth" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={view === 'heat' ? rampCss(0.55) : CAMERA.blue} />
          <stop offset="45%" stopColor={view === 'heat' ? rampCss(0.86) : CAMERA.soot} />
          <stop offset="100%" stopColor={view === 'heat' ? rampCss(0.45) : CAMERA.soot} stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="poster-drop" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor={CAMERA.pale} />
          <stop offset="100%" stopColor={CAMERA.deep} />
        </radialGradient>
      </defs>
      <rect width="360" height="240" fill={CAMERA.deep} opacity="0.001" />
      {showEarth ? (
        <g transform={earth ? 'translate(196,58) scale(1.55)' : 'translate(40,104)'} opacity={earth ? 1 : 0.95}>
          <path d="M22,78C6,66 8,44 16,28C19,20 21,10 22,0C24,10 27,20 30,28C38,44 38,66 22,78Z" fill="url(#poster-earth)" />
          <rect x="15" y="80" width="14" height="30" rx="2" fill="var(--muted)" opacity="0.7" />
          <line x1="22" y1="72" x2="22" y2="81" stroke="var(--ink)" strokeWidth="1.5" />
          {!earth ? (
            <text x="22" y="126" textAnchor="middle" fontSize="10" fill="var(--muted)">
              On Earth
            </text>
          ) : null}
        </g>
      ) : null}
      {!earth ? (
        <g transform={`translate(${showEarth ? 212 : 180},112)`}>
          {params.ghost ? (
            <>
              <circle r="74" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.8" />
              <circle r="13" fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="2 4" />
            </>
          ) : (
            <>
              {flameOn ? <circle r="92" fill="url(#poster-ball)" opacity={opacity} /> : null}
              <circle r={Math.max(1.5, dropletR)} fill="url(#poster-drop)" opacity="0.95" />
            </>
          )}
          <text y="104" textAnchor="middle" fontSize="10" fill="var(--muted)">
            In freefall
          </text>
        </g>
      ) : null}
      <g transform="translate(332,218)">
        <rect width="22" height="15" rx="4" fill="var(--label-bg)" fillOpacity="0.7" stroke="var(--line)" />
        <text x="11" y="11" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--label-ink)">
          {SI_MARK}
        </text>
      </g>
    </svg>
  )
}

// The scale is plain HTML under the canvas, with two labelled ends from NASA's guide.
export function TemperatureScale({ params }: { params: FlameParams }) {
  const flameAt = kelvinToT(SCALE.flameK) * 100
  const markAt = params.tempTopKelvin != null && GATES.tadConfirmed ? kelvinToT(params.tempTopKelvin) * 100 : null
  return (
    <div aria-label="Temperature scale in kelvin" title="Illustrative temperature pattern. The two labelled ends are from NASA's guide to combustion science.">
      <div className="relative h-1.5 rounded-full" style={{ background: rampGradient('to right') }} data-ramp={rampGradient('to right')}>
        <span className="absolute -top-0.5 h-2.5 w-px bg-ink" style={{ left: `${flameAt}%` }} aria-hidden="true" />
        {markAt != null ? <span className="absolute -top-1 h-3.5 w-0.5 bg-freefall" style={{ left: `${markAt}%`, transition: 'left var(--t-scene) var(--ease-out)' }} aria-hidden="true" /> : null}
      </div>
      <div className="num relative mt-1 h-4 text-[10px] text-muted">
        <span className="absolute left-0">300 K</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${flameAt}%` }}>
          2,300 K
        </span>
      </div>
    </div>
  )
}

function Tile({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <li className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="whitespace-nowrap text-[16px] leading-tight">{children}</span>
      <span className="truncate text-[11px] text-muted" title={note}>
        {note}
      </span>
    </li>
  )
}

// Three numbers, each sourced. A click opens the NASA rows behind it.
export function FireballReadout({ params }: { params: FlameParams }) {
  const look = params.lookup
  const rate = useCountUp(look.burningRate.value ?? 0, 400)
  const temp = useCountUp(look.flameTemperature.value ?? 0, 400)
  if (params.ghost) {
    return (
      <p className="text-[13px]">
        <strong>No droplet test near this atmosphere.</strong>{' '}
        {params.nearestText ? (
          <>
            Nearest:{' '}
            <SourcedNumber path={[{ kind: 'fireball', readout: 'nearest' }]} label={`The nearest droplet test ran at ${params.nearestText}`}>
              {params.nearestText}
            </SourcedNumber>
            .
          </>
        ) : null}
      </p>
    )
  }
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
      <Tile label="Burn rate" note={look.burningRate.tests.length > 0 ? `${look.burningRate.tests.length} FLEX tests` : 'between tests'}>
        {look.burningRate.tests.length > 0 ? (
          <SourcedNumber path={[{ kind: 'fireball', readout: 'burningRate' }]} label={`Burning rate ${formatNumber(look.burningRate.value ?? 0, 3)}, the median of ${look.burningRate.tests.length} FLEX tests`}>
            {formatNumber(rate, 3)}
          </SourcedNumber>
        ) : (
          <span className="num">{look.burningRate.value != null ? formatNumber(look.burningRate.value, 2) : 'none'}</span>
        )}
      </Tile>
      <Tile label="Went out" note="FLEX tests">
        <SourcedNumber path={[{ kind: 'fireball', readout: 'outcomes' }]} label={`${look.extinction.ended.length} of ${look.extinction.of.length} nearby FLEX tests ended in extinction`}>
          {look.extinction.ended.length} of {look.extinction.of.length}
        </SourcedNumber>
      </Tile>
      <Tile label="Flame temp" note={look.flameTemperature.value != null ? `${look.flameTemperature.tests.length} ACME tests` : 'no test nearby'}>
        {look.flameTemperature.value != null ? (
          <SourcedNumber path={[{ kind: 'fireball', readout: 'flameTemperature' }]} label={`Listed flame temperature ${Math.round(look.flameTemperature.value)} kelvin, the median of ${look.flameTemperature.tests.length} ACME tests`}>
            {Math.round(temp).toLocaleString('en-US')} K
          </SourcedNumber>
        ) : (
          <span className="num">none</span>
        )}
      </Tile>
    </ul>
  )
}

export const BASIS = {
  tables: 'From the NASA tables',
  direction: 'Direction from a NASA source',
  definition: 'By definition',
}

// What each control changes in the picture. Shown on the About screen.
export const DRIVERS: { control: string; change: string; basis: keyof typeof BASIS }[] = [
  { control: 'Oxygen', change: 'How fast it seethes, from the median FLEX burning rate near this oxygen', basis: 'tables' },
  { control: 'Oxygen', change: 'How hot the brightest part is, from the listed flame temperature of ACME gas flames. A calculated upper temperature', basis: 'tables' },
  { control: 'Oxygen', change: 'Whether it holds, struggles or goes out, from the share of nearby FLEX tests that ended in extinction', basis: 'tables' },
  { control: 'Oxygen', change: 'In the camera view, how blue or how yellow it is. NASA\'s guide says a flame stays bluer longer at lower oxygen', basis: 'direction' },
  { control: 'Oxygen and pressure', change: 'Whether it is solid or a ghost, from the count of droplet tests within one unit of the habitat', basis: 'tables' },
  { control: 'Pressure', change: 'How dense the haze of gas around it is', basis: 'definition' },
  { control: 'Ventilation flow', change: 'Tracer points drifting past, and a lean downwind. NASA\'s guide says ventilation flow strongly enhances flames', basis: 'direction' },
  { control: 'Gravity', change: 'The fireball at 0 g, or the Earth flame at 1 g. No shape in between is drawn, because no partial-gravity test exists', basis: 'tables' },
]

export function FireballStage({ droplet = null, showEarth = true }: { droplet?: DropletState; showEarth?: boolean }) {
  const { tests } = useData()
  const { scenario } = useScenario()
  const params = useMemo(() => flameParams(scenario, tests), [scenario, tests])
  const [view, setView] = useState<FlameView>('heat')
  const reduced = usePrefersReducedMotion()
  const [near, setNear] = useState(false)
  const [failed, setFailed] = useState(false)
  const [asked, setAsked] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  // The 3D code loads the first time the stage comes on screen. After that the canvas stays
  // mounted and pauses itself whenever it is out of view.
  useEffect(() => {
    const node = stage.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (saveData) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setNear(true)
        observer.disconnect()
      }
    }, { threshold: 0.1 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const showLive = near && !failed && (!reduced || asked)
  const Icon = view === 'heat' ? Camera : Flame
  return (
    <div className="flex flex-col gap-3">
      <div ref={stage} className="relative overflow-hidden rounded-control border border-line" style={{ aspectRatio: '16 / 9', background: STAGE }}>
        <div className="absolute inset-0">
          <FireballPoster params={params} view={view} droplet={droplet} showEarth={showEarth} />
        </div>
        {showLive ? (
          <Suspense fallback={null}>
            <LiveFireball params={params} view={view} droplet={droplet} showEarth={showEarth} onFail={() => setFailed(true)} />
          </Suspense>
        ) : null}
        {showLive ? (
          <>
            {showEarth && params.shape !== 'earth' ? <span className="absolute bottom-2 left-[12%] text-[10px] text-muted">On Earth</span> : null}
            {showEarth ? (
              <span className="absolute bottom-2 text-[10px] text-muted" style={{ left: params.shape !== 'earth' ? '62%' : '46%' }}>
                {params.shape === 'earth' ? 'On Earth, at 1 g' : 'In freefall'}
              </span>
            ) : null}
            <span className="si-mark absolute bottom-2 right-2" title={SI_LABEL} aria-label={SI_LABEL}>
              {SI_MARK}
            </span>
          </>
        ) : null}
        <div className="absolute right-2 top-2 flex gap-1">
          {reduced && !asked && !failed ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsked(true)}>
              <Play size={14} aria-hidden="true" /> Play
            </button>
          ) : null}
          <button type="button" className="stage-btn" onClick={() => setView(view === 'heat' ? 'camera' : 'heat')} aria-pressed={view === 'camera'} aria-label={view === 'heat' ? 'Show it as a camera sees it' : 'Show the heat map'} title={view === 'heat' ? 'As a camera sees it' : 'Heat map'}>
            <Icon size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {view === 'heat' ? <TemperatureScale params={params} /> : null}
      <FireballReadout params={params} />
      {params.gravityBadge ? <p className="text-[12px] text-warn">{params.gravityBadge}</p> : null}
    </div>
  )
}
