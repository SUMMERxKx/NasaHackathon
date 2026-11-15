// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The sky behind every screen. Adapted from the Halftone Nebula component the owner supplied
// (21st.dev style), with its solar preset tuned to the EMBER flame palette. The planet of the
// original is drawn here as a flame in freefall: a sphere of flame around a small fuel droplet.
// One canvas serves the whole app. The hero shows it at full strength. Every other screen
// shows the same sky quieter, with no flame and no sparks, behind its panels. Only the hero
// answers a click. Everywhere else the sky has no click listener at all, only the hover lamp.
import * as React from "react"
import { NEBULA } from "@/three/ramp.ts"

/**
 * Halftone Nebula. A pixel-art night sky printed in dots.
 *
 * One full-screen fragment pass. The gas is domain-warped fbm sampled once per pixel cell,
 * quantised with an ordered Bayer dither, then printed as a halftone. Every cell is a flat
 * square of the dim ramp with a round dot of the bright ramp on top, and the dot grows with
 * density. On top sit three parallax layers of pixel stars, the halftone flame sphere and
 * cross-shaped sparks. The pointer is a lamp that parts the gas. A click drops a new spark
 * and sends a ring through the cloud.
 *
 * Self-contained: raw WebGL2, React is the only import. No textures and no image assets.
 * The canvas sizes itself from its own box and releases every GL object on unmount.
 */

export type NebulaParams = {
  // the grid
  /** CSS px per pixel cell. Everything snaps to this. */
  pixel: number
  /** Dot radius, in cells, where the gas is empty / densest. >0.5 merges dots. */
  dotMin: number
  dotMax: number
  /** Quantisation steps before dithering. Fewer reads more like pixel art. */
  levels: number
  // the gas
  scale: number
  warp: number
  drift: number
  density: number
  threshold: number
  softness: number
  /** The bright river of gas that sweeps across the frame. */
  band: number
  bandAngle: number
  bandOffset: number
  bandWidth: number
  haze: number
  // stars
  stars: number
  twinkle: number
  starDrift: number
  sparkles: number
  seed: number
  spikeWidth: number
  // the flame sphere
  planet: boolean
  planetX: number
  planetY: number
  planetRadius: number
  // the pointer
  parallax: number
  lens: number
  lensRadius: number
  lensPush: number
  rippleSpeed: number
  // post
  speed: number
  vignette: number
  grain: number
  /** Overall brightness. 1 is the hero. Lower is a quieter sky that sits behind content. */
  gain: number
  // palette, dark to bright
  voidColor: string
  hazeColor: string
  duskColor: string
  wineColor: string
  crimsonColor: string
  hotColor: string
  starColor: string
}

// The solar preset of the original, folded into the defaults and tuned for EMBER.
export const NEBULA_DEFAULTS: NebulaParams = {
  pixel: 6,
  dotMin: 0.12,
  dotMax: 0.56,
  levels: 7,

  scale: 1.7,
  warp: 1.9,
  drift: 0.035,
  density: 0.5,
  threshold: 0.54,
  softness: 0.5,
  band: 0.72,
  bandAngle: 0.4,
  bandOffset: 0.42,
  bandWidth: 0.34,
  haze: 0.8,

  stars: 1,
  twinkle: 1.4,
  starDrift: 1.2,
  sparkles: 7,
  seed: 5,
  spikeWidth: 1,

  planet: true,
  planetX: 0.76,
  planetY: 0.58,
  planetRadius: 0.13,

  parallax: 1,
  lens: 0.55,
  lensRadius: 170,
  lensPush: 0.3,
  rippleSpeed: 420,

  speed: 1,
  vignette: 0.5,
  grain: 0.035,
  gain: 1,

  ...NEBULA,
}

// The same sky behind the working screens: thinner gas, no flame, no sparks and less light,
// so the panels and the text over it stay easy to read. The pointer still parts the gas.
export const NEBULA_QUIET: Partial<NebulaParams> = {
  density: 0.44,
  band: 0.6,
  haze: 0.7,
  stars: 0.7,
  sparkles: 0,
  planet: false,
  lens: 0.7,
  lensRadius: 190,
  vignette: 0.25,
  grain: 0.02,
  gain: 0.45,
}

const MAX_SPARKS = 16
const MAX_RIPPLES = 4

type Kind = "f" | "i" | "b" | "c"
type Slot = [keyof NebulaParams, Kind]

