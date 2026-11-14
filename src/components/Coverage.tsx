// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The coverage dial and the pillar bars. A single amber glow always means evidence.
import { useId } from 'react'
import type { CoverageResult, Pillar } from '../types.ts'
import { PILLARS } from '../lib/coverage.ts'
import { formatNumber } from '../lib/units.ts'
import { NotASafetyRating, useCountUp, useDrillDescribed, useDrillProps } from './ui.tsx'

const START = 135
const SWEEP = 270

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  const large = to - from > 180 ? 1 : 0
  return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
}

export const PILLAR_LABEL: Record<Pillar, string> = { prevention: 'Prevention', detection: 'Detection', suppression: 'Suppression' }

// A 270 degree arc. Solid for evidence read from tables, hatched for the share that rests on an assumed value.
export function CoverageDial({
  coverage,
  size = 240,
  interactive = true,
  label,
}: {
  coverage: CoverageResult
  size?: 72 | 120 | 160 | 240
  interactive?: boolean
  label: string
}) {
  const id = useId().replace(/:/g, '')
  const props = useDrillProps()
  const described = useDrillDescribed()
  const score = Math.max(0, Math.min(100, coverage.overall))
  const shown = useCountUp(score)
  const stroke = size >= 160 ? 14 : size >= 120 ? 10 : 7
  const r = size / 2 - stroke / 2 - (size >= 160 ? 10 : 3)
  const c = size / 2
  const length = (SWEEP / 360) * 2 * Math.PI * r
  const solid = (score / 100) * (1 - coverage.assumedShare) * length
  const total = (score / 100) * length
  const glow = Math.round((score / 100) * (size >= 160 ? 22 : 8))
  const big = size >= 160
  const track = arc(c, c, r, START, START + SWEEP)
  const ringR = r - stroke - 4
  const drill = interactive ? described([{ kind: 'coverage', pillar: 'overall' }], `${label}: Evidence Coverage ${Math.round(score)} out of 100. Not a safety rating. Press Enter for the tests behind it.`) : null
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden={interactive ? undefined : true} role={interactive ? 'group' : undefined} aria-label={interactive ? `${label} coverage dial` : undefined}>
        <defs>
          <pattern id={`hatch-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--ember)" opacity="0.25" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ember)" strokeWidth="2.4" />
          </pattern>
        </defs>
        <path d={track} fill="none" stroke="var(--line)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={track}
          fill="none"
          stroke={`url(#hatch-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${total} ${length * 2}`}
          style={{ transition: 'stroke-dasharray var(--t-scene) var(--ease-out)' }}
        />
        <path
          d={track}
          fill="none"
          stroke="var(--ember)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${solid} ${length * 2}`}
          style={{
            transition: 'stroke-dasharray var(--t-scene) var(--ease-out), filter var(--t-scene) var(--ease-out)',
            filter: `drop-shadow(0 0 calc(${glow}px * var(--glow-strength)) var(--ember))`,
            opacity: solid < 0.5 ? 0 : 1,
          }}
        />
        {big && interactive
          ? PILLARS.map((pillar, i) => {
              const from = START + i * (SWEEP / 3) + 3
              const to = START + (i + 1) * (SWEEP / 3) - 3
              const p = coverage.byPillar[pillar]
              const seg = arc(c, c, ringR, from, to)
              const segLength = ((to - from) / 360) * 2 * Math.PI * ringR
              return (
                <g
                  key={pillar}
                  className="drillable"
                  tabIndex={-1}
                  data-nav=""
                  {...props([{ kind: 'coverage', pillar }], `${PILLAR_LABEL[pillar]} coverage ${Math.round(p.score)} out of 100, from ${formatNumber(p.effectiveTests, 1)} effective tests. Press Enter for the tests behind it.`)}
                >
                  <path d={seg} fill="none" stroke="transparent" strokeWidth={16} />
                  <path d={seg} fill="none" stroke="var(--line)" strokeWidth={4} strokeLinecap="round" />
                  <path
                    d={seg}
                    fill="none"
                    stroke="var(--ember)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={`${(p.score / 100) * segLength} ${segLength * 2}`}
                    opacity={p.score < 0.5 ? 0 : 0.85}
                    style={{ transition: 'stroke-dasharray var(--t-scene) var(--ease-out)' }}
                  />
                </g>
              )
            })
          : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {interactive && drill ? (
          <button type="button" className="sourced pointer-events-auto leading-none" style={{ fontSize: big ? (size >= 240 ? 72 : 48) : size >= 120 ? 32 : 20 }} {...drill} role={undefined}>
            {Math.round(shown)}
          </button>
        ) : (
          <span className="num leading-none" style={{ fontSize: big ? 48 : size >= 120 ? 32 : 20 }}>
            {Math.round(shown)}
          </span>
        )}
        {big ? <span className="mt-1 text-[12px] text-muted">out of 100</span> : null}
      </div>
    </div>
  )
}

export function AssumedShare({ coverage }: { coverage: CoverageResult }) {
  const pct = Math.round(coverage.assumedShare * 100)
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted">
      <svg width="22" height="10" aria-hidden="true">
        <defs>
          <pattern id="hatch-key" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--ember)" opacity="0.25" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ember)" strokeWidth="2.4" />
          </pattern>
        </defs>
        <rect width="22" height="10" rx="3" fill="url(#hatch-key)" />
      </svg>
      <span>
        <span className="num text-ink">{pct}%</span> of this score rests on an assumed value. Hatching shows that share.
      </span>
    </p>
  )
}

