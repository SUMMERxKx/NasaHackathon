// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The live fireball. Plain three.js in one component, with no model files.
// What it draws is an SI-generated illustration. The stage around it always shows that label.
// Three nested shells with flowing noise seethe in place, because in freefall there is no up.
// The Earth flame is the same shader stretched into a teardrop with the noise streaming upward.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { DropletState, FlameView } from '../components/FireballStage.tsx'
import type { FlameInputs, FlameParams } from './flameParams.ts'
import { CAMERA, SCENE, rampBytes, rampColorAt } from './ramp.ts'

export type FireballProps = { params: FlameParams; view: FlameView; droplet: DropletState; showEarth: boolean; onFail: () => void }

const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`

const FLAME_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uVigor;
uniform float uUp;
uniform float uStretch;
uniform float uSeed;
uniform float uAmp;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;
${NOISE}
void main() {
  vec3 p = position;
  float speed = 0.22 + uVigor * 0.85;
  // In freefall the noise drifts with no preferred direction. On Earth it streams upward.
  vec3 drift = uUp > 0.5 ? vec3(0.0, -2.6, 0.0) : vec3(0.31, 0.17, -0.23);
  float n = fbm(normalize(position) * 2.1 + drift * uTime * speed + uSeed);
  p *= 1.0 + 0.02 * sin(uTime * 0.9 + uSeed);
  p += normal * (n - 0.5) * uAmp * (0.55 + uVigor);
  vHeight = 0.0;
  if (uUp > 0.5) {
    float h = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
    p.xz *= mix(1.0, 0.06, pow(h, 1.35));
    p.y = p.y * 1.9 + 0.75;
    p.x += 0.05 * sin(uTime * 7.0 + p.y * 4.0) * h;
    vHeight = h;
  } else {
    // Ventilation flow leans and stretches the fireball downwind.
    p.x += uStretch * (0.25 + max(0.0, p.x) * 1.1);
  }
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const FLAME_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uRamp;
uniform float uTime;
uniform float uVigor;
uniform float uTempTop;
uniform float uBaseT;
uniform float uRimMix;
uniform float uAlpha;
uniform float uEnvelope;
uniform float uView;
uniform float uSoot;
uniform float uUp;
uniform float uSeed;
uniform vec3 uCamDeep;
uniform vec3 uCamBlue;
uniform vec3 uCamPale;
uniform vec3 uCamSoot;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;
${NOISE}
void main() {
  float ndv = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - ndv, 2.2);
  float body = pow(ndv, 1.4);
  float speed = 0.22 + uVigor * 0.85;
  vec3 drift = uUp > 0.5 ? vec3(0.0, -2.6, 0.0) : vec3(-0.27, 0.21, 0.19);
  float n = fbm(vPos * 2.6 + drift * uTime * speed + uSeed * 1.7);
  float shape = mix(body, rim, uRimMix);
  float a = shape * (0.5 + 1.0 * n) * uAlpha * uEnvelope;
  // A temperature value from 0 to 1, looked up in the shared ramp. The pattern is drawn, not computed.
  float t = clamp(uBaseT * uTempTop * (0.72 + 0.56 * n), 0.0, 1.0);
  if (uUp > 0.5) t *= mix(1.0, 0.72, vHeight);
  vec3 heat = texture2D(uRamp, vec2(t, 0.5)).rgb;
  vec3 cam = mix(uCamDeep, uCamBlue, smoothstep(0.1, 0.6, t));
  cam = mix(cam, uCamPale, smoothstep(0.55, 1.0, t) * 0.7);
  cam = mix(cam, uCamSoot, uSoot * body * 0.55);
  vec3 col = mix(heat, cam * 0.8, uView);
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}
`

const GLOW_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.4) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}
`

const UV_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const DROPLET_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float ndv = max(0.0, dot(normalize(vNormal), normalize(vView)));
  float fresnel = pow(1.0 - ndv, 2.0);
  vec3 col = uColor * (0.25 + 0.9 * fresnel) + vec3(0.9) * pow(ndv, 22.0) * 0.6;
  gl_FragColor = vec4(col, (0.55 + 0.45 * fresnel) * uOpacity);
  #include <colorspace_fragment>
}
`

const NORMAL_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