/** Which parameters reach the shader, and as what. `c` is a hex colour. */
const UNIFORMS: Slot[] = [
  ["pixel", "f"], ["dotMin", "f"], ["dotMax", "f"], ["levels", "f"],
  ["scale", "f"], ["warp", "f"], ["drift", "f"], ["density", "f"],
  ["threshold", "f"], ["softness", "f"],
  ["band", "f"], ["bandAngle", "f"], ["bandOffset", "f"], ["bandWidth", "f"], ["haze", "f"],
  ["stars", "f"], ["twinkle", "f"], ["starDrift", "f"], ["spikeWidth", "f"],
  ["parallax", "f"], ["lens", "f"], ["lensRadius", "f"], ["lensPush", "f"], ["rippleSpeed", "f"],
  ["vignette", "f"], ["grain", "f"], ["gain", "f"],
  ["voidColor", "c"], ["hazeColor", "c"], ["duskColor", "c"], ["wineColor", "c"],
  ["crimsonColor", "c"], ["hotColor", "c"], ["starColor", "c"],
]

const uName = (k: string) => "u" + k[0].toUpperCase() + k.slice(1)
const glslType = (kind: Kind) => (kind === "c" ? "vec3" : kind === "i" || kind === "b" ? "int" : "float")
const declare = (slots: Slot[]) =>
  slots.map(([k, kind]) => "uniform " + glslType(kind) + " " + uName(k) + ";").join("\n")

