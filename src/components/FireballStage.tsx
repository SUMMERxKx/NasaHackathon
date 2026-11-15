// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The fireball's stage: the poster or the live view, the temperature scale, the view switch,
// the readout of sourced numbers and the visible SI label. Nothing is conveyed by the canvas alone.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { formatNumber, formatPercent } from '../lib/units.ts'
import { useData } from '../state/data.tsx'
import { useScenario } from '../state/hooks.ts'
import { GATES, flameParams } from '../three/flameParams.ts'
import type { FlameParams } from '../three/flameParams.ts'
import { CAMERA, SCALE, SCALE_NOTE, SI_LABEL, kelvinToT, rampCss, rampGradient } from '../three/ramp.ts'
import { Segmented, SourcedNumber, useCountUp, usePrefersReducedMotion } from './ui.tsx'

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
      <g transform="translate(8,214)">
        <rect width="150" height="20" rx="5" fill="var(--label-bg)" stroke="var(--line)" />
        <text x="8" y="14" fontSize="11" fontWeight="600" fill="var(--label-ink)">
          {SI_LABEL}
        </text>
      </g>
    </svg>
  )
}

// The scale is plain HTML beside the canvas, with two labelled ends from NASA's guide.
export function TemperatureScale({ params }: { params: FlameParams }) {
  const flameAt = kelvinToT(SCALE.flameK) * 100
  const markAt = params.tempTopKelvin != null && GATES.tadConfirmed ? kelvinToT(params.tempTopKelvin) * 100 : null
  return (
    <div className="flex h-full min-h-[180px] gap-2" aria-label="Temperature scale in kelvin">
      <div className="relative w-3 rounded-full border border-line" style={{ background: rampGradient('to top') }} data-ramp={rampGradient('to top')}>
        <span className="absolute -right-1 h-px w-5 bg-ink" style={{ bottom: `${flameAt}%` }} aria-hidden="true" />
        <span className="absolute -right-1 bottom-0 h-px w-5 bg-ink" aria-hidden="true" />
        {markAt != null ? <span className="absolute -left-1.5 h-0.5 w-6 bg-freefall" style={{ bottom: `${markAt}%`, transition: 'bottom var(--t-scene) var(--ease-out)' }} aria-hidden="true" /> : null}
      </div>
      <div className="relative w-[112px] text-[11px] leading-tight text-muted">
        <span className="absolute left-0 -translate-y-1/2" style={{ top: `${100 - flameAt}%` }}>
          <span className="num block text-ink">about 2,300 K</span>a typical flame
        </span>
        <span className="absolute bottom-0 left-0">
          <span className="num block text-ink">about 300 K</span>cabin air
        </span>
      </div>
    </div>
  )
}

const BASIS = {
  tables: 'From the NASA tables',
  direction: 'Direction from a NASA source',
  definition: 'By definition',
}

// Three lines, each a sourced number that drills through to its rows.
export function FireballReadout({ params }: { params: FlameParams }) {
  const { scenario } = useScenario()
  const look = params.lookup
  const rate = useCountUp(look.burningRate.value ?? 0, 400)
  const temp = useCountUp(look.flameTemperature.value ?? 0, 400)
  const o2 = formatPercent(scenario.o2)
  if (params.ghost) {
    return (
      <div className="flex flex-col gap-2 text-[14px]">
        <p>
          <strong>No droplet test within range of this atmosphere.</strong>{' '}
          {params.nearestText ? (
            <>
              The nearest ran at{' '}
              <SourcedNumber path={[{ kind: 'fireball', readout: 'nearest' }]} label={`The nearest droplet test ran at ${params.nearestText}`}>
                {params.nearestText}
              </SourcedNumber>
              .
            </>
          ) : null}
        </p>
        <p className="text-[13px] text-muted">So the fireball is drawn as a ghost: an outline with no heat map. That gap is the finding.</p>
      </div>
    )
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px]">
      <li>
        {look.burningRate.tests.length > 0 ? (
          <>
            Burning rate near {o2} oxygen:{' '}
            <SourcedNumber path={[{ kind: 'fireball', readout: 'burningRate' }]} label={`Burning rate ${formatNumber(look.burningRate.value ?? 0, 3)}, the median of ${look.burningRate.tests.length} FLEX tests`}>
              {formatNumber(rate, 3)}
            </SourcedNumber>
            , the median of <span className="num">{look.burningRate.tests.length}</span> FLEX tests.
          </>
        ) : (
          <>
            Burning rate: no nitrogen-diluted FLEX test within 3 points of {o2} oxygen.{' '}
            {look.burningRate.value != null ? (
              <>
                The fireball uses <span className="num">{formatNumber(look.burningRate.value, 2)}</span>, between tested levels.
              </>
            ) : null}
          </>
        )}
      </li>
      <li>
        Ended in extinction:{' '}
        <SourcedNumber path={[{ kind: 'fireball', readout: 'outcomes' }]} label={`${look.extinction.ended.length} of ${look.extinction.of.length} nearby FLEX tests ended in extinction`}>
          {look.extinction.ended.length} of {look.extinction.of.length}
        </SourcedNumber>{' '}
        nearby FLEX tests.
      </li>
      <li>
        Listed flame temperature for gas flames near this oxygen:{' '}
        {look.flameTemperature.value != null ? (
          <>
            <SourcedNumber path={[{ kind: 'fireball', readout: 'flameTemperature' }]} label={`Listed flame temperature ${Math.round(look.flameTemperature.value)} kelvin, the median of ${look.flameTemperature.tests.length} ACME tests`}>
              {Math.round(temp).toLocaleString('en-US')} K
            </SourcedNumber>
            , the median of <span className="num">{look.flameTemperature.tests.length}</span> ACME tests.
          </>
        ) : (
          'none listed.'
        )}
      </li>
      <li className="text-[13px] text-muted">
        <SourcedNumber path={[{ kind: 'fireball', readout: 'nearest' }]} label={`${look.dropletsInRange.length} droplet tests within one unit of this atmosphere`}>
          {look.dropletsInRange.length}
        </SourcedNumber>{' '}
        droplet {look.dropletsInRange.length === 1 ? 'test' : 'tests'} within range of this atmosphere. Fewer than ten and the fireball fades.
      </li>
    </ul>
  )
}

