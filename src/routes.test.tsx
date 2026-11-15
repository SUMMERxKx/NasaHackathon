// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Every route renders to a string against the committed snapshot, with no browser.
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './components/AppShell.tsx'
import { RouteError } from './components/RouteError.tsx'
import ChatPanel, { CHAT_NOTE, CHAT_SCOPE, CHIPS } from './components/chat/ChatPanel.tsx'
import { decodeDrill, resolveDrill } from './lib/drill.ts'
import { appHref } from './lib/links.ts'
import { data, evidence, preset, snapshot } from './lib/testData.ts'
import { makeRoutes, movedTo, pageName } from './routes.tsx'
import About, { ABOUT_TABS, aboutTab } from './screens/About.tsx'
import Compare from './screens/Compare.tsx'
import { dropletEmptyState } from './lib/lab.ts'
import { NO_NEARBY, NO_PARTIAL_GRAVITY } from './lib/nearby.ts'
import Dashboard from './screens/Dashboard.tsx'
import Hero from './screens/Hero.tsx'
import InvestigationDetail from './screens/InvestigationDetail.tsx'
import Investigations from './screens/Investigations.tsx'
import Lab from './screens/Lab.tsx'
import { LoadError, StaticDataProvider, checkSchema } from './state/data.tsx'
import { parseScenario } from './state/scenario.ts'
import { STORY_STEPS, storyCaption } from './story/Story.tsx'

const routes = makeRoutes({ Shell: AppShell, Hero, Dashboard, Investigations, InvestigationDetail, Compare, Lab, About })