const VERT = /* glsl */ `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform vec2 uLook;
uniform int uSparkCount;
uniform vec4 uSpark[${MAX_SPARKS}];
uniform vec4 uSparkB[${MAX_SPARKS}];
uniform vec4 uRipple[${MAX_RIPPLES}];
uniform vec4 uPlanet;
${declare(UNIFORMS)}
out vec4 frag;

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.96875;
}
float bayer4(vec2 c){
  vec2 m = mod(c, 4.0);
  int i = int(m.x) + int(m.y) * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(b[i]) + 0.5) / 16.0;
}
vec3 ramp(float d, vec3 haze){
  vec3 c = mix(uVoidColor, haze, smoothstep(0.0, 0.22, d));
  c = mix(c, uWineColor, smoothstep(0.18, 0.44, d));
  c = mix(c, uCrimsonColor, smoothstep(0.42, 0.72, d));
  return mix(c, uHotColor, smoothstep(0.7, 0.96, d));
}
vec2 shift(float depth){
  return floor(uLook * uParallax * depth * 28.0);
}

// Density of the gas at a CSS-pixel position: x = density, y = haze, z = tone.
vec3 field(vec2 pos, vec2 resCss){
  float minSide = min(resCss.x, resCss.y);
  vec2 uv = (pos - 0.5 * resCss) / minSide;
  vec2 p = uv * uScale + uLook * uParallax * 0.05;

  vec2 toP = pos - uPointer;
  float lamp = exp(-dot(toP, toP) / (uLensRadius * uLensRadius)) * uPointerOn;
  p += toP / minSide * lamp * uLensPush * uScale;

  float ring = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipple[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 2.4) continue;
    vec2 dv = pos - r.xy;
    float dist = length(dv);
    float w = 14.0 + age * 26.0;
    float k = exp(-pow((dist - age * uRippleSpeed) / w, 2.0)) * (1.0 - age / 2.4) * r.w;
    ring += k;
    p += dv / max(dist, 1.0) * k * 0.12;
  }

  float t = uTime * uDrift;
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.7)), fbm(p + vec2(5.2, 1.3) - t * 0.5));
  float n = fbm(p + uWarp * q + vec2(t * 0.4, -t * 0.25));

  vec2 dir = vec2(cos(uBandAngle), sin(uBandAngle));
  float along = dot(uv, dir);
  float across = dot(uv, vec2(-dir.y, dir.x)) - uBandOffset - 0.22 * sin(along * 2.3 + t * 3.0) - (q.x - 0.5) * 0.35;
  float river = exp(-across * across / (uBandWidth * uBandWidth));

  float raw = n + river * uBand * 0.5 + (uDensity - 0.5) * 0.5;
  float d = smoothstep(uThreshold, uThreshold + uSoftness, raw);
  d = clamp(d + lamp * uLens * 0.45 + ring * 0.55, 0.0, 1.0);

  for (int i = 0; i < ${MAX_SPARKS}; i++) {
    if (i >= uSparkCount) break;
    vec4 s = uSpark[i];
    vec4 b = uSparkB[i];
    float grow = smoothstep(0.0, 0.6, uTime - s.w);
    float dist = length(pos - s.xy - shift(1.2));
    d += exp(-dist / max(b.w * 2.2 * (1.0 + b.z * 0.6), 1.0)) * 0.55 * grow;
  }

  // The flame lights the gas around it.
  if (uPlanet.w > 0.5) {
    float pdist = length(pos - uPlanet.xy - shift(0.8));
    d += exp(-max(pdist - uPlanet.z, 0.0) / (uPlanet.z * 0.6)) * 0.42;
  }

  float hz = smoothstep(0.25, 0.75, n + river * 0.25) * uHaze;
  float tone = fbm(p * 0.45 + vec2(11.0, -3.0) + t * 0.2);
  return vec3(clamp(d, 0.0, 1.0), hz, tone);
}

void main(){
  vec2 resCss = uRes / uDpr;
  vec2 css = gl_FragCoord.xy / uDpr;
  float px = max(uPixel, 1.0);
  vec2 cell = floor(css / px);
  vec2 cellC = (cell + 0.5) * px;
  vec2 f = fract(css / px) - 0.5;
  float L = max(uLevels, 2.0);
  float dith = bayer4(cell);

  // ---- the gas, printed as a halftone ---------------------------------------
  vec3 g = field(cellC, resCss);
  vec3 hazeCol = mix(uHazeColor, uDuskColor, smoothstep(0.38, 0.62, g.z));
  float dq = clamp(floor(g.x * L + dith) / L, 0.0, 1.0);
  float hq = floor(g.y * 3.0 + dith) / 3.0;
  vec3 bg = mix(uVoidColor, hazeCol, hq * 0.7);
  bg = mix(bg, ramp(dq * 0.7, hazeCol) * 0.42, smoothstep(0.0, 0.3, dq));
  float r = mix(uDotMin, uDotMax, sqrt(dq));
  float dotMask = step(length(f), r);
  vec3 dotCol = dq < 0.01 ? mix(uVoidColor, hazeCol, 0.35 + hq * 0.5) : ramp(min(dq + 0.1, 1.0), hazeCol);
  vec3 col = mix(bg, dotCol, dotMask);

  // ---- pixel stars, three parallax depths ------------------------------------
  vec3 starAcc = vec3(0.0);
  float starA = 0.0;
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float depth = 0.3 + fl * 0.4;
    float gpx = px * (l == 2 ? 2.0 : 1.0);
    vec2 sp = css + shift(depth) + vec2(0.0, floor(uTime * uStarDrift * depth));
    vec2 id = floor(sp / gpx);
    vec2 fr = fract(sp / gpx) - 0.5;
    float prob = uStars * (l == 0 ? 0.009 : l == 1 ? 0.014 : 0.01);
    float h = hash12(id + fl * 71.3);
    if (h > 1.0 - prob) {
      float h2 = hash12(id * 1.7 + 3.1 + fl);
      float tw = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * uTwinkle * (0.6 + h2 * 2.5) + h2 * 40.0));
      float rad = l == 2 ? 0.42 : 0.26 + h2 * 0.22;
      float m = step(length(fr), rad);
      vec3 c = (l == 0 || h2 > 0.82) ? uStarColor : uHotColor;
      starAcc = max(starAcc, c * m * tw);
      starA = max(starA, m * tw);
    }
  }
  col = mix(col, starAcc / max(starA, 1e-3), starA * (1.0 - g.x * 0.55));

  // ---- the flame in freefall: a sphere of flame around a fuel droplet --------
  if (uPlanet.w > 0.5) {
    vec2 pc = uPlanet.xy + shift(0.8);
    float R = uPlanet.z;
    vec2 dc = cellC - pc;
    float rr = length(dc) / R;
    if (rr < 1.0) {
      vec2 n2 = dc / R;
      float z = sqrt(max(1.0 - rr * rr, 0.0));
      float shell = pow(1.0 - z, 1.5);
      float seethe = fbm(n2 * 2.6 + vec2(uTime * 0.06, -uTime * 0.09) + 9.0);
      float pd = clamp(0.3 + 0.62 * shell + (seethe - 0.5) * 0.4, 0.0, 1.0);
      pd *= 0.35 + 0.65 * smoothstep(0.12, 0.42, rr);
      float pq = floor(pd * L + dith) / L;
      vec3 pbg = mix(mix(uVoidColor, uWineColor, 0.4), uCrimsonColor, pq * 0.55);
      float pr = mix(0.2, 0.62, sqrt(pq));
      vec3 pdot = ramp(min(pq * 0.8 + 0.28, 1.0), hazeCol);
      col = mix(pbg, pdot, step(length(f), pr));
      if (rr < 0.15) col = mix(mix(uVoidColor, uHazeColor, 0.7), uStarColor, step(length(f), 0.36));
    }
  }

  // ---- sparkle stars: chunky core, needle spikes -----------------------------
  vec2 sh = shift(1.2);
  for (int i = 0; i < ${MAX_SPARKS}; i++) {
    if (i >= uSparkCount) break;
    vec4 s = uSpark[i];
    vec4 b = uSparkB[i];
    float age = uTime - s.w;
    if (age < 0.0) continue;
    float grow = smoothstep(0.0, 0.55, age) * (1.0 + 0.3 * exp(-age * 3.0) * sin(age * 13.0));
    float tw = 0.84 + 0.16 * sin(uTime * uTwinkle * 1.7 + b.y);
    float flare = 1.0 + b.z * 0.6;
    float reach = s.z * grow * tw * flare;
    float core = b.w * grow * flare;
    vec3 tint = mix(uHotColor, uStarColor, b.x);
    vec2 c = s.xy + sh;
    vec2 d = css - c;
    float th = uSpikeWidth * 0.5 + 0.25;
    float hx = step(abs(d.y), th) * pow(max(1.0 - abs(d.x) / max(reach, 1.0), 0.0), 1.1);
    float vy = step(abs(d.x), th) * pow(max(1.0 - abs(d.y) / max(reach, 1.0), 0.0), 1.1);
    // A short second pair of spikes, turned 45deg, only on the big ones.
    vec2 rd = vec2(d.x + d.y, d.x - d.y) * 0.7071;
    float diag = step(0.5, core / px - 1.5) * 0.45 * max(
      step(abs(rd.y), th) * pow(max(1.0 - abs(rd.x) / max(reach * 0.22, 1.0), 0.0), 2.0),
      step(abs(rd.x), th) * pow(max(1.0 - abs(rd.y) / max(reach * 0.22, 1.0), 0.0), 2.0));
    col = mix(col, tint, clamp(max(max(hx, vy), diag), 0.0, 1.0));
    // The core snaps to the cell grid, so it reads as a pixel-art disc.
    float hp = px * 0.5;
    vec2 dcell = (floor(css / hp) + 0.5) * hp - (floor(c / hp) + 0.5) * hp;
    float disc = step(length(dcell), core);
    float glow = exp(-length(d) / max(core * 1.4, 1.0)) * (1.0 - disc);
    col += tint * glow * 0.35;
    col = mix(col, tint, disc);
    float cross = max(step(abs(d.y), th) * step(abs(d.x), core * 0.85),
                      step(abs(d.x), th) * step(abs(d.y), core * 0.85));
    col = mix(col, uStarColor, cross * disc * 0.9);
  }

  // ---- post -----------------------------------------------------------------
  vec2 vu = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(vu * vec2(uRes.x / uRes.y, 1.0) * 1.1));
  col += (hash12(floor(css) + fract(uTime) * 91.0) - 0.5) * uGrain;
  frag = vec4(max(col, vec3(0.0)) * uGain, 1.0);
}`

