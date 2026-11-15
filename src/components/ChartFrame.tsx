// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Sizing, title, description and keyboard handling for every chart.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { arrowNav } from './ui.tsx'

export type FrameSize = { width: number; height: number }

export function ChartFrame({
  title,
  description,
  aspect = 0.6,
  minHeight = 220,
  maxHeight = 640,
  squareOnPhone = false,
  toolbar,
  children,
  footer,
}: {
  title: string
  description: string
  aspect?: number
  minHeight?: number
  maxHeight?: number
  squareOnPhone?: boolean
  toolbar?: ReactNode
  children: (size: FrameSize) => ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const ratio = squareOnPhone && width < 520 ? 1 : aspect
  const height = Math.round(Math.max(minHeight, Math.min(maxHeight, width * ratio)))
  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-[16px] font-semibold">{title}</span>
        {toolbar}
      </figcaption>
      <div
        ref={ref}
        role="group"
        aria-roledescription="chart"
        aria-label={`${description} Use the arrow keys to move between marks and Enter to open the rows behind one.`}
        tabIndex={0}
        onKeyDown={arrowNav}
        className="relative w-full rounded-control"
        style={{ height }}
      >
        {children({ width, height })}
      </div>
      <p className="sr-only">{description}</p>
      {footer}
    </figure>
  )
}

export function LegendItem({ children, swatch }: { children: ReactNode; swatch: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      {swatch}
      {children}
    </span>
  )
}
