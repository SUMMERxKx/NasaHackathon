// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Every route renders to a string against the committed snapshot, in both themes, with no browser.
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { RouteError } from './components/AppShell.tsx'
import { decodeDrill, resolveDrill } from './lib/drill.ts'
import { data, preset, snapshot } from './lib/testData.ts'
import { makeRoutes } from './routes.tsx'
import Ask from './screens/Ask.tsx'
import Brief from './screens/Brief.tsx'
import Compare from './screens/Compare.tsx'
import Earth from './screens/Earth.tsx'
import InvestigationDetail from './screens/InvestigationDetail.tsx'
import Investigations from './screens/Investigations.tsx'
import Lab from './screens/Lab.tsx'
import MapScreen from './screens/MapScreen.tsx'
import Methods from './screens/Methods.tsx'
import { LoadError, StaticDataProvider, checkSchema } from './state/data.tsx'
import { parseScenario } from './state/scenario.ts'
import { STORY_STEPS, storyCaption } from './story/Story.tsx'

const routes = makeRoutes({ Brief, MapScreen, Investigations, InvestigationDetail, Ask, Methods, Compare, Lab, Earth })

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
  '/?h=suit',
  '/?o2=50&p=5&g=0.38&flow=40',
  '/map',
  '/map?h=exploration&zoom=moon',
  '/map?view=table&fuel=liquid',
  '/investigations',
  '/investigations?focus=prevention&informs=detectors&sel=PSI-25,PSI-26',
  ...snapshot.investigations.map((i) => `/investigations/${i.accession}`),
  '/investigations/PSI-69?raw=1&row=PSI-69:0:2',
  '/compare?ids=PSI-25,PSI-26,PSI-99',
  '/lab',
  '/lab/droplet',
  '/lab/extinction',
  '/lab/gravity',
  '/ask',
  '/ask?q=What%20is%20missing%20for%20the%20Moon%3F',
  '/earth',
  '/methods',
  '/methods?section=si',
  '/?drill=region.moon~inv.PSI-159',
  '/map?drill=test.PSI-69:0:2',
  '/?drill=not-a-real-path',
  '/?story=3',
]

describe('routes', () => {
  it('render every screen in both themes without throwing', () => {
    for (const url of URLS) {
      for (const theme of ['dark', 'light'] as const) {
        const html = render(url, theme)
        expect(html.length, url).toBeGreaterThan(2000)
        expect(html, url).toContain('EMBER')
        expect(html, url).not.toContain('This screen could not be shown')
      }
    }
  })
  it('show the not a safety rating line beside the score', () => {
    expect(render('/').toLowerCase()).toContain('not a safety rating')
    expect(render('/map').toLowerCase()).toContain('not a safety rating')
  })
  it('show the gravity banner only for Moon and Mars gravity', () => {
    expect(render('/?h=exploration')).toContain('PSI holds no partial-gravity combustion tests.')
    expect(render('/?h=iss')).not.toContain('PSI holds no partial-gravity combustion tests.')
  })
  it('carry the SI label on the fireball and the challenge block on Methods', () => {
    expect(render('/')).toContain('SI-generated illustration')
    expect(render('/methods')).toContain('How EMBER answers the challenge')
    expect(render('/methods')).toContain('Download the whole normalized dataset')
  })
  it('open the drill panel from the address and ignore an address that does not decode', () => {
    expect(render('/?drill=region.moon~inv.PSI-159')).toContain('drill-title')
    expect(render('/?drill=not-a-real-path')).not.toContain('drill-title')
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
    const children = routes[0].children ?? []
    for (const child of children) {
      if (child.path === 'about' || child.path === '*') continue
      expect(child.errorElement, String(child.path)).toBeTruthy()
    }
    expect(routes[0].errorElement).toBeTruthy()
  })
  it('show a plain line and a link to the Brief when a screen fails', () => {
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
    expect(shown).toContain('Go to the Brief')
  })
  it('refuse data with a wrong schema version and offer a retry', () => {
    expect(() => checkSchema({ schemaVersion: 2 }, { schemaVersion: 1 })).toThrow()
    expect(() => checkSchema({ schemaVersion: 1 }, { schemaVersion: 1 })).not.toThrow()
    const html = renderToString(<LoadError message="The data files are from a different version of EMBER" onRetry={() => {}} />)
    expect(html).toContain('Retry')
  })
})

describe('story', () => {
  it('reads every number in a caption from the data', () => {
    expect(STORY_STEPS.length).toBe(5)
    for (const step of STORY_STEPS) {
      // No caption template holds a typed digit. Numbers enter only through the data.
      expect(step.template).not.toMatch(/\d/)
      expect(storyCaption(step, data).length).toBeGreaterThan(20)
    }
    expect(storyCaption(STORY_STEPS[2], data)).toContain(String(data.insightById.I2.numbers.moonRegionTests))
    expect(storyCaption(STORY_STEPS[3], data)).toContain(data.insightById.I1.display.maxSolidO2Pct.replace('%', ''))
    expect(preset('iss').presetId).toBe('iss')
  })
})
