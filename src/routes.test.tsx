// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Every route renders to a string against the committed snapshot, in both themes, with no browser.
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { RouteError } from './components/AppShell.tsx'
import ChatPanel, { CHAT_NOTE, CHIPS } from './components/chat/ChatPanel.tsx'
import { decodeDrill, resolveDrill } from './lib/drill.ts'
import { appHref } from './lib/links.ts'
import { data, evidence, preset, snapshot } from './lib/testData.ts'
import { makeRoutes, movedTo, pageName } from './routes.tsx'
import About, { ABOUT_TABS, aboutTab } from './screens/About.tsx'
import Compare from './screens/Compare.tsx'
import Dashboard, { NO_PARTIAL_GRAVITY } from './screens/Dashboard.tsx'
import Hero from './screens/Hero.tsx'
import InvestigationDetail from './screens/InvestigationDetail.tsx'
import Investigations from './screens/Investigations.tsx'
import Lab from './screens/Lab.tsx'
import { LoadError, StaticDataProvider, checkSchema } from './state/data.tsx'
import { parseScenario } from './state/scenario.ts'
import { STORY_STEPS, storyCaption } from './story/Story.tsx'

const routes = makeRoutes({ Hero, Dashboard, Investigations, InvestigationDetail, Compare, Lab, About })

function render(url: string, theme: 'dark' | 'light' = 'dark'): string {
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  return renderToString(
    <div data-theme={theme}>
      <MotionConfig reducedMotion="user">
        <StaticDataProvider data={data}>
          <RouterProvider router={router} />
        </StaticDataProvider>
      </MotionConfig>
    </div>,
  )
}

const URLS = [
  '/',
  '/?h=exploration',
  '/dashboard',
  '/dashboard?h=exploration',
  '/dashboard?h=suit',
  '/dashboard?o2=50&p=5&g=0.38&flow=40',
  '/dashboard?h=exploration&zoom=moon',
  '/dashboard?view=table&fuel=liquid',
  '/investigations',
  '/investigations?focus=prevention&informs=detectors&sel=PSI-25,PSI-26',
  ...snapshot.investigations.map((i) => `/investigations/${i.accession}`),
  '/investigations/PSI-69?raw=1&row=PSI-69:0:2',
  '/investigations/compare?ids=PSI-25,PSI-26,PSI-99',
  '/lab',
  '/lab/droplet',
  '/lab/extinction',
  '/lab/gravity',
  '/about',
  ...ABOUT_TABS.map((t) => `/about?section=${t.id}`),
  '/about?section=assumptions',
  '/dashboard?drill=region.moon~inv.PSI-159',
  '/dashboard?drill=test.PSI-69:0:2',
  '/dashboard?drill=not-a-real-path',
  '/dashboard?story=3',
]

