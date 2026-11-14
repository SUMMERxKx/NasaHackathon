// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { lazy, Suspense, useMemo } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { DataProvider } from './state/data.tsx'
import { BootSkeleton } from './components/AppShell.tsx'
import { Skeleton } from './components/ui.tsx'
import { makeRoutes } from './routes.tsx'
import Brief from './screens/Brief.tsx'
import MapScreen from './screens/MapScreen.tsx'
import Investigations from './screens/Investigations.tsx'
import InvestigationDetail from './screens/InvestigationDetail.tsx'
import Ask from './screens/Ask.tsx'
import Methods from './screens/Methods.tsx'

// Loaded on demand: the Lab, Compare and Earth screens.
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

const Compare = onDemand(() => import('./screens/Compare.tsx'))
const Lab = onDemand(() => import('./screens/Lab.tsx'))
const Earth = onDemand(() => import('./screens/Earth.tsx'))

export function App() {
  const router = useMemo(
    () => createBrowserRouter(makeRoutes({ Brief, MapScreen, Investigations, InvestigationDetail, Ask, Methods, Compare, Lab, Earth })),
    [],
  )
  return (
    <MotionConfig reducedMotion="user">
      <DataProvider skeleton={<BootSkeleton />}>
        <RouterProvider router={router} />
      </DataProvider>
    </MotionConfig>
  )
}
