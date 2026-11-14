// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Clean paths through the browser data router. Every route has its own fallback.
import type { ComponentType } from 'react'
import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell, RouteError } from './components/AppShell.tsx'

export type ScreenSet = {
  Brief: ComponentType
  MapScreen: ComponentType
  Investigations: ComponentType
  InvestigationDetail: ComponentType
  Ask: ComponentType
  Methods: ComponentType
  Compare: ComponentType
  Lab: ComponentType
  Earth: ComponentType
}

export const PAGE_NAMES: { test: RegExp; name: string }[] = [
  { test: /^\/$/, name: 'Brief' },
  { test: /^\/map/, name: 'Atmosphere Map' },
  { test: /^\/investigations\/.+/, name: 'Investigation' },
  { test: /^\/investigations/, name: 'Investigations' },
  { test: /^\/compare/, name: 'Compare' },
  { test: /^\/lab/, name: 'Lab' },
  { test: /^\/ask/, name: 'Ask' },
  { test: /^\/earth/, name: 'Earth' },
  { test: /^\/methods/, name: 'Methods and about' },
]

export const pageName = (pathname: string): string => PAGE_NAMES.find((p) => p.test.test(pathname))?.name ?? 'EMBER'

export function makeRoutes(s: ScreenSet): RouteObject[] {
  const screen = (Component: ComponentType): Pick<RouteObject, 'element' | 'errorElement'> => ({
    element: <Component />,
    errorElement: <RouteError />,
  })
  return [
    {
      path: '/',
      element: <AppShell />,
      errorElement: <RouteError standalone />,
      children: [
        { index: true, ...screen(s.Brief) },
        { path: 'map', ...screen(s.MapScreen) },
        { path: 'investigations', ...screen(s.Investigations) },
        { path: 'investigations/:accession', ...screen(s.InvestigationDetail) },
        { path: 'compare', ...screen(s.Compare) },
        { path: 'lab', ...screen(s.Lab) },
        { path: 'lab/:tool', ...screen(s.Lab) },
        { path: 'ask', ...screen(s.Ask) },
        { path: 'earth', ...screen(s.Earth) },
        { path: 'methods', ...screen(s.Methods) },
        { path: 'about', element: <Navigate to="/methods?section=si" replace /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ]
}