const DRIVERS: { control: string; change: string; basis: keyof typeof BASIS }[] = [
  { control: 'Oxygen', change: 'How fast it seethes, from the median FLEX burning rate near this oxygen', basis: 'tables' },
  { control: 'Oxygen', change: 'How hot the brightest part is, from the listed flame temperature of ACME gas flames. A calculated upper temperature', basis: 'tables' },
  { control: 'Oxygen', change: 'Whether it holds, struggles or goes out, from the share of nearby FLEX tests that ended in extinction', basis: 'tables' },
  { control: 'Oxygen', change: 'In the camera view, how blue or how yellow it is. NASA\'s guide says a flame stays bluer longer at lower oxygen', basis: 'direction' },
  { control: 'Oxygen and pressure', change: 'Whether it is solid or a ghost, from the count of droplet tests within one unit of the habitat', basis: 'tables' },
  { control: 'Pressure', change: 'How dense the haze of gas around it is', basis: 'definition' },
  { control: 'Ventilation flow', change: 'Tracer points drifting past, and a lean downwind. NASA\'s guide says ventilation flow strongly enhances flames', basis: 'direction' },
  { control: 'Gravity', change: 'The fireball at 0 g, or the Earth flame at 1 g. No shape in between is drawn, because no partial-gravity test exists', basis: 'tables' },
]

export function FireballStage({ droplet = null, compact = false, showEarth = true }: { droplet?: DropletState; compact?: boolean; showEarth?: boolean }) {
  const { tests } = useData()
  const { scenario } = useScenario()
  const params = useMemo(() => flameParams(scenario, tests), [scenario, tests])
  const [view, setView] = useState<FlameView>('heat')
  const reduced = usePrefersReducedMotion()
  const [live, setLive] = useState(false)
  const [failed, setFailed] = useState(false)
  const [asked, setAsked] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  // The 3D code loads only when the fireball is on screen. One canvas at a time.
  useEffect(() => {
    const node = stage.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    const observer = new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting
      setLive(visible && !saveData)
    }, { threshold: 0.2 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const showLive = live && !failed && (!reduced || asked)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-3">
        <div ref={stage} className="relative min-w-0 flex-1 overflow-hidden rounded-card border border-line" style={{ aspectRatio: '3 / 2', maxHeight: compact ? 280 : 360, background: CAMERA.deep }}>
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
              <span className="si-label absolute bottom-2 left-2">{SI_LABEL}</span>
              {showEarth && params.shape !== 'earth' ? <span className="absolute bottom-9 left-[12%] text-[11px] text-muted">On Earth</span> : null}
              {showEarth ? (
                <span className="absolute bottom-3 text-[11px] text-muted" style={{ left: params.shape !== 'earth' ? '62%' : '46%' }}>
                  {params.shape === 'earth' ? 'On Earth, at 1 g' : 'In freefall'}
                </span>
              ) : null}
            </>
          ) : null}
          {reduced && !asked && !failed ? (
            <button type="button" className="btn btn-secondary btn-sm absolute right-2 top-2" onClick={() => setAsked(true)}>
              <Play size={14} aria-hidden="true" /> Play
            </button>
          ) : null}
        </div>
        <TemperatureScale params={params} />
      </div>
      {params.gravityBadge ? <p className="chip chip-warn self-start whitespace-normal py-1">{params.gravityBadge}</p> : null}
      <p className="text-[12px] text-muted">
        {SCALE_NOTE}{' '}
        <a href="https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/" target="_blank" rel="noreferrer">
          Source, page 8
        </a>
        .
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Fireball view" value={view} onChange={setView} options={[{ value: 'heat', label: 'Heat map' }, { value: 'camera', label: 'As a camera sees it' }]} />
        <span className="chip chip-ok">{BASIS.tables}</span>
      </div>
      <FireballReadout params={params} />
      <p className="text-[13px] text-muted">Pressure changes which tests are near. EMBER draws no pressure effect that the tables do not show.</p>
      {!compact ? (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold">What drives the fireball</summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {DRIVERS.map((d) => (
              <li key={d.change} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
                <span className="font-semibold">{d.control}</span>
                <span className="text-muted">{d.change}.</span>
                <span className="text-[11px] uppercase tracking-wide text-faint">{BASIS[d.basis]}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