describe('routes', () => {
  it('render every screen in both themes without throwing', () => {
    for (const url of URLS) {
      for (const theme of ['dark', 'light'] as const) {
        const html = render(url, theme)
        expect(html.length, url).toBeGreaterThan(1200)
        expect(html, url).toContain('EMBER')
        expect(html, url).not.toContain('This screen could not be shown')
      }
    }
  })
  it('open on a hero with the name, one way in and nothing from the dashboard', () => {
    const html = render('/')
    expect(html).toContain('Open the dashboard')
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain('aria-label="Main"')
    expect(html).not.toContain('habitat-dock')
    expect(render('/?h=suit')).toContain('href="/dashboard?h=suit"')
  })
  it('show the not a safety rating line beside the score', () => {
    expect(render('/dashboard').toLowerCase()).toContain('not a safety rating')
  })
  it('flag partial gravity only for Moon and Mars gravity', () => {
    expect(render('/dashboard?h=exploration')).toContain(NO_PARTIAL_GRAVITY)
    expect(render('/dashboard?h=iss')).not.toContain(NO_PARTIAL_GRAVITY)
  })
  it('carry a small SI mark on the fireball and on the hero sky, with the words behind it', () => {
    for (const url of ['/', '/dashboard', '/lab/droplet']) {
      const html = render(url)
      expect(html, url).toContain('SI-generated illustration')
      expect(html, url).toMatch(/>SI</)
    }
  })
  it('keep the working screens free of SI tags and send them to About', () => {
    for (const url of ['/dashboard', '/investigations', '/investigations/PSI-69', '/lab']) {
      const html = render(url)
      expect(html, url).not.toContain('SI drafted')
      expect(html, url).not.toContain('needs human check')
    }
    const si = render('/about?section=si')
    expect(si).toContain('SI drafted')
    expect(si).toContain('needs human check')
  })
  it('hold the challenge block, the dataset, the Earth benefits and the resources on About', () => {
    expect(render('/about')).toContain('How EMBER answers the challenge')
    expect(render('/about?section=methods')).toContain('Download the whole normalized dataset')
    expect(render('/about?section=earth')).toContain('Three NASA spinoffs')
    expect(render('/about?section=sources')).toContain('The ten challenge resources')
    expect(render('/about?section=answers')).toContain('How an answer is made')
    expect(render('/about?section=findings').match(/Verified/g)?.length).toBeGreaterThanOrEqual(12)
  })
  it('open the About tab that holds a named section', () => {
    expect(aboutTab(null)).toBe('overview')
    expect(aboutTab('assumptions')).toBe('methods')
    expect(aboutTab('glossary')).toBe('sources')
    expect(aboutTab('earth')).toBe('earth')
    expect(aboutTab('nothing-like-this')).toBe('overview')
    expect(render('/about?section=assumptions')).toContain('Declared assumptions')
  })
  it('light the navbar tab from the route', () => {
    const lit = (url: string) => (render(url).match(/<a [^>]*>/g) ?? []).filter((tag) => tag.includes('aria-current="page"') && tag.includes('rounded-full'))
    expect(lit('/lab/extinction')).toHaveLength(1)
    expect(lit('/lab/extinction')[0]).toContain('aria-label="Lab"')
    expect(lit('/investigations/PSI-69')[0]).toContain('aria-label="Investigations"')
    expect(lit('/investigations/compare?ids=PSI-25,PSI-26')[0]).toContain('aria-label="Investigations"')
    expect(lit('/dashboard?h=suit')[0]).toContain('href="/dashboard?h=suit"')
    expect(lit('/about')[0]).toContain('aria-label="About"')
    expect(pageName('/dashboard')).toBe('Dashboard')
  })
  it('put the habitat dropdown on the screens that follow the habitat', () => {
    for (const url of ['/dashboard', '/investigations', '/lab', '/lab/gravity']) expect(render(url), url).toContain('habitat-dock')
    for (const url of ['/about', '/investigations/PSI-69']) expect(render(url), url).not.toContain('habitat-dock')
    expect(render('/dashboard?h=suit')).toContain(preset('suit').presetId === 'suit' ? snapshot.habitats.find((h) => h.id === 'suit')?.name : '')
  })
  it('open the drill panel from the address and ignore an address that does not decode', () => {
    expect(render('/dashboard?drill=region.moon~inv.PSI-159')).toContain('drill-title')
    expect(render('/dashboard?drill=not-a-real-path')).not.toContain('drill-title')
  })
  it('send every old address to the screen that now holds its content', () => {
    const q = (text: string) => new URLSearchParams(text)
    expect(movedTo('/dashboard', q('h=suit&zoom=moon'))).toBe('/dashboard?h=suit&zoom=moon')
    expect(movedTo('/dashboard', q('q=What+is+a+cool+flame%3F'), { q: 'ask' }, { chat: '1' })).toBe('/dashboard?ask=What+is+a+cool+flame%3F&chat=1')
    expect(movedTo('/about', q(''), {}, { section: 'earth' })).toBe('/about?section=earth')
    expect(movedTo('/about', q('section=si'), {}, { section: 'methods' })).toBe('/about?section=si')
    const paths = (routes[1].children ?? []).map((c) => c.path)
    for (const old of ['map', 'ask', 'earth', 'methods', 'compare']) expect(paths).toContain(old)
  })
})