// The haze of gas and the flow tracers. More points at higher pressure.
// A share of them glow as oxygen, in proportion to the oxygen fraction. Both are by definition.
const HAZE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uFlow;
uniform float uOxygenShare;
uniform float uScale;
attribute float aRand;
attribute float aTracer;
varying float vOxygen;
varying float vTracer;
void main() {
  vec3 p = position;
  float span = 7.0;
  float speed = aTracer > 0.5 ? uFlow * 2.4 : 0.02 + uFlow * 0.25;
  p.x = mod(p.x + uTime * speed + span * 0.5, span) - span * 0.5;
  p.y += sin(uTime * 0.25 + aRand * 40.0) * 0.05;
  vOxygen = step(aRand, uOxygenShare);
  vTracer = aTracer;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (aTracer > 0.5 ? 2.6 : 1.5 + vOxygen * 0.7) * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const HAZE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uHaze;
uniform vec3 uOxygen;
uniform float uFlow;
varying float vOxygen;
varying float vTracer;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 1.6);
  vec3 col = mix(uHaze, uOxygen, vOxygen);
  float strength = vTracer > 0.5 ? 0.6 * step(0.02, uFlow) : mix(0.16, 0.42, vOxygen);
  gl_FragColor = vec4(col * a * strength, a * strength);
  #include <colorspace_fragment>
}
`

const HAZE_COUNT = 520
const TRACER_COUNT = 60

type Tier = 'high' | 'medium' | 'low'

export default function Fireball({ params, view, droplet, showEarth, onFail }: FireballProps) {
  const mount = useRef<HTMLDivElement>(null)
  const latest = useRef({ params, view, droplet, showEarth, onFail })
  latest.current = { params, view, droplet, showEarth, onFail }

  useEffect(() => {
    const node = mount.current
    if (!node) return
    const probe = document.createElement('canvas')
    if (!probe.getContext('webgl2')) {
      latest.current.onFail()
      return
    }
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      latest.current.onFail()
      return
    }
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item)
      return item
    }
    renderer.setClearColor(new THREE.Color(CAMERA.deep), 1)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    node.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1.5, 0.1, 50)
    camera.position.set(0, 0, 6.4)

    const ramp = track(new THREE.DataTexture(rampBytes(256), 256, 1, THREE.RGBAFormat))
    ramp.magFilter = THREE.LinearFilter
    ramp.minFilter = THREE.LinearFilter
    ramp.colorSpace = THREE.SRGBColorSpace
    ramp.needsUpdate = true

    const camColors = {
      uCamDeep: { value: new THREE.Color(CAMERA.deep) },
      uCamBlue: { value: new THREE.Color(CAMERA.blue) },
      uCamPale: { value: new THREE.Color(CAMERA.pale) },
      uCamSoot: { value: new THREE.Color(CAMERA.soot) },
    }
    const sphere = track(new THREE.SphereGeometry(1, 72, 48))
    type Shell = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; base: number }
    const makeShell = (radius: number, baseT: number, rimMix: number, alpha: number, amp: number, seed: number, up: boolean): Shell => {
      const material = track(
        new THREE.ShaderMaterial({
          vertexShader: FLAME_VERTEX,
          fragmentShader: FLAME_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: {
            uRamp: { value: ramp },
            uTime: { value: 0 },
            uVigor: { value: 0.4 },
            uTempTop: { value: 0.74 },
            uBaseT: { value: baseT },
            uRimMix: { value: rimMix },
            uAlpha: { value: alpha },
            uEnvelope: { value: 1 },
            uView: { value: 0 },
            uSoot: { value: 0.2 },
            uUp: { value: up ? 1 : 0 },
            uStretch: { value: 0 },
            uSeed: { value: seed },
            uAmp: { value: amp },
            ...camColors,
          },
        }),
      )
      const mesh = new THREE.Mesh(sphere, material)
      mesh.scale.setScalar(radius)
      return { mesh, material, base: radius }
    }

    // Three nested shells. The middle shell is the flame sheet and is the hottest.
    const ball = new THREE.Group()
    const shells: Shell[] = [makeShell(0.66, 0.7, 0.1, 0.85, 0.1, 1.3, false), makeShell(1.0, 1.0, 0.62, 1.35, 0.15, 4.1, false), makeShell(1.28, 0.55, 0.85, 0.8, 0.22, 8.7, false)]
    for (const shell of shells) ball.add(shell.mesh)
    const glowGeometry = track(new THREE.PlaneGeometry(1, 1))
    const makeGlow = (size: number) => {
      const material = track(
        new THREE.ShaderMaterial({
          vertexShader: UV_VERTEX,
          fragmentShader: GLOW_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color(CAMERA.blue) }, uStrength: { value: 0.3 } },
        }),
      )
      const mesh = new THREE.Mesh(glowGeometry, material)
      mesh.scale.setScalar(size)
      mesh.position.z = -0.6
      return { mesh, material }
    }
    const ballGlow = makeGlow(5.2)
    ball.add(ballGlow.mesh)
    const dropletMaterial = track(
      new THREE.ShaderMaterial({ vertexShader: NORMAL_VERTEX, fragmentShader: DROPLET_FRAGMENT, transparent: true, uniforms: { uColor: { value: new THREE.Color(SCENE.droplet) }, uOpacity: { value: 1 } } }),
    )
    const dropletMesh = new THREE.Mesh(sphere, dropletMaterial)
    dropletMesh.scale.setScalar(0.15)
    ball.add(dropletMesh)
    // The ghost: a faint outline with no heat map, for an atmosphere where no droplet was ever burned.
    const ghostMaterial = track(new THREE.LineDashedMaterial({ color: new THREE.Color(SCENE.haze), dashSize: 0.09, gapSize: 0.09, transparent: true, opacity: 0 }))
    const ringPoints: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i += 1) ringPoints.push(new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), Math.sin((i / 96) * Math.PI * 2), 0))
    const ghostGeometry = track(new THREE.BufferGeometry().setFromPoints(ringPoints))
    const ghost = new THREE.Line(ghostGeometry, ghostMaterial)
    ghost.computeLineDistances()
    ball.add(ghost)
    scene.add(ball)

    // The Earth flame, with a candle under it, for contrast.
    const earth = new THREE.Group()
    const earthShells: Shell[] = [makeShell(0.4, 1.0, 0.2, 1.6, 0.1, 2.2, true), makeShell(0.58, 0.62, 0.7, 0.9, 0.14, 6.4, true)]
    for (const shell of earthShells) earth.add(shell.mesh)
    const earthGlow = makeGlow(3.4)
    earthGlow.mesh.position.y = 1.0
    earth.add(earthGlow.mesh)
    const candleMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(SCENE.candle).multiplyScalar(0.55) }))
    const candle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 20)), candleMaterial)
    candle.position.y = -0.48
    const wick = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(SCENE.wick) })))
    wick.position.y = 0.02
    earth.add(candle, wick)
    scene.add(earth)

    // The haze of gas and the flow tracers.
    const total = HAZE_COUNT + TRACER_COUNT
    const positions = new Float32Array(total * 3)
    const rands = new Float32Array(total)
    const tracers = new Float32Array(total)
    let seed = 12345
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let i = 0; i < total; i += 1) {
      positions[i * 3] = (random() - 0.5) * 7
      positions[i * 3 + 1] = (random() - 0.5) * 3.6
      positions[i * 3 + 2] = (random() - 0.5) * 3.0 - 0.3
      rands[i] = random()
      tracers[i] = i >= HAZE_COUNT ? 1 : 0
    }
    const hazeGeometry = track(new THREE.BufferGeometry())
    hazeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    hazeGeometry.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
    hazeGeometry.setAttribute('aTracer', new THREE.BufferAttribute(tracers, 1))
    const hazeMaterial = track(
      new THREE.ShaderMaterial({
        vertexShader: HAZE_VERTEX,
        fragmentShader: HAZE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uFlow: { value: 0.4 }, uOxygenShare: { value: 0.21 }, uScale: { value: 60 }, uHaze: { value: new THREE.Color(SCENE.haze) }, uOxygen: { value: new THREE.Color(SCENE.oxygen) } },
      }),
    )
    const haze = new THREE.Points(hazeGeometry, hazeMaterial)
    haze.frustumCulled = false
    const tracerGeometry = track(hazeGeometry.clone())
    tracerGeometry.setDrawRange(HAZE_COUNT, TRACER_COUNT)
    const tracerPoints = new THREE.Points(tracerGeometry, hazeMaterial)
    tracerPoints.frustumCulled = false
    scene.add(haze, tracerPoints)

    // A simple habitat module made in code: a cylinder with a wedge cut away, a hatch ring and a few racks.
    // It carries one tint, because the coverage score is per habitat and not per room.
    const module = new THREE.Group()
    const tint = new THREE.Color(SCENE.module)
    const lineMaterial = track(new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.13 }))
    const hull = track(new THREE.CylinderGeometry(2.25, 2.25, 8.4, 28, 4, true, Math.PI * 0.62, Math.PI * 1.5))
    const hullMesh = new THREE.Mesh(hull, track(new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false })))
    hullMesh.rotation.z = Math.PI / 2
    const hullLines = new THREE.LineSegments(track(new THREE.EdgesGeometry(hull, 12)), lineMaterial)
    hullLines.rotation.z = Math.PI / 2
    module.add(hullMesh, hullLines)
    const hatchGeometry = track(new THREE.TorusGeometry(0.85, 0.07, 8, 40))
    const hatch = new THREE.Mesh(hatchGeometry, track(new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.16 })))
    hatch.rotation.y = Math.PI / 2
    hatch.position.x = -3.6
    module.add(hatch)
    const rackGeometry = track(new THREE.BoxGeometry(0.8, 1.1, 0.4))
    const rackEdges = track(new THREE.EdgesGeometry(rackGeometry))
    for (let i = 0; i < 5; i += 1) {
      const rack = new THREE.LineSegments(rackEdges, lineMaterial)
      rack.position.set(-2.7 + i * 1.35, -0.75, -1.85)
      module.add(rack)
    }
    module.position.z = -0.6
    scene.add(module)

    // Quality tiers, chosen by measuring frame time and not by guessing the device.
    let tier: Tier = 'medium'
    let composer: EffectComposer | null = null
    let bloom: UnrealBloomPass | null = null
    const applyTier = () => {
      const cap = tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
      shells[0].mesh.visible = tier !== 'low'
      shells[2].mesh.visible = tier !== 'low'
      earthShells[1].mesh.visible = tier !== 'low'
      haze.visible = tier !== 'low'
      tracerPoints.visible = tier !== 'low'
      if (tier === 'high' && !composer) {
        composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.7, 0.2)
        composer.addPass(bloom)
        composer.addPass(new OutputPass())
      }
      resize()
    }
    const resize = () => {
      const width = Math.max(1, Math.min(720, node.clientWidth))
      const height = Math.max(1, Math.min(480, node.clientHeight))
      renderer.setSize(width, height, false)
      composer?.setSize(width, height)
      camera.aspect = node.clientWidth / Math.max(1, node.clientHeight)
      camera.updateProjectionMatrix()
      hazeMaterial.uniforms.uScale.value = height * 0.16 * renderer.getPixelRatio()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(node)
    applyTier()

    const current: FlameInputs = { ...latest.current.params.inputs }
    let viewMix = latest.current.view === 'camera' ? 1 : 0
    let shapeMix = latest.current.params.shape === 'earth' ? 1 : 0
    let ghostMix = latest.current.params.ghost ? 1 : 0
    let flameOn = 1
    let dropletScale = 1
    let frame = 0
    let last = performance.now()
    let clock = 0
    let running = true
    const samples: number[] = []
    let lowStrikes = 0
    const tmp = new THREE.Color()

    const onVisibility = () => {
      running = !document.hidden
      if (running) {
        last = performance.now()
        frame = requestAnimationFrame(loop)
      } else cancelAnimationFrame(frame)
    }
    const onLost = (event: Event) => {
      event.preventDefault()
      running = false
      latest.current.onFail()
    }
    renderer.domElement.addEventListener('webglcontextlost', onLost)
    document.addEventListener('visibilitychange', onVisibility)

    function loop(now: number) {
      if (!running) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      clock += dt
      const state = latest.current
      const target = state.params.inputs
      // Each input glides to its new value over about 400 ms, so the fireball settles and never jumps.
      const k = 1 - Math.exp(-dt / 0.13)
      for (const key of Object.keys(current) as (keyof FlameInputs)[]) current[key] += (target[key] - current[key]) * k
      viewMix += ((state.view === 'camera' ? 1 : 0) - viewMix) * k
      shapeMix += ((state.params.shape === 'earth' ? 1 : 0) - shapeMix) * k
      ghostMix += ((state.params.ghost ? 1 : 0) - ghostMix) * k
      flameOn += ((state.droplet && !state.droplet.flameOn ? 0 : 1) - flameOn) * k
      dropletScale += ((state.droplet ? state.droplet.scale : 1) - dropletScale) * Math.min(1, k * 3)

      // Whether the flame holds, struggles or goes out, from the share of nearby tests that ended in extinction.
      const flicker = 1 + 0.05 * Math.sin(clock * 11.0) * Math.sin(clock * 3.7)
      let envelope = flicker
      let size = 1
      if (state.params.steadiness === 'struggling') {
        envelope *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 1.4))
      } else if (state.params.steadiness === 'failing') {
        const phase = (clock % 5.2) / 5.2
        const lit = phase < 0.12 ? phase / 0.12 : phase < 0.62 ? 1 - ((phase - 0.12) / 0.5) * 0.55 : phase < 0.75 ? 0.45 * (1 - (phase - 0.62) / 0.13) : 0
        envelope *= lit
        size = phase < 0.62 ? 1 - Math.max(0, (phase - 0.12) / 0.5) * 0.35 : 0.65
      }
      const solid = (1 - ghostMix) * (0.35 + 0.65 * current.evidence) * flameOn
      const ballShown = 1 - shapeMix
      const layout = state.showEarth ? 1 : 0

      ball.position.x = layout * 1.05
      ball.scale.setScalar((0.86 + 0.14 * ballShown) * (layout ? 1 : 1.12))
      ball.visible = ballShown > 0.02
      for (const shell of shells) {
        const u = shell.material.uniforms
        u.uTime.value = clock
        u.uVigor.value = current.vigor
        u.uTempTop.value = current.tempTop
        u.uEnvelope.value = envelope * solid * ballShown
        u.uView.value = viewMix
        u.uSoot.value = current.soot
        u.uStretch.value = current.stretch
        shell.mesh.scale.setScalar(shell.base * size)
      }
      ramp.needsUpdate = false
      tmp.set(CAMERA.blue)
      // The glow takes its colour from the same ramp as the shells.
      const [gr, gg, gb] = rampColorAt(current.tempTop * 0.78)
      ballGlow.material.uniforms.uColor.value.setRGB(gr / 255, gg / 255, gb / 255).lerp(tmp, viewMix)
      ballGlow.material.uniforms.uStrength.value = 0.55 * envelope * solid * ballShown
      dropletMesh.scale.setScalar(Math.max(0.012, 0.15 * dropletScale))
      dropletMaterial.uniforms.uOpacity.value = 0.35 + 0.65 * (1 - ghostMix)
      ghost.scale.setScalar(1.05)
      ghostMaterial.opacity = 0.75 * ghostMix * ballShown

      const earthScale = layout ? 0.5 + 0.5 * shapeMix : 0.001
      earth.visible = layout === 1
      earth.position.set(-2.15 + 2.6 * shapeMix, -0.75 - 0.25 * shapeMix, 0)
      earth.scale.setScalar(earthScale)
      for (const shell of earthShells) {
        const u = shell.material.uniforms
        u.uTime.value = clock
        u.uVigor.value = 0.5
        u.uTempTop.value = 0.78
        u.uEnvelope.value = flicker
        u.uView.value = viewMix
        u.uSoot.value = 0.9
      }
      const [er, eg, eb] = rampColorAt(0.66)
      earthGlow.material.uniforms.uColor.value.setRGB(er / 255, eg / 255, eb / 255).lerp(tmp.set(CAMERA.soot), viewMix)
      earthGlow.material.uniforms.uStrength.value = 0.22 * flicker

      hazeMaterial.uniforms.uTime.value = clock
      hazeMaterial.uniforms.uFlow.value = current.flow
      hazeMaterial.uniforms.uOxygenShare.value = current.oxygenShare
      hazeGeometry.setDrawRange(0, Math.round(HAZE_COUNT * (0.12 + 0.88 * current.density)))
      module.visible = layout === 1 && tier !== 'low'
      module.rotation.y = Math.sin(clock * 0.07) * 0.05

      if (composer && tier === 'high') composer.render()
      else renderer.render(scene, camera)

      // Measure the frame time and step down through the tiers to the poster if needed.
      samples.push(dt * 1000)
      if (samples.length === 60) {
        const sorted = [...samples].sort((a, b) => a - b)
        const p95 = sorted[56]
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length
        samples.length = 0
        if (tier === 'medium' && p95 < 12 && lowStrikes === 0) {
          tier = 'high'
          applyTier()
        } else if (tier !== 'low' && mean > 25) {
          lowStrikes += 1
          tier = tier === 'high' ? 'medium' : 'low'
          applyTier()
        } else if (tier === 'low' && mean > 33) {
          running = false
          state.onFail()
          return
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      composer?.dispose()
      bloom?.dispose()
      for (const item of disposables) item.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={mount} className="absolute inset-0" data-fireball="live" />
}
