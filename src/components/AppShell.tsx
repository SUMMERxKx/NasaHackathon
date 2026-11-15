// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The shell every screen behind the hero shares: the wordmark, the navbar, the habitat dropdown,
// the chat launcher and the drill panel.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useRouteError, useSearchParams } from 'react-router-dom'
import { FlaskConical, Info, LayoutDashboard, List } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar.tsx'
import type { NavItem } from '@/components/ui/tubelight-navbar.tsx'
import { DataGate } from '../state/data.tsx'
import { pageName } from '../routes.tsx'
import { ChatLauncher } from './chat/ChatLauncher.tsx'
import { DrillPanel } from './DrillPanel.tsx'
import { HabitatDock } from './Habitat.tsx'
import { ScenarioLink, Skeleton, ThemeToggle } from './ui.tsx'
import { StoryStepper } from '../story/Story.tsx'

const NAV: NavItem[] = [
  { name: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { name: 'Investigations', url: '/investigations', icon: List },
  { name: 'Lab', url: '/lab', icon: FlaskConical },
  { name: 'About', url: '/about', icon: Info },
]

// The screens that change with the habitat carry the habitat dropdown.
const HABITAT_SCREENS = /^\/(dashboard|investigations|lab)\/?$|^\/lab\//

function Wordmark() {
  return (
    <ScenarioLink to="/" className="flex items-center gap-2 text-ink no-underline hover:no-underline" aria-label="EMBER, the start page">
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-ember" style={{ boxShadow: '0 0 calc(10px * var(--glow-strength)) var(--ember)' }} aria-hidden="true" />
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
      <header className="no-print mx-auto flex h-[var(--topbar)] w-full max-w-[1280px] items-center justify-between px-4 md:px-6">
        <Wordmark />
        <ThemeToggle />
      </header>
      <NavBar items={NAV} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="px-4 pb-40 pt-6 text-center text-[12px] text-faint sm:pb-24">
        Built with NASA open data from the PSI repository. <ScenarioLink to="/about">About EMBER</ScenarioLink>
      </footer>
      {HABITAT_SCREENS.test(location.pathname) && !inStory ? <HabitatDock /> : null}
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
    <DataGate skeleton={<BootSkeleton />}>
      <ShellBody />
    </DataGate>
  )
}

// A plain fallback when a screen fails. The shell and every other screen keep working.
export function RouteError({ standalone = false }: { standalone?: boolean }) {
  const error = useRouteError()
  useEffect(() => {
    if (error) console.error(error)
  }, [error])
  return (
    <div className={`page ${standalone ? 'flex min-h-screen flex-col justify-center' : ''}`}>
      <h1 id="page-title" tabIndex={-1} className="text-[28px]">
        This screen could not be shown
      </h1>
      <p className="mt-3 text-muted">The rest of EMBER still works.</p>
      <p className="mt-4">
        <Link to="/dashboard" className="btn btn-primary">
          Go to the dashboard
        </Link>
      </p>
    </div>
  )
}

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
    <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 id="page-title" tabIndex={-1} className="text-[26px] outline-none md:text-[32px]">
          {title}
        </h1>
        {lead ? <p className="mt-1 text-[14px] text-muted">{lead}</p> : null}
      </div>
      {children}
    </header>
  )
}
