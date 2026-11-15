// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import HalftoneNebula, { NEBULA_QUIET } from '@/components/ui/halftone-nebula.tsx'
import { withChunkReload } from './lib/chunkReload.ts'
import { DataProvider } from './state/data.tsx'
import { Skeleton } from './components/ui.tsx'
import { makeRoutes } from './routes.tsx'
import Hero from './screens/Hero.tsx'

// Every screen behind the hero is its own chunk, loaded when its route is first opened. A chunk
// left stale by a deploy reloads the page once before the error screen is shown.
function onDemand(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Lazy = lazy(withChunkReload(load))
  return function OnDemand() {
    return (
      <Suspense fallback={<div className="page"><Skeleton className="h-64 w-full" /></div>}>
        <Lazy />
      </Suspense>
    )
  }
}

// The shell behind the hero is a chunk of its own too, so the hero ships with very little code.
const loadShell = () => import('./components/AppShell.tsx')
const Shell = onDemand(loadShell)
const loadDashboard = () => import('./screens/Dashboard.tsx')
const Dashboard = onDemand(loadDashboard)
const Investigations = onDemand(() => import('./screens/Investigations.tsx'))
const InvestigationDetail = onDemand(() => import('./screens/InvestigationDetail.tsx'))
const Compare = onDemand(() => import('./screens/Compare.tsx'))
const Lab = onDemand(() => import('./screens/Lab.tsx'))
const About = onDemand(() => import('./screens/About.tsx'))

// Only the hero answers a click on the sky. On every other screen a click is the page's alone.
export const skyClicksAt = (pathname: string): boolean => pathname === '/'

export function App() {
  const router = useMemo(() => createBrowserRouter(makeRoutes({ Shell, Hero, Dashboard, Investigations, InvestigationDetail, Compare, Lab, About })), [])
  // The dashboard is the next click from the hero, so its code is fetched while the hero is read.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const warm = () => void Promise.all([loadShell(), loadDashboard()]).catch(() => {})
    const timer = idle ? idle(warm) : window.setTimeout(warm, 1200)
    return () => {
      if (!idle) window.clearTimeout(timer)
    }
  }, [])
  // One sky sits behind every screen, on one canvas that is never rebuilt. The hero shows it
  // in full and follows the display. Every other screen shows it quieter and at most 30 times
  // a second, so it leaves the frame budget to the map and to the fireball's own canvas. Only the
  // hero listens for clicks on it. Every other screen keeps the hover and has no click effect.
  const [onHero, setOnHero] = useState(() => skyClicksAt(router.state.location.pathname))
  useEffect(() => router.subscribe((state) => setOnHero(skyClicksAt(state.location.pathname))), [router])
  return (
    <DataProvider>
      <HalftoneNebula backdrop maxDpr={1} params={onHero ? undefined : NEBULA_QUIET} maxFps={onHero ? undefined : 30} sparkOnClick={onHero} />
      <RouterProvider router={router} />
    </DataProvider>
  )
}