function render(url: string): string {
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  return renderToString(
    <StaticDataProvider data={data}>
      <RouterProvider router={router} />
    </StaticDataProvider>,
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
  '/lab/flame',
  '/lab/flame?h=suit',
  '/about',
  ...ABOUT_TABS.map((t) => `/about?section=${t.id}`),
  '/about?section=assumptions',
  '/about?section=coverage&h=exploration',
  '/about?section=nearby',
  '/dashboard?h=shuttle-eva',
  '/dashboard?h=moon-bound',
  '/dashboard?h=mars',
  '/dashboard?h=exploration&drill=near.0.34,0.558,liquid',
  '/dashboard?h=suit&drill=near.1,0.2926,solid',
  '/dashboard?drill=near.0.21,1.0003,solid~inv.PSI-25',
  '/dashboard?drill=region.moon~inv.PSI-159',
  '/dashboard?drill=test.PSI-69:0:2',
  '/dashboard?drill=not-a-real-path',
  '/dashboard?story=3',
]

describe('routes', () => {
  it('render every screen without throwing', () => {
    for (const url of URLS) {
      const html = render(url)
      expect(html.length, url).toBeGreaterThan(1200)
      expect(html, url).toContain('EMBER')
      expect(html, url).not.toContain('This screen could not be shown')
    }
  })
  it('show one look, with no theme switch on any screen', () => {
    for (const url of URLS) {
      const html = render(url)
      expect(html, url).not.toContain('Theme:')
      expect(html, url).not.toContain('data-theme')
    }
  })
  it('keep every corner sharp, and leave round only the marks that stand for data', () => {
    for (const url of URLS) {
      const rounded = render(url).match(/\brounded(-[a-z0-9[\]]+)*/g) ?? []
      expect(rounded.filter((name) => name !== 'rounded-full'), url).toEqual([])
    }
    // The dots left round are legend keys for test marks, never a button, a card or the navbar.
    expect(render('/investigations')).not.toContain('rounded-full')
    expect(render('/about')).not.toContain('rounded-full')
  })
  it('open on a hero with the name, one way in and nothing from the dashboard', () => {
    const html = render('/')
    expect(html).toContain('Open the dashboard')
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain('aria-label="Main"')
    expect(html).not.toContain('habitat-picker')
    expect(html).not.toContain('top-bar')
    expect(render('/?h=suit')).toContain('href="/dashboard?h=suit"')
  })
  it('draw only the filtered tests on the dashboard map, with the Moon Base counts of the filter', () => {
    const text = (url: string) => render(url).replace(/<!-- -->/g, '')
    const whole = text('/dashboard')
    expect(whole).toContain('1893 of 1893 tests')
    expect(whole).toContain('0 solid, 0 liquid, 66 gas')
    for (const [inv, shown, moon] of [['PSI-25', 129, '0 solid, 0 liquid, 0 gas'], ['PSI-99', 9, '0 solid, 0 liquid, 0 gas'], ['PSI-69', 273, '0 solid, 0 liquid, 0 gas']] as const) {
      const html = text(`/dashboard?inv=${inv}`)
      expect(html).toContain(`${shown} of 1893 tests`)
      expect(html).toContain(`${shown} tests plotted on oxygen against pressure`)
      expect(html).toContain(moon)
      expect(html).not.toContain('66 gas')
      expect(html).toContain(`Only the ${shown} tests of the filter are drawn`)
    }
    expect(text('/dashboard?inv=PSI-69')).toContain('17 droplet tests on the edge')
    expect(text('/dashboard?inv=PSI-25')).toContain('0 droplet tests on the edge')
  })
  it('lead the dashboard with the five counts, each labelled, and write out a zero', () => {
    const text = (url: string) => render(url).replace(/<!-- -->/g, '')
    const iss = text('/dashboard')
    expect(iss).toMatch(/>1,087<\/button>\s*nearby NASA test records/)
    // The chart itself is drawn in the browser. Its accessible name carries the four class counts.
    expect(iss).toContain('1,087 NASA test records near ISS cabin. Solid materials: 230. Liquid fuels: 127. Gas flames: 613. Smoke and aerosols: 117.')
    expect(iss).toContain('View the 1,087 NASA rows')
    expect(iss).not.toContain(NO_NEARBY.toLowerCase())
    const exploration = text('/dashboard?h=exploration')
    expect(exploration).toMatch(/>24<\/button>\s*nearby NASA test records/)
    expect(exploration).toContain('data-drill="near.0.34,0.558"')
    // Until the bars arrive the same rows stand as plain text, each with the address of its own class.
    for (const fuel of ['solid', 'liquid', 'gas', 'aerosol']) expect(exploration).toContain(`data-drill="near.0.34,0.558,${fuel}"`)
    expect(exploration).toContain('aria-label="Liquid fuels: 9 nearby test records. Press Enter for the rows."')
    expect(exploration).toContain('aria-label="Solid materials: no nearby rows. Press Enter to see why."')
    expect(exploration.match(new RegExp(`>${NO_NEARBY}<`, 'g'))?.length).toBe(2)
    expect(exploration).toContain('24 NASA test records near Exploration atmosphere. Solid materials: no nearby rows. Liquid fuels: 9. Gas flames: 15. Smoke and aerosols: no nearby rows.')
    expect(text('/dashboard?h=mars')).toContain('24 NASA test records near Mars surface habitat. Solid materials: no nearby rows. Liquid fuels: 9. Gas flames: 15. Smoke and aerosols: no nearby rows.')
    expect(text('/dashboard?h=shuttle-eva')).toContain('43 NASA test records near Shuttle EVA preparation. Solid materials: no nearby rows. Liquid fuels: 43. Gas flames: no nearby rows. Smoke and aerosols: no nearby rows.')
    expect(text('/dashboard?h=moon-bound')).toContain('14 NASA test records near Moon Base bound. Solid materials: no nearby rows. Liquid fuels: 8. Gas flames: 6. Smoke and aerosols: no nearby rows.')
    const suit = text('/dashboard?h=suit')
    expect(suit).toMatch(/>0<\/button>\s*nearby NASA test records/)
    expect(suit).toContain('0 NASA test records near Spacesuit. Solid materials: no nearby rows. Liquid fuels: no nearby rows. Gas flames: no nearby rows. Smoke and aerosols: no nearby rows.')
    expect(suit).toContain('Why there are none')
    expect(suit.match(new RegExp(`>${NO_NEARBY}<`, 'g'))?.length).toBe(4)
    expect(suit).toContain('No nearby test records. Background investigations below.')
    expect(suit).not.toContain('Start with these investigations')
  })
  it('put one gap statement and its caveats beside the counts', () => {
    const exploration = render('/dashboard?h=exploration').replace(/<!-- -->/g, '')
    expect(exploration).toContain('No nearby solid-material or smoke tests. No partial-gravity data in this snapshot.')
    expect(exploration).toContain('not proof of safety')
    expect(exploration).toContain('data-drill="near.0.34,0.558,inverse"')
    expect(exploration).toMatch(/inverse-flame rows\. Their oxygen value is the oxidizer stream, not cabin air\./)
    expect(exploration).toContain('Gravity does not change these counts')
    const iss = render('/dashboard').replace(/<!-- -->/g, '')
    expect(iss).toContain('Nearby evidence spans all four fuel classes. Most of these rows use assumed coordinates.')
    expect(iss).toMatch(/>843<\/button>\s*rows with assumed coordinates/)
    expect(render('/dashboard?h=shuttle-eva')).toContain('Nearby evidence is limited to liquid-fuel tests.')
  })
  it('list three investigations with their nearby counts and no relevance bar', () => {
    const exploration = render('/dashboard?h=exploration').replace(/<!-- -->/g, '')
    expect(exploration).toContain('Start with these investigations')
    expect(exploration.match(/aria-label="Rank \d"/g)).toEqual(['aria-label="Rank 1"', 'aria-label="Rank 2"', 'aria-label="Rank 3"'])
    expect(exploration).toContain('data-drill="near.0.34,0.558~inv.PSI-159"')
    expect(exploration).not.toContain('Relevance, out of 100')
    const shuttle = render('/dashboard?h=shuttle-eva').replace(/<!-- -->/g, '')
    expect(shuttle).toContain('Liquid fuels. 43 of its')
    expect(shuttle.match(/Background evidence\./g)?.length).toBe(2)
  })
  it('keep the score, the flame and the findings off the dashboard and within one link of it', () => {
    const dashboard = render('/dashboard?h=exploration')
    expect(dashboard).not.toContain('coverage dial')
    expect(dashboard).not.toContain('SI-generated illustration')
    expect(dashboard.toLowerCase()).not.toContain('not a safety rating')
    expect(dashboard).toContain('href="/lab/flame?h=exploration"')
    expect(dashboard).toMatch(/href="\/about\?h=exploration&amp.section=coverage"/)
    expect(dashboard).toMatch(/href="\/about\?h=exploration&amp.section=findings"/)
    const score = render('/about?section=coverage&h=exploration')
    expect(score).toContain('Exploration atmosphere coverage dial')
    expect(score.toLowerCase()).toContain('not a safety rating')
    expect(score).toContain('data-drill="coverage.overall"')
    for (const pillar of ['prevention', 'detection', 'suppression']) expect(score).toContain(`data-drill="coverage.${pillar}"`)
    expect(aboutTab('coverage')).toBe('methods')
    expect(aboutTab('nearby')).toBe('methods')
    const flame = render('/lab/flame?h=exploration')
    expect(flame).toContain('SI-generated illustration')
    expect(flame).toContain('data-drill="fireball.burningRate"')
    expect(flame).toContain('data-drill="fireball.outcomes"')
    expect(flame).toContain('data-drill="fireball.flameTemperature"')
    expect(render('/lab/flame?h=suit')).toContain('data-drill="fireball.nearest"')
    expect(render('/about?section=findings').match(/Verified/g)?.length).toBeGreaterThanOrEqual(12)
  })
  it('draw the gravity pairs with no band and say that nothing in between was measured', () => {
    const gravity = render('/lab/gravity')
    expect(gravity).toContain('Paired observations at 0 g and 1 g. Intermediate gravity not measured')
    expect(gravity).not.toMatch(/bounded|Unknown, /)
    expect(data.insightById.I4.headline).toContain('median ratio, not an error bound')
    expect(data.insightById.I4.headline).not.toMatch(/within about/)
  })
  it('flag partial gravity only for Moon and Mars gravity', () => {
    expect(render('/dashboard?h=exploration')).toContain(NO_PARTIAL_GRAVITY)
    expect(render('/dashboard?h=iss')).not.toContain(NO_PARTIAL_GRAVITY)
  })
  it('carry a small SI mark on the fireball and on the hero sky, with the words behind it', () => {
    for (const url of ['/', '/lab/flame', '/lab/droplet']) {
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
    const lit = (url: string) => (render(url).match(/<a [^>]*>/g) ?? []).filter((tag) => tag.includes('aria-current="page"') && tag.includes('aria-label='))
    expect(lit('/lab/extinction')).toHaveLength(1)
    expect(lit('/lab/extinction')[0]).toContain('aria-label="Lab"')
    expect(lit('/investigations/PSI-69')[0]).toContain('aria-label="Investigations"')
    expect(lit('/investigations/compare?ids=PSI-25,PSI-26')[0]).toContain('aria-label="Investigations"')
    expect(lit('/dashboard?h=suit')[0]).toContain('href="/dashboard?h=suit"')
    expect(lit('/about')[0]).toContain('aria-label="About"')
    expect(pageName('/dashboard')).toBe('Dashboard')
  })
  it('put the habitat picker in the top bar of the screens that follow the habitat', () => {
    for (const url of ['/dashboard', '/investigations', '/lab', '/lab/gravity']) {
      const html = render(url)
      expect(html, url).toContain('habitat-picker')
      // The picker comes before the content, in the top bar, and not after it at the bottom.
      expect(html.indexOf('habitat-picker'), url).toBeGreaterThan(html.indexOf('top-bar'))
      expect(html.indexOf('habitat-picker'), url).toBeLessThan(html.indexOf('<main'))
    }
    for (const url of ['/about', '/investigations/PSI-69', '/dashboard?story=3']) expect(render(url), url).not.toContain('habitat-picker')
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
  it('shows the example questions, what it answers and one small line, and no account of how answers are made', () => {
    const html = panel()
    for (const chip of CHIPS) expect(html).toContain(chip.question)
    expect(CHAT_NOTE).toContain('They can make mistakes, so check the sources.')
    expect(html).toContain('They can make mistakes, so check the sources.')
    expect(html).not.toContain('How an answer is made')
    expect(html).not.toContain('OpenRouter')
    expect(CHAT_SCOPE).toBe("Ask about NASA's microgravity fire tests in EMBER")
    expect(html).toContain('microgravity fire tests in EMBER')
    expect(html.match(/<p[ >]/g)?.length ?? 0).toBeLessThanOrEqual(3)
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
    // The Moon Base step says how many of its gas flames are inverse, and the solid step is qualified.
    expect(storyCaption(STORY_STEPS[2], data)).toContain(`${data.insightById.I2.numbers.moonRegionInverse} of them inverse flames whose oxygen is the burner stream, not the chamber`)
    expect(storyCaption(STORY_STEPS[3], data)).toContain('Solid material tests that state their oxygen stop at 22.2%')
    expect(STORY_STEPS[4].params.ask).toBe(CHIPS[4].question)
  })
})

describe('audit fixes on screen', () => {
  const text = (url: string) => render(url).replace(/<!-- -->/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  it('marks oxygen and pressure assumed for both smoke studies in Compare, in the table and the summary', () => {
    const html = text('/investigations/compare?ids=PSI-102,PSI-101')
    expect(html).toContain('oxygen range (both assumed)')
    expect(html).toContain('pressure range (both assumed)')
    expect(html).toContain('>(both assumed)<')
  })
  it('shows no negative model end for FLEX C13H102', () => {
    const html = text('/lab/droplet?fuel=Heptane&lo2=17&gas=carbon%20dioxide&test=PSI-69:0:129')
    expect(html).toContain('Model end not defined')
    // The readout itself never prints a negative time.
    expect(html).not.toMatch(/Model end<\/p><p[^>]*>[-−]/)
  })
  it('adds the BRE note to the Exploration, Shuttle EVA and Mars gap statements only', () => {
    for (const h of ['exploration', 'shuttle-eva', 'mars']) expect(text(`/dashboard?h=${h}`), h).toContain('does not say which tests ran at which pressure')
    for (const h of ['iss', 'moon-bound']) expect(text(`/dashboard?h=${h}`), h).not.toContain('does not say which tests ran at which pressure')
  })
  it('links the glossary from the dashboard', () => {
    expect(text('/dashboard')).toContain('href="/about?section=glossary"')
  })
})

describe('the Lab droplet tool with no matching FLEX test', () => {
  const text = (url: string) => render(url).replace(/<!-- -->/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  // The cards, the tiles in them and the controls, in page order. An empty input must keep all of them.
  const frame = (html: string) => [...html.matchAll(/<section[^>]*aria-label(?:ledby)?="([^"]+)"|class="(bg-surface-2 p-3|mt-3 text-\[12px\] text-muted|field-label)"/g)].map((m) => m[1] ?? m[2])
  it('keeps every card in place and says so inside the chart instead of hiding anything', () => {
    const full = text('/lab/droplet?lo2=21')
    const empty = text('/lab/droplet?lo2=26')
    expect(full).not.toContain('No FLEX tests at 26% oxygen.')
    expect(empty).toContain('No FLEX tests at 26% oxygen.')
    expect(empty).toContain('Move the slider to see tests.')
    expect(empty).toMatch(/<select[^>]*name="test"[^>]*disabled/)
    expect(empty).toContain('None at 26% oxygen')
    expect(frame(empty)).toEqual(frame(full))
    expect(frame(empty)).toContain('validation-title')
  })
  it('points to the fuel or gas when no oxygen level has a test', () => {
    expect(dropletEmptyState([], 'Methanol', 0.26, 'helium', 0)).toEqual(['No FLEX tests at 26% oxygen.', 'Pick another fuel or gas to see tests.'])
  })
})
