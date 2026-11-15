// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The one temperature ramp. The shader, the poster and the scale bar all read their colours from
// this array, so the picture and its legend cannot disagree. A multi-colour ramp always means
// temperature and always carries a scale in kelvin.

export type RampStop = { t: number; color: string }

// From dark, through red and orange, to near white.
export const RAMP: RampStop[] = [
  { t: 0, color: '#0a0d1a' },
  { t: 0.16, color: '#3a0d1c' },
  { t: 0.34, color: '#8e1b1b' },
  { t: 0.52, color: '#dc451a' },
  { t: 0.7, color: '#ff8a1e' },
  { t: 0.84, color: '#ffc04a' },
  { t: 0.94, color: '#ffe8a6' },
  { t: 1, color: '#fffaf0' },
]

// The scale runs from cabin air to past a typical flame. Both labelled ends are from NASA's
// Researcher's Guide to Combustion Science, page 8. The bar runs on to 3,000 K because the
// listed flame temperatures in the ACME tables reach 2,978 K.
export const SCALE = { minK: 300, maxK: 3000, cabinK: 300, flameK: 2300 }

// Colours of the camera view. They are fixed and do not change with the theme.
export const CAMERA = { deep: '#0b1736', blue: '#3f7bff', pale: '#bcd6ff', soot: '#ffd27a' }
// The stage behind the fireball. A warm near black, the same in both themes.
export const STAGE = '#0b0807'
export const SCENE = { droplet: '#cfe6ff', candle: '#e9e2d0', wick: '#2a2320', module: '#8fa3c4', haze: '#9db4d6', oxygen: '#74b3ff' }

export const kelvinToT = (kelvin: number): number => Math.min(1, Math.max(0, (kelvin - SCALE.minK) / (SCALE.maxK - SCALE.minK)))
export const tToKelvin = (t: number): number => SCALE.minK + t * (SCALE.maxK - SCALE.minK)

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Temperature maps to colour in one direction only: a higher t is never darker than a lower one.
export function rampColorAt(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  let low = RAMP[0]
  let high = RAMP[RAMP.length - 1]
  for (let i = 0; i < RAMP.length - 1; i += 1) {
    if (clamped >= RAMP[i].t && clamped <= RAMP[i + 1].t) {
      low = RAMP[i]
      high = RAMP[i + 1]
      break
    }
  }
  const span = high.t - low.t || 1
  const f = (clamped - low.t) / span
  const a = hexToRgb(low.color)
  const b = hexToRgb(high.color)
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]
}

export const rampCss = (t: number): string => {
  const [r, g, b] = rampColorAt(t)
  return `rgb(${r} ${g} ${b})`
}

// The scale bar's gradient, bottom to top.
export function rampGradient(direction = 'to top'): string {
  return `linear-gradient(${direction}, ${RAMP.map((s) => `${s.color} ${Math.round(s.t * 100)}%`).join(', ')})`
}

// A 256 step strip of the ramp, as bytes for the shader's lookup texture.
export function rampBytes(steps = 256): Uint8Array {
  const out = new Uint8Array(steps * 4)
  for (let i = 0; i < steps; i += 1) {
    const [r, g, b] = rampColorAt(i / (steps - 1))
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  return out
}

// The hero sky. The solar preset of the halftone nebula, tuned to the flame ramp above.
export const NEBULA = {
  voidColor: '#070403',
  hazeColor: '#211109',
  duskColor: '#3a0d1c',
  wineColor: '#6e1f0c',
  crimsonColor: '#dc451a',
  hotColor: '#ffa62b',
  starColor: '#ffe8a6',
}

// The small corner mark on every SI-generated visual, and the words it stands for.
export const SI_MARK = 'SI'
export const SI_LABEL = 'SI-generated illustration'
export const SCALE_NOTE = "Illustrative temperature pattern. Scale ends from NASA's Researcher's Guide."