describe('chat panel', () => {
  const panel = (): string => {
    const router = createMemoryRouter([{ path: '/dashboard', element: <ChatPanel open onClose={() => {}} /> }], { initialEntries: ['/dashboard'] })
    return renderToString(
      <StaticDataProvider data={data}>
        <RouterProvider router={router} />
      </StaticDataProvider>,
    )
  }
  it('shows the example questions and one small line, and no account of how answers are made', () => {
    const html = panel()
    for (const chip of CHIPS) expect(html).toContain(chip.question)
    expect(CHAT_NOTE).toContain('They can make mistakes, so check the sources.')
    expect(html).toContain('They can make mistakes, so check the sources.')
    expect(html).not.toContain('How an answer is made')
    expect(html).not.toContain('OpenRouter')
    expect(html.match(/<p[ >]/g)?.length ?? 0).toBeLessThanOrEqual(2)
  })
  it('stays closed until it is opened, behind a small launcher', () => {
    const html = render('/dashboard')
    expect(html).toContain('chat-launcher')
    expect(html).not.toContain('chat-panel')
  })
  it('points every evidence link at a screen that exists', () => {
    const known = /^\/(dashboard|investigations|lab|about|methods|earth)(\/|\?|$)/
    for (const item of Object.values(evidence.items)) expect(appHref(item.href), item.id).toMatch(known)
    expect(appHref('/?drill=insight.I1.maxSolidO2Pct')).toBe('/dashboard?drill=insight.I1.maxSolidO2Pct')
    expect(appHref('/?h=suit')).toBe('/dashboard?h=suit')
  })
})

describe('drill marks', () => {
  it('give every mark on every screen a path that resolves to rows or to a note', () => {
    let marks = 0
    for (const url of URLS) {
      const html = render(url)
      const scenario = parseScenario(new URL(url, 'http://x').searchParams, snapshot.habitats)
      const seen = new Set<string>()
      for (const match of html.matchAll(/data-drill="([^"]+)"/g)) {
        const text = match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
        if (seen.has(text)) continue
        seen.add(text)
        const path = decodeDrill(text)
        expect(path, `${url} ${text}`).not.toBeNull()
        const result = resolveDrill(path ?? [], data, scenario)
        expect(result.total > 0 || result.note != null || result.test != null, `${url} ${text}`).toBe(true)
        marks += 1
      }
    }
    expect(marks).toBeGreaterThan(2000)
  })
})

describe('fallbacks', () => {
  it('give every screen route its own error element', () => {
    const moved = ['map', 'ask', 'earth', 'methods', 'compare', '*']
    for (const child of routes[1].children ?? []) {
      if (moved.includes(String(child.path))) continue
      expect(child.errorElement, String(child.path)).toBeTruthy()
    }
    expect(routes[0].errorElement).toBeTruthy()
    expect(routes[1].errorElement).toBeTruthy()
  })
  it('show a plain line and a link to the dashboard when a screen fails', () => {
    const Broken = () => {
      throw new Error('boom')
    }
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <RouteError standalone /> }], { initialEntries: ['/'] })
    let html = ''
    try {
      html = renderToString(<RouterProvider router={router} />)
    } catch {
      // Rendering on a server cannot catch a render error. The fallback itself is checked below.
    }
    const fallback = createMemoryRouter([{ path: '/', element: <RouteError /> }], { initialEntries: ['/'] })
    const shown = html.includes('could not be shown') ? html : renderToString(<RouterProvider router={fallback} />)
    expect(shown).toContain('This screen could not be shown')
    expect(shown).toContain('Go to the dashboard')
  })
  it('refuse data with a wrong schema version and offer a retry', () => {
    expect(() => checkSchema({ schemaVersion: 2 }, { schemaVersion: 1 })).toThrow()
    expect(() => checkSchema({ schemaVersion: 1 }, { schemaVersion: 1 })).not.toThrow()
    const html = renderToString(<LoadError message="The data files are from a different version of EMBER" onRetry={() => {}} />)
    expect(html).toContain('Retry')
  })
})

describe('tour', () => {
  it('reads every number in a caption from the data', () => {
    expect(STORY_STEPS.length).toBe(5)
    for (const step of STORY_STEPS) {
      // No caption template holds a typed digit. Numbers enter only through the data.
      expect(step.template).not.toMatch(/\d/)
      expect(storyCaption(step, data).length).toBeGreaterThan(20)
      expect(step.path).toBe('/dashboard')
    }
    expect(storyCaption(STORY_STEPS[2], data)).toContain(String(data.insightById.I2.numbers.moonRegionTests))
    expect(storyCaption(STORY_STEPS[3], data)).toContain(data.insightById.I1.display.maxSolidO2Pct.replace('%', ''))
    expect(STORY_STEPS[4].params.ask).toBe(CHIPS[4].question)
  })
})