/**
 * One sparkle star. Position is 0..1 of the box, with y up. `reach` and `core` are
 * fractions of the shorter side of the box, so the sky scales with its container.
 */
export type Sparkle = {
  x: number
  y: number
  reach: number
  core: number
  /** 0 = the accent colour, 1 = the pale star colour. */
  tint: number
  phase: number
  /** Seconds on the component clock when it was born. It grows in from there. */
  born: number
  user: boolean
}

// #region sky
/** A tiny seeded PRNG, so the same `seed` always hangs the same sky. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hang `count` sparkles. The first is the hero, with long spikes and a fat core in the
 * upper half. The second is the pale one. The rest are small and scattered. Placement
 * rejects anything too close to a star already hung, so the spikes never tangle.
 */
export function layoutSparkles(seed: number, count: number): Sparkle[] {
  const rand = mulberry32(seed)
  const out: Sparkle[] = []
  const n = Math.max(0, Math.min(Math.floor(count), MAX_SPARKS))
  for (let i = 0; i < n; i++) {
    const hero = i === 0
    const pale = i === 1
    let x = 0.5
    let y = 0.5
    for (let tries = 0; tries < 40; tries++) {
      x = 0.08 + 0.84 * rand()
      y = hero ? 0.58 + 0.28 * rand() : 0.08 + 0.84 * rand()
      const clear = out.every((s) => Math.hypot(s.x - x, s.y - y) > (hero ? 0.2 : 0.13))
      if (clear) break
    }
    out.push({
      x,
      y,
      reach: hero ? 0.2 + 0.05 * rand() : pale ? 0.08 + 0.03 * rand() : 0.025 + 0.055 * rand(),
      core: hero ? 0.024 : pale ? 0.011 : 0.004 + 0.006 * rand(),
      tint: pale ? 1 : 0,
      phase: rand() * 6.283,
      born: -10,
      user: false,
    })
  }
  return out
}

