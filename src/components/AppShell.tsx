// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The shell that every screen shares: top bar, habitat, navigation, gravity banner, drill panel, footer.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useRouteError } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Home, List, Map as MapIcon, Menu, MessageCircleQuestion, Play, TriangleAlert } from 'lucide-react'
import { useData } from '../state/data.tsx'
import { useCoverage, useDrill, useScenario } from '../state/hooks.ts'
import { isPartialGravity } from '../state/scenario.ts'
import { pageName } from '../routes.tsx'
import { DrillPanel } from './DrillPanel.tsx'
import { HabitatPill } from './Habitat.tsx'
import { ScenarioLink, Skeleton, ThemeToggle } from './ui.tsx'
import { StoryStepper } from '../story/Story.tsx'

const NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Brief' },
  { to: '/map', label: 'Map' },
  { to: '/investigations', label: 'Investigations' },
  { to: '/lab', label: 'Lab' },
  { to: '/ask', label: 'Ask' },
  { to: '/earth', label: 'Earth' },
  { to: '/methods', label: 'Methods and about' },
]

const isCurrent = (pathname: string, to: string): boolean => (to === '/' ? pathname === '/' : pathname.startsWith(to))

// The small dot in the wordmark glows in proportion to the overall coverage.
function Wordmark() {
  const coverage = useCoverage()
  const strength = Math.max(0.15, coverage.overall / 100)
  return (
    <ScenarioLink to="/" className="flex items-center gap-2 text-ink no-underline hover:no-underline" aria-label="EMBER, the Brief">
      <span
        className="inline-block h-3 w-3 rounded-full bg-ember"
        style={{ opacity: 0.35 + 0.65 * strength, boxShadow: `0 0 calc(${Math.round(strength * 14)}px * var(--glow-strength)) var(--ember)`, transition: 'opacity var(--t-scene), box-shadow var(--t-scene)' }}
        aria-hidden="true"
      />
      <span className="font-display text-[20px] font-bold tracking-[0.12em]">EMBER</span>
    </ScenarioLink>
  )
}

function GravityBanner() {
  const { snapshot } = useData()
  const { scenario } = useScenario()
  // Computed from the Project Type values, not typed in by hand.
  const partialInvestigations = Object.entries(snapshot.counts.projectTypes).filter(([type]) => /partial|lunar|martian/i.test(type)).length
  const show = isPartialGravity(scenario.gravity) && partialInvestigations === 0
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32 }} className="overflow-hidden">
          <div className="banner">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <p className="mx-auto w-full max-w-[1232px]">
              <strong>PSI holds no partial-gravity combustion tests.</strong> Microgravity and normal gravity results bound what happens in between.
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function BottomTabs({ pathname }: { pathname: string }) {
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [pathname])
  const tabs = [
    { to: '/', label: 'Brief', Icon: Home },
    { to: '/map', label: 'Map', Icon: MapIcon },
    { to: '/investigations', label: 'List', Icon: List },
    { to: '/ask', label: 'Ask', Icon: MessageCircleQuestion },
  ]
  return (
    <>
      {more ? (
        <>
          <div className="scrim lg:hidden" aria-hidden="true" onClick={() => setMore(false)} />
          <div className="sheet p-4 lg:hidden" role="dialog" aria-label="More screens">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 pb-16">
              {[{ to: '/lab', label: 'Lab' }, { to: '/compare', label: 'Compare' }, { to: '/earth', label: 'Earth' }, { to: '/methods', label: 'Methods and about' }].map((item) => (
                <li key={item.to}>
                  <ScenarioLink to={item.to} className="nav-link w-full text-[16px]">
                    {item.label}
                  </ScenarioLink>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      <nav className="bottom-tabs no-print" aria-label="Main">
        {tabs.map(({ to, label, Icon }) => (
          <ScenarioLink key={to} to={to} aria-current={isCurrent(pathname, to) ? 'page' : undefined}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </ScenarioLink>
        ))}
        <a
          href="#more"
          role="button"
          aria-expanded={more}
          onClick={(e) => {
            e.preventDefault()
            setMore((v) => !v)
          }}
          aria-current={['/lab', '/compare', '/earth', '/methods'].some((p) => pathname.startsWith(p)) ? 'page' : undefined}
        >
          <Menu size={20} aria-hidden="true" />
          More
        </a>
      </nav>
    </>
  )
}

function Footer() {
  const { snapshot } = useData()
  const date = snapshot.fetchedAt.slice(0, 10)
  return (
    <footer className="border-t border-line pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-[13px] text-muted md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:px-6">
        <span>
          PSI snapshot taken on <span className="num">{date}</span>
        </span>
        <span>Built with NASA open data from the PSI repository</span>
        <span>Apache 2.0 licence</span>
        <a href="https://github.com/SUMMERxKx/NasaHackathon" target="_blank" rel="noreferrer">
          Repository
        </a>
        <ScenarioLink to="/about">SI disclosure</ScenarioLink>
        <span>Team Low Cortisol Gng, NASA Space Apps 2026</span>
      </div>
    </footer>
  )
}

export function AppShell() {
  const location = useLocation()
  const { path } = useDrill()
  const name = pageName(location.pathname)
  const first = useRef(true)
  const [announce, setAnnounce] = useState('')
  // On every route change, focus moves to the page heading and the page title is announced.
  useEffect(() => {
    document.title = name === 'Brief' ? 'EMBER: a fire evidence map for crew habitats' : `${name} · EMBER`
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
      <header className="topbar no-print">
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-3 px-4 md:px-6">
          <Wordmark />
          <div className="flex min-w-0 flex-1 justify-center lg:flex-none lg:pl-4">
            <HabitatPill />
          </div>
          <nav className="ml-auto hidden items-center lg:flex" aria-label="Main">
            {NAV.map((item) => (
              <ScenarioLink key={item.to} to={item.to} className="nav-link" aria-current={isCurrent(location.pathname, item.to) ? 'page' : undefined}>
                {item.label}
              </ScenarioLink>
            ))}
          </nav>
          <ScenarioLink to="/" extra={{ story: '1' }} className="btn btn-secondary btn-sm hidden shrink-0 md:inline-flex">
            <Play size={14} aria-hidden="true" /> Play the story
          </ScenarioLink>
          <ThemeToggle />
        </div>
      </header>
      <GravityBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomTabs pathname={location.pathname} />
      {path ? <DrillPanel pageName={name} /> : null}
      <StoryStepper />
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </div>
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
      <p className="mt-3 text-muted">Something went wrong while drawing it. The rest of EMBER still works.</p>
      <p className="mt-4">
        <Link to="/" className="btn btn-primary">
          Go to the Brief
        </Link>
      </p>
    </div>
  )
}

export function BootSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading the NASA snapshot">
      <Skeleton className="mb-6 h-10 w-48" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 id="page-title" tabIndex={-1} className="text-[28px] outline-none md:text-[36px]">
          {title}
        </h1>
        {lead ? <p className="prose-width mt-2 text-muted">{lead}</p> : null}
      </div>
      {children}
    </header>
  )
}
