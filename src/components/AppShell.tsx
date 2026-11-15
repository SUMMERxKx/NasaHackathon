// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The shell every screen behind the hero shares: a top bar with the wordmark, the navbar and
// the habitat picker, then the chat launcher and the drill panel.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { FlaskConical, Info, LayoutDashboard, List } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { NavBar } from '@/components/ui/tubelight-navbar.tsx'
import type { NavItem } from '@/components/ui/tubelight-navbar.tsx'
import { DataGate } from '../state/data.tsx'
import { pageName } from '../routes.tsx'
import { ChatLauncher } from './chat/ChatLauncher.tsx'
import { DrillPanel } from './DrillPanel.tsx'
import { HabitatPicker } from './Habitat.tsx'
import { ScenarioLink, Skeleton } from './ui.tsx'
import { StoryStepper } from '../story/Story.tsx'

const NAV: NavItem[] = [
  { name: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { name: 'Investigations', url: '/investigations', icon: List },
  { name: 'Lab', url: '/lab', icon: FlaskConical },
  { name: 'About', url: '/about', icon: Info },
]

// The screens that change with the habitat carry the habitat picker.
const HABITAT_SCREENS = /^\/(dashboard|investigations|lab)\/?$|^\/lab\//

function Wordmark() {
  return (
    <ScenarioLink to="/" className="flex items-center gap-2 text-ink no-underline hover:no-underline" aria-label="EMBER, the start page">
      <span className="inline-block h-2.5 w-2.5 bg-ember" style={{ boxShadow: '0 0 10px var(--ember)' }} aria-hidden="true" />
      <span className="font-display text-[18px] font-bold tracking-[0.14em]">EMBER</span>
    </ScenarioLink>
  )
}

function ShellBody() {
  const location = useLocation()
  const [params] = useSearchParams()
  const name = pageName(location.pathname)
  const first = useRef(true)
  const [announce, setAnnounce] = useState('')
  const inStory = params.has('story')
  // On every route change, focus moves to the page heading and the page title is announced.
  useEffect(() => {
    document.title = `${name} · EMBER`
    if (first.current) {
      first.current = false
      return
    }
    setAnnounce(name)
    const heading = document.getElementById('page-title')
    heading?.focus({ preventScroll: true })
  }, [location.pathname, name])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to the content
      </a>
      {/* The habitat drives the whole dashboard, so its picker sits in the top bar, at the right end. */}
      <header className="top-bar no-print">
        <div className="top-bar-row">
          <Wordmark />
          <NavBar items={NAV} />
          {HABITAT_SCREENS.test(location.pathname) && !inStory ? <HabitatPicker /> : <span aria-hidden="true" />}
        </div>
      </header>
      <main id="main" className="flex-1 pt-4">
        <Outlet />
      </main>
      <footer className="mt-6 border-t border-line bg-[var(--bar)] px-4 pb-24 pt-4 text-center text-[12px] text-faint sm:pb-4">
        Built with NASA open data from the PSI repository. <ScenarioLink to="/about">About EMBER</ScenarioLink>
      </footer>
      <ChatLauncher />
      <DrillPanel pageName={name} />
      <StoryStepper />
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <MotionConfig reducedMotion="user">
      <DataGate skeleton={<BootSkeleton />}>
        <ShellBody />
      </DataGate>
    </MotionConfig>
  )
}

export default AppShell

export function BootSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading the NASA snapshot">
      <Skeleton className="mb-6 mt-16 h-10 w-48" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[420px] w-full lg:col-span-8" />
        <Skeleton className="h-[420px] w-full lg:col-span-4" />
      </div>
    </div>
  )
}

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="min-w-0">
        <h1 id="page-title" tabIndex={-1} className="text-[26px] outline-none md:text-[32px]">
          {title}
        </h1>
        {lead ? <p className="mt-1 text-[14px] text-muted">{lead}</p> : null}
      </div>
      {children}
    </header>
  )
}
