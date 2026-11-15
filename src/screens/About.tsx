// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// About: everything that explains EMBER, in one place. The quotes, the citations, the formulas,
// the assumptions, the evaluation, the SI disclosure and the Earth benefits all live here,
// so the working screens can stay light.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/AppShell.tsx'
import { ScenarioLink } from '../components/ui.tsx'
import { EarthSection } from './about/Earth.tsx'
import { AnswersSection, DisclosureSection, FindingsSection, MethodsSection, OverviewSection, SourcesSection, VisualsSection } from './about/sections.tsx'

export const ABOUT_TABS: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'findings', label: 'Findings' },
  { id: 'methods', label: 'Data and methods' },
  { id: 'visuals', label: 'Visuals' },
  { id: 'answers', label: 'Live answers' },
  { id: 'earth', label: 'Back on Earth' },
  { id: 'si', label: 'SI disclosure' },
  { id: 'sources', label: 'Sources' },
]

// Every section, by the tab that holds it. A link can name a tab or one section inside a tab.
const TAB_OF: Record<string, string> = {
  challenge: 'overview',
  why: 'overview',
  licence: 'overview',
  data: 'methods',
  pipeline: 'methods',
  formulas: 'methods',
  nearby: 'methods',
  coverage: 'methods',
  assumptions: 'methods',
  corrections: 'methods',
  unplotted: 'methods',
  limits: 'methods',
  fireball: 'visuals',
  drivers: 'visuals',
  sky: 'visuals',
  evaluation: 'answers',
  drafts: 'si',
  resources: 'sources',
  glossary: 'sources',
  snapshot: 'sources',
}

export function aboutTab(section: string | null): string {
  if (!section) return 'overview'
  if (ABOUT_TABS.some((t) => t.id === section)) return section
  return TAB_OF[section] ?? 'overview'
}

export default function About() {
  const [params] = useSearchParams()
  const section = params.get('section')
  const tab = aboutTab(section)
  useEffect(() => {
    if (!section || section === tab) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [section, tab])
  return (
    <div className="page">
      <PageHeader title="About" lead="How EMBER is made, what it assumes and what it cannot tell you" />
      {/* One panel holds the tabs and the sections. Thin lines divide the sections inside it. */}
      <div className="card">
      <nav aria-label="About sections" className="hide-scrollbar overflow-x-auto border-b border-line px-2 md:px-4">
        <ul className="m-0 flex list-none gap-1 p-0">
          {ABOUT_TABS.map((t) => (
            <li key={t.id} className="shrink-0">
              <ScenarioLink to={`/about?section=${t.id}`} className="nav-link !min-h-10 text-[13px]" aria-current={t.id === tab ? 'page' : undefined} preventScrollReset>
                {t.label}
              </ScenarioLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 p-4 md:p-6">
        {tab === 'overview' ? <OverviewSection /> : null}
        {tab === 'findings' ? <FindingsSection /> : null}
        {tab === 'methods' ? <MethodsSection /> : null}
        {tab === 'visuals' ? <VisualsSection /> : null}
        {tab === 'answers' ? <AnswersSection /> : null}
        {tab === 'earth' ? <EarthSection /> : null}
        {tab === 'si' ? <DisclosureSection /> : null}
        {tab === 'sources' ? <SourcesSection /> : null}
      </div>
      </div>
    </div>
  )
}
