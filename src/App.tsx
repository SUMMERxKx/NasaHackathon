// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { lazy, Suspense, useEffect, useMemo } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { DataProvider } from './state/data.tsx'
import { Skeleton } from './components/ui.tsx'
import { makeRoutes } from './routes.tsx'
import Hero from './screens/Hero.tsx'

// Every screen behind the hero is its own chunk, loaded when its route is first opened.
function onDemand(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Lazy = lazy(load)
  return function OnDemand() {
    return (
      <Suspense fallback={<div className="page"><Skeleton className="h-64 w-full" /></div>}>
        <Lazy />
      </Suspense>
    )
  }
}

const loadDashboard = () => import('./screens/Dashboard.tsx')
const Dashboard = onDemand(loadDashboard)
const Investigations = onDemand(() => import('./screens/Investigations.tsx'))
const InvestigationDetail = onDemand(() => import('./screens/InvestigationDetail.tsx'))
const Compare = onDemand(() => import('./screens/Compare.tsx'))
const Lab = onDemand(() => import('./screens/Lab.tsx'))
const About = onDemand(() => import('./screens/About.tsx'))

export function App() {
  const router = useMemo(() => createBrowserRouter(makeRoutes({ Hero, Dashboard, Investigations, InvestigationDetail, Compare, Lab, About })), [])
  // The dashboard is the next click from the hero, so its code is fetched while the hero is read.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const warm = () => void loadDashboard().catch(() => {})
    const timer = idle ? idle(warm) : window.setTimeout(warm, 1200)
    return () => {
      if (!idle) window.clearTimeout(timer)
    }
  }, [])
  return (
    <MotionConfig reducedMotion="user">
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </MotionConfig>
  )
}