/**
 * Add a sparkle someone clicked into being. The seeded sky is never evicted.
 * Once the list is full the oldest user sparkle makes room.
 */
export function pushSparkle(list: Sparkle[], next: Sparkle, max = MAX_SPARKS): Sparkle[] {
  if (list.length < max) return [...list, next]
  const oldest = list.findIndex((s) => s.user)
  if (oldest === -1) return list
  return [...list.slice(0, oldest), ...list.slice(oldest + 1), next]
}

/**
 * Listen for clicks on the sky only while clicks are on. When they are off nothing is
 * attached, so a press anywhere on the page costs the sky no work at all.
 * Returns the function that takes the listener off again.
 */
export function bindSkyClicks(target: EventTarget, onDown: (e: PointerEvent) => void, on: boolean): () => void {
  if (!on) return () => {}
  const listener = onDown as EventListener
  target.addEventListener("pointerdown", listener)
  return () => target.removeEventListener("pointerdown", listener)
}

/** A hex colour, short or long, as [r, g, b] in 0..1. Anything unparsable is black. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0]
  const v = parseInt(h, 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

/** The idle lamp: wanders the sky on incommensurate sines, never closing a loop. */
export function driftPos(t: number) {
  const x = 0.5 + 0.32 * Math.sin(t * 0.21) + 0.1 * Math.sin(t * 0.077 + 1.3)
  const y = 0.5 + 0.26 * Math.cos(t * 0.17) + 0.12 * Math.cos(t * 0.053 + 4.2)
  return [Math.min(Math.max(x, 0.05), 0.95), Math.min(Math.max(y, 0.05), 0.95)]
}
// #endregion

/** What the sky shows, for a screen that presents it as a picture. */
export const SKY_LABEL = "A sky of ember-coloured gas printed in halftone dots, with a round flame in freefall"

export type HalftoneNebulaProps = {
  /** Explicit height. The canvas fills this box, so it must be a definite length. */
  height?: string
  /** Overrides layered over the defaults. */
  params?: Partial<NebulaParams>
  /** The pointer lights the gas and shifts the sky. A click drops a sparkle. */
  interactive?: boolean
  /** "scroll" keeps page scrolling on touch. "draw" takes the gesture. */
  touch?: "scroll" | "draw"
  /** Device-pixel-ratio cap. The shader is per-pixel, so 2 is plenty. */
  maxDpr?: number
  /** Frames per second cap. Unset follows the display. A capped sky also skips its turn when the page is busy. */
  maxFps?: number
  /** A click on the sky drops a sparkle and sends a ring through the gas. Off, the sky does not listen for clicks. */
  sparkOnClick?: boolean
  /**
   * The sky as the page background: fixed behind everything, the size of the window, hidden
   * from assistive technology, and lit by the pointer wherever it is on the page.
   */
  backdrop?: boolean
  /** Content laid over the sky. Pointer events pass through unless opted in. */
  children?: React.ReactNode
  className?: string
}