export function PillarBars({ coverage, focus, onFocus }: { coverage: CoverageResult; focus: Pillar | null; onFocus?: (pillar: Pillar | null) => void }) {
  const props = useDrillDescribed()
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {PILLARS.map((pillar) => {
        const p = coverage.byPillar[pillar]
        const solid = p.score * (1 - p.assumedShare)
        return (
          <li key={pillar} className="flex items-center gap-2">
            <div
              className="drillable min-w-0 flex-1 rounded-control px-1 py-1 transition-colors hover:bg-surface-2"
              tabIndex={0}
              {...props([{ kind: 'coverage', pillar }], `${PILLAR_LABEL[pillar]} coverage ${Math.round(p.score)} out of 100, from ${formatNumber(p.effectiveTests, 1)} effective tests. Press Enter for the tests behind it.`)}
            >
              <div className="flex items-baseline justify-between gap-2 text-[14px]">
                <span className="font-semibold">{PILLAR_LABEL[pillar]}</span>
                <span className="text-[12px] text-muted">
                  <span className="num text-[14px] text-ink">{Math.round(p.score)}</span> from <span className="num text-ink">{formatNumber(p.effectiveTests, 1)}</span> effective tests
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${p.score}%`, background: 'repeating-linear-gradient(45deg, var(--ember) 0 2px, color-mix(in srgb, var(--ember) 30%, transparent) 2px 5px)', transition: 'width var(--t-scene) var(--ease-out)' }}
                />
                <div className="absolute inset-y-0 left-0 rounded-full bg-ember" style={{ width: `${solid}%`, transition: 'width var(--t-scene) var(--ease-out)' }} />
              </div>
            </div>
            {onFocus ? (
              <button
                type="button"
                className="chip shrink-0"
                aria-pressed={focus === pillar}
                onClick={() => onFocus(focus === pillar ? null : pillar)}
                title="Rank investigations with this pillar in focus"
              >
                Focus
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function CoveragePanel({ coverage, name, focus, onFocus }: { coverage: CoverageResult; name: string; focus: Pillar | null; onFocus?: (pillar: Pillar | null) => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <CoverageDial coverage={coverage} size={240} label={name} />
      <div className="text-center">
        <p className="font-display text-[18px] font-semibold">Evidence Coverage</p>
        <NotASafetyRating className="mt-1" />
      </div>
      <div className="w-full">
        <PillarBars coverage={coverage} focus={focus} onFocus={onFocus} />
      </div>
      <AssumedShare coverage={coverage} />
      <p className="text-[13px] text-muted">The score counts real NASA flight tests near this atmosphere. It says how much is known, not how safe a habitat is.</p>
    </div>
  )
}
