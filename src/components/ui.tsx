// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The base component set. Built once and used on every screen.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { DrillPath } from '../types.ts'
import { encodeDrill } from '../lib/drill.ts'
import { scenarioQuery } from '../state/scenario.ts'
import { useDrill } from '../state/hooks.ts'

export function Chip({
  children,
  pressed,
  onClick,
  tone,
  title,
}: {
  children: ReactNode
  pressed?: boolean
  onClick?: () => void
  tone?: 'source' | 'gap' | 'ok' | 'warn'
  title?: string
}) {
  const cls = `chip ${tone ? `chip-${tone}` : ''}`
  if (!onClick) return <span className={cls} title={title}>{children}</span>
  return (
    <button type="button" className={cls} aria-pressed={pressed} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

// A link that keeps the habitat on every internal link and drops the screen-level parameters.
export function ScenarioLink({ to, children, extra, ...rest }: Omit<LinkProps, 'to'> & { to: string; extra?: Record<string, string> }) {
  const [params] = useSearchParams()
  const [path, hash] = to.split('#')
  const [base, own] = path.split('?')
  const query = new URLSearchParams(scenarioQuery(params))
  if (own) new URLSearchParams(own).forEach((value, key) => query.set(key, value))
  if (extra) for (const [key, value] of Object.entries(extra)) query.set(key, value)
  const text = query.toString()
  return (
    <Link to={`${base}${text ? `?${text}` : ''}${hash ? `#${hash}` : ''}`} {...rest}>
      {children}
    </Link>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 whitespace-nowrap px-3 text-[13px] font-semibold transition-colors ${
            o.value === value ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  display: string
}) {
  const id = `slider-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="num text-[14px]">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function VerifiedMark({ level }: { level: 'snapshot' | 'snapshot and raw files' }) {
  const twice = level === 'snapshot and raw files'
  return (
    <span className="chip chip-ok" title={twice ? 'Recomputed from the snapshot and again from the raw NASA files' : 'Recomputed from the snapshot'}>
      <Check size={12} aria-hidden="true" />
      {twice ? 'Verified twice' : 'Verified'}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <p className="font-display text-[18px] font-semibold">{title}</p>
      {children ? <p className="mt-2 text-[14px] text-muted">{children}</p> : null}
    </div>
  )
}

export function NotASafetyRating({ className = '' }: { className?: string }) {
  return <p className={`text-[12px] font-semibold uppercase tracking-wide text-muted ${className}`}>Not a safety rating</p>
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Counts a number toward its new value, for the dial and the readouts.
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame === 'undefined') {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - (1 - t) ** 3
      const current = begin + (target - begin) * eased
      from.current = current
      setValue(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms, reduced])
  return value
}

// A number that counts toward its new value. Only this text node redraws while it counts.
export function CountUp({ value, format, ms = 600 }: { value: number; format: (value: number) => string; ms?: number }) {
  return <>{format(useCountUp(value, ms))}</>
}

// Every chart mark and every sourced number is made clickable through this one helper.
export function drillProps(path: DrillPath, label: string, open: (path: DrillPath) => void) {
  return {
    role: 'button' as const,
    'aria-label': label,
    'data-drill': encodeDrill(path),
    onClick: () => open(path),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open(path)
      }
    },
  }
}

export function useDrillProps() {
  const { open } = useDrill()
  return (path: DrillPath, label: string) => drillProps(path, label, open)
}

// For a control whose visible text is already its name. The extra words become its description.
export function useDrillDescribed() {
  const { open } = useDrill()
  return (path: DrillPath, description: string) => {
    const { 'aria-label': _label, ...rest } = drillProps(path, description, open)
    return { ...rest, 'aria-description': description, title: description }
  }
}

// A number from NASA data. One click opens the rows it came from.
export function SourcedNumber({ path, label, children, className = '' }: { path: DrillPath; label: string; children: ReactNode; className?: string }) {
  const props = useDrillDescribed()(path, `${label.replace(/\.$/, '')}. Press Enter for its rows.`)
  return (
    <button type="button" className={`sourced ${className}`} {...props} role={undefined}>
      {children}
    </button>
  )
}

// Arrow keys move between the marks of a chart. Enter or Space opens the drill on the mark itself.
export function arrowNav(event: KeyboardEvent<HTMLElement | SVGElement>) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement | SVGElement>('[data-nav]'))
  if (stops.length === 0) return
  event.preventDefault()
  const index = stops.indexOf(document.activeElement as HTMLElement)
  let next = index
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = stops.length - 1
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index < 0 ? 0 : Math.min(stops.length - 1, index + 1)
  else next = index < 0 ? stops.length - 1 : Math.max(0, index - 1)
  stops[next].focus()
}
