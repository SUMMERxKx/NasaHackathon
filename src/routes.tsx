// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Clean paths through the browser data router. Every route has its own fallback.
import type { ComponentType } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell, RouteError } from './components/AppShell.tsx'

export type ScreenSet = {
  Hero: ComponentType
  Dashboard: ComponentType
  Investigations: ComponentType
  InvestigationDetail: ComponentType
  Compare: ComponentType
  Lab: ComponentType
  About: ComponentType
}

export const PAGE_NAMES: { test: RegExp; name: string }[] = [
  { test: /^\/$/, name: 'EMBER' },
  { test: /^\/dashboard/, name: 'Dashboard' },
  { test: /^\/investigations\/compare/, name: 'Compare' },
  { test: /^\/investigations\/.+/, name: 'Investigation' },
  { test: /^\/investigations/, name: 'Investigations' },
  { test: /^\/lab/, name: 'Lab' },
  { test: /^\/about/, name: 'About' },
]

export const pageName = (pathname: string): string => PAGE_NAMES.find((p) => p.test.test(pathname))?.name ?? 'EMBER'

// Old addresses keep working. Each one lands on the screen that now holds its content,
// and the habitat and any open drill panel come along.
export function movedTo(to: string, params: URLSearchParams, rename: Record<string, string> = {}, set: Record<string, string> = {}): string {
  const next = new URLSearchParams()
  params.forEach((value, key) => next.set(rename[key] ?? key, value))
  for (const [key, value] of Object.entries(set)) if (!next.has(key)) next.set(key, value)
  const query = next.toString()
  return `${to}${query ? `?${query}` : ''}`
}

function Moved({ to, rename, set }: { to: string; rename?: Record<string, string>; set?: Record<string, string> }) {
  const [params] = useSearchParams()
  return <Navigate to={movedTo(to, params, rename, set)} replace />
}

export function makeRoutes(s: ScreenSet): RouteObject[] {
  const screen = (Component: ComponentType): Pick<RouteObject, 'element' | 'errorElement'> => ({
    element: <Component />,
    errorElement: <RouteError />,
  })
  return [
    { path: '/', element: <s.Hero />, errorElement: <RouteError standalone /> },
    {
      element: <AppShell />,
      errorElement: <RouteError standalone />,
      children: [
        { path: 'dashboard', ...screen(s.Dashboard) },
        { path: 'investigations', ...screen(s.Investigations) },
        { path: 'investigations/:accession', ...screen(s.InvestigationDetail) },
        { path: 'investigations/compare', ...screen(s.Compare) },
        { path: 'lab', ...screen(s.Lab) },
        { path: 'lab/:tool', ...screen(s.Lab) },
        { path: 'about', ...screen(s.About) },
        { path: 'compare', element: <Moved to="/investigations/compare" /> },
        { path: 'map', element: <Moved to="/dashboard" /> },
        { path: 'ask', element: <Moved to="/dashboard" rename={{ q: 'ask' }} set={{ chat: '1' }} /> },
        { path: 'earth', element: <Moved to="/about" set={{ section: 'earth' }} /> },
        { path: 'methods', element: <Moved to="/about" set={{ section: 'methods' }} /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ]
}
