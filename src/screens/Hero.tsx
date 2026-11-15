// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The hero: the sky, the name, three short lines and one way in. Nothing else.
import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import HalftoneNebula from '@/components/ui/halftone-nebula.tsx'
import { ScenarioLink } from '../components/ui.tsx'
import { SI_LABEL, SI_MARK } from '../three/ramp.ts'

export default function Hero() {
  useEffect(() => {
    document.title = 'EMBER: a fire evidence map for crew habitats'
  }, [])
  return (
    <main id="main" className="relative w-full">
      {/* One device pixel per CSS pixel is enough here: the sky snaps to a six pixel grid. */}
      <HalftoneNebula maxDpr={1}>
        {/* A soft shade behind the words, so they read over the brightest gas. */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(75% 65% at 0% 100%, color-mix(in srgb, var(--hero-void) 88%, transparent) 0%, color-mix(in srgb, var(--hero-void) 55%, transparent) 45%, transparent 75%)' }} aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-6 sm:p-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-hero-ink/60">Built with NASA open data</p>
          <div className="max-w-xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.34em] text-hero-hot">Fire evidence for crew habitats</p>
            <h1 id="page-title" tabIndex={-1} className="font-display text-6xl font-semibold leading-[0.95] tracking-tight text-hero-ink outline-none sm:text-8xl">
              EMBER
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-hero-ink/70">
              Pick a crew habitat. See what NASA's microgravity fire tests cover for it. Find the gaps before the crew does.
            </p>
            <ScenarioLink
              to="/dashboard"
              className="pointer-events-auto mt-8 inline-flex items-center gap-3 border border-hero-hot bg-hero-hot/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-hero-ink no-underline transition-colors hover:bg-hero-hot hover:text-hero-void hover:no-underline"
            >
              Open the dashboard <ArrowRight size={14} aria-hidden="true" />
            </ScenarioLink>
          </div>
        </div>
      </HalftoneNebula>
      <span className="si-mark absolute bottom-3 right-3 z-10" title={SI_LABEL} aria-label={SI_LABEL}>
        {SI_MARK}
      </span>
    </main>
  )
}