export default function HalftoneNebula({
  height = "100svh",
  params,
  interactive = true,
  touch = "scroll",
  maxDpr = 2,
  maxFps,
  sparkOnClick = true,
  backdrop = false,
  children,
  className = "",
}: HalftoneNebulaProps) {
  const rootRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = React.useState(false)
  const [generation, setGeneration] = React.useState(0)
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  // Explicit params are layered over the defaults.
  const P = React.useMemo<NebulaParams>(() => ({ ...NEBULA_DEFAULTS, ...(params ?? {}) }), [params])
  // The loop reads through a ref, so tuning a value never restarts WebGL.
  const paramsRef = React.useRef(P)
  paramsRef.current = P
  // The frame cap is read the same way, and the click listener is put on or taken off by an
  // effect of its own, so a route change never restarts WebGL.
  const capRef = React.useRef(maxFps)
  capRef.current = maxFps
  const sparkRef = React.useRef(sparkOnClick)
  sparkRef.current = sparkOnClick
  const clicksRef = React.useRef<((on: boolean) => void) | null>(null)
  // Under reduced motion nothing loops, so a change of parameters asks for one new still frame.
  const repaintRef = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    repaintRef.current?.()
  }, [P])

  React.useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: "high-performance",
    })
    if (!gl) {
      setFailed(true)
      return
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("halftone-nebula:", gl.getShaderInfoLog(s))
        gl.deleteShader(s)
        return null
      }
      return s
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    const program = vs && fs ? gl.createProgram() : null
    if (!program || !vs || !fs) {
      setFailed(true)
      return
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("halftone-nebula:", gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      setFailed(true)
      return
    }

    // Colours are parsed once for each value, not on every frame.
    const parsed = new Map<string, [number, number, number]>()
    const rgb = (hex: string) => {
      let v = parsed.get(hex)
      if (!v) {
        v = hexToRgb(hex)
        parsed.set(hex, v)
      }
      return v
    }
    const loc = (n: string) => gl.getUniformLocation(program, n)
    const tuned = UNIFORMS.map(([k, kind]) => [loc(uName(k)), k, kind] as const)
    const U = {
      res: loc("uRes"), dpr: loc("uDpr"), time: loc("uTime"),
      pointer: loc("uPointer"), pointerOn: loc("uPointerOn"), look: loc("uLook"),
      sparkCount: loc("uSparkCount"), spark: loc("uSpark"), sparkB: loc("uSparkB"),
      ripple: loc("uRipple"), planet: loc("uPlanet"),
    }
    const vao = gl.createVertexArray()

    // ---- sizing, from the element rather than the window --------------------
    let cssW = 1
    let cssH = 1
    let dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, Math.max(maxDpr, 0.5))
      cssW = Math.max(canvas.clientWidth, 1)
      cssH = Math.max(canvas.clientHeight, 1)
      const w = Math.floor(cssW * dpr)
      const h = Math.floor(cssH * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      if (reduced) paint()
    }

    // ---- the sky ------------------------------------------------------------
    let sparks = layoutSparkles(paramsRef.current.seed, paramsRef.current.sparkles)
    let laidOut = paramsRef.current.seed + ":" + paramsRef.current.sparkles
    const flare = new Float32Array(MAX_SPARKS)
    const sparkA = new Float32Array(MAX_SPARKS * 4)
    const sparkB = new Float32Array(MAX_SPARKS * 4)
    const ripples = new Float32Array(MAX_RIPPLES * 4)
    let rippleNext = 0

    // Reduced motion freezes the clock on a frame that is already lit.
    const FROZEN = 14
    const t0 = performance.now()
    const clock = () => (reduced ? FROZEN : ((performance.now() - t0) / 1000) * paramsRef.current.speed)
    let lastClock = 0

    // ---- the pointer --------------------------------------------------------
    let targetX = 0.5
    let targetY = 0.5
    let lampX = 0.5
    let lampY = 0.5
    let lookX = 0
    let lookY = 0
    let lampOn = 0
    let inside = false
    let lastTouched = -1e9

    const toUv = (e: PointerEvent): [number, number] => {
      // The backdrop fills the window, so its box is known without asking the page to lay out.
      if (backdrop) {
        return [Math.min(Math.max(e.clientX / cssW, 0), 1), Math.min(Math.max(1 - e.clientY / cssH, 0), 1)]
      }
      const r = canvas.getBoundingClientRect()
      return [
        Math.min(Math.max((e.clientX - r.left) / Math.max(r.width, 1), 0), 1),
        Math.min(Math.max(1 - (e.clientY - r.top) / Math.max(r.height, 1), 0), 1),
      ]
    }
    const onMove = (e: PointerEvent) => {
      if (!interactive) return
      ;[targetX, targetY] = toUv(e)
      inside = true
      lastTouched = performance.now() / 1000
    }
    const onLeave = () => {
      inside = false
    }
    const onDown = (e: PointerEvent) => {
      if (!interactive || e.button > 0) return
      // Let buttons and links in the overlay keep their clicks.
      if ((e.target as HTMLElement | null)?.closest("a,button,input,textarea,select,label,[role=button]")) return
      const [x, y] = toUv(e)
      targetX = x
      targetY = y
      inside = true
      lastTouched = performance.now() / 1000
      const now = clock()
      const rand = Math.random()
      sparks = pushSparkle(sparks, {
        x, y,
        reach: 0.045 + 0.08 * rand,
        core: 0.006 + 0.008 * rand,
        tint: Math.random() < 0.2 ? 1 : 0,
        phase: Math.random() * 6.283,
        born: reduced ? now - 10 : now,
        user: true,
      })
      ripples.set([x * cssW, y * cssH, now, reduced ? 0 : 1], rippleNext * 4)
      rippleNext = (rippleNext + 1) % MAX_RIPPLES
      if (reduced) paint()
    }

    // As a backdrop the sky sits behind the page, so it listens to the whole window.
    const host: HTMLElement | Window = backdrop ? window : root
    const edge: HTMLElement = backdrop ? document.documentElement : root
    host.addEventListener("pointermove", onMove as EventListener)
    let unbindClicks = () => {}
    const bindClicks = (on: boolean) => {
      unbindClicks()
      unbindClicks = bindSkyClicks(host, onDown, on)
    }
    bindClicks(sparkRef.current)
    clicksRef.current = bindClicks
    edge.addEventListener("pointerleave", onLeave)
    host.addEventListener("pointercancel", onLeave)

    const onLost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
      raf = 0
    }
    const onRestored = () => setGeneration((g) => g + 1)
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)

    // The numbers the shader is drawing with right now. They glide toward the parameters, so
    // the sky changes smoothly when one screen hands over to another.
    const live: Partial<Record<keyof NebulaParams, number>> = {}

    // ---- one frame ----------------------------------------------------------
    const paint = () => {
      const p = paramsRef.current
      const t = clock()
      const dt = Math.min(Math.max(t - lastClock, 0), 0.1)
      lastClock = t
      const key = p.seed + ":" + p.sparkles
      if (key !== laidOut) {
        // Sparks hung after the first sky grow in, as a clicked one does.
        const fresh = layoutSparkles(p.seed, p.sparkles).map((s) => ({ ...s, born: reduced ? s.born : t }))
        sparks = [...fresh, ...sparks.filter((s) => s.user)].slice(0, MAX_SPARKS)
        laidOut = key
      }
      const glide = reduced ? 1 : 1 - Math.exp(-dt * 5)

      // With no hand on it, the lamp wanders on its own, so the sky never sits dead.
      const idle = !inside || performance.now() / 1000 - lastTouched > 6
      const [gx, gy] = driftPos(t * 0.6)
      const wantX = idle ? gx : targetX
      const wantY = idle ? gy : targetY
      const k = reduced ? 1 : 1 - Math.exp(-dt * (idle ? 1.5 : 7))
      lampX += (wantX - lampX) * k
      lampY += (wantY - lampY) * k
      lookX += ((wantX - 0.5) * 2 - lookX) * k
      lookY += ((wantY - 0.5) * 2 - lookY) * k
      const onTarget = interactive && !reduced ? (idle ? 0.55 : 1) : 0
      lampOn += (onTarget - lampOn) * (reduced ? 1 : 1 - Math.exp(-dt * 3))

      const minSide = Math.min(cssW, cssH)
      const n = Math.min(sparks.length, MAX_SPARKS)
      for (let i = 0; i < n; i++) {
        const s = sparks[i]
        const reach = s.reach * minSide
        const d = Math.hypot(s.x * cssW - lampX * cssW, s.y * cssH - lampY * cssH)
        const want = interactive && !reduced ? Math.exp(-(d * d) / Math.max(reach * reach * 0.6, 400)) : 0
        flare[i] += (want - flare[i]) * (reduced ? 1 : 1 - Math.exp(-dt * 6))
        sparkA.set([s.x * cssW, s.y * cssH, reach, s.born], i * 4)
        sparkB.set([s.tint, s.phase, flare[i], Math.max(s.core * minSide, 1.5)], i * 4)
      }

      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      for (const [l, key, kind] of tuned) {
        const v = p[key]
        if (kind === "c") gl.uniform3fv(l, rgb(v as string))
        else if (kind === "i" || kind === "b") gl.uniform1i(l, Number(v) | 0)
        else {
          const from = live[key] ?? (v as number)
          const now = from + ((v as number) - from) * glide
          live[key] = now
          gl.uniform1f(l, now)
        }
      }
      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.dpr, canvas.width / cssW)
      gl.uniform1f(U.time, t)
      gl.uniform2f(U.pointer, lampX * cssW, lampY * cssH)
      gl.uniform1f(U.pointerOn, lampOn)
      gl.uniform2f(U.look, lookX, lookY)
      gl.uniform1i(U.sparkCount, n)
      gl.uniform4fv(U.spark, sparkA)
      gl.uniform4fv(U.sparkB, sparkB)
      gl.uniform4fv(U.ripple, ripples)
      gl.uniform4f(U.planet, p.planetX * cssW, p.planetY * cssH, p.planetRadius * minSide, p.planet ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    // ---- loop, paused whenever nobody can see it -----------------------------
    let raf = 0
    let visible = true
    let lastFrame = 0
    let lastPaint = 0
    const frame = (now: number) => {
      raf = 0
      const cap = capRef.current
      const gap = now - lastFrame
      const since = now - lastPaint
      lastFrame = now
      // A capped sky paints at most that many times a second. It also gives way: when the
      // frame before this one ran long, the page is busy, so the sky skips its turn. It never
      // waits more than half a second for that, so on a slow machine it slows down and does
      // not stop.
      const due = !cap || since >= 1000 / cap - 2
      const busy = Boolean(cap) && gap > 30 && since < 500
      if (due && !busy) {
        paint()
        lastPaint = now
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const wake = () => {
      if (!reduced && !raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting)
      wake()
    })
    io.observe(root)
    document.addEventListener("visibilitychange", wake)

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Paint before the first rAF so nothing ever flashes an empty canvas.
    paint()
    repaintRef.current = () => {
      if (reduced) paint()
    }
    if (reduced) {
      // Nothing moves. One frame is the whole piece.
    } else {
      wake()
    }

    return () => {
      cancelAnimationFrame(raf)
      repaintRef.current = null
      observer.disconnect()
      io.disconnect()
      document.removeEventListener("visibilitychange", wake)
      host.removeEventListener("pointermove", onMove as EventListener)
      unbindClicks()
      clicksRef.current = null
      edge.removeEventListener("pointerleave", onLeave)
      host.removeEventListener("pointercancel", onLeave)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
    }
  }, [interactive, reduced, generation, maxDpr, backdrop])

  // Clicks are switched without touching WebGL: the hero turns them on, every other screen off.
  React.useEffect(() => {
    clicksRef.current?.(sparkOnClick)
  }, [sparkOnClick])

  return (
    <section
      ref={rootRef}
      className={
        "overflow-hidden bg-hero-void " +
        (backdrop
          ? "no-print pointer-events-none fixed inset-0 -z-10 "
          : "relative w-full " + (interactive ? "cursor-crosshair " : "") + (touch === "draw" ? "touch-none " : "touch-pan-y ")) +
        className
      }
      style={backdrop ? undefined : { height }}
      aria-hidden={backdrop ? true : undefined}
      aria-label={backdrop ? undefined : SKY_LABEL}
    >
      {failed ? (
        // No WebGL2: a still picture of the same sky beats a black box.
        <div
          className="absolute inset-0"
          style={{
            opacity: P.gain,
            background:
              `radial-gradient(60% 45% at 12% 88%, ${P.hotColor} 0%, ${P.crimsonColor} 22%, ${P.wineColor} 50%, transparent 75%),` +
              `radial-gradient(45% 30% at 22% 22%, ${P.wineColor} 0%, transparent 70%),` +
              `radial-gradient(40% 30% at 80% 30%, ${P.duskColor} 0%, transparent 70%),` +
              P.voidColor,
          }}
        />
      ) : (
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      )}
      {children ? (
        <div className="pointer-events-none relative z-10 flex h-full w-full flex-col">{children}</div>
      ) : null}
    </section>
  )
}
