// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The habitat and the NASA tables in, the shader inputs and the readout out. A pure function.
// Every change on screen has one of three bases: from the NASA tables, a direction from a NASA
// source, or by definition. The readout beside the fireball says which.
import type { Scenario, Test } from '../types.ts'
import { scenarioPoint } from '../lib/coverage.ts'
import { flameLookup } from '../lib/flame.ts'
import type { FlameLookup } from '../lib/flame.ts'
import { atmToPsi } from '../lib/units.ts'
import { kelvinToT } from './ramp.ts'

// Two gates wait on a human check by the science lead. Flip each to true once it is confirmed.
export const GATES = {
  // The ACME column headed "Tad (K)" is the adiabatic flame temperature. Until this is confirmed
  // from the PSI record or its publication, the mark on the temperature scale does not move.
  tadConfirmed: false,
  // The FLEX burning rate column is in mm² per second. Until this is confirmed from the
  // publication, the droplet in the Lab is not animated.
  burningRateUnitConfirmed: false,
}

export type Steadiness = 'steady' | 'struggling' | 'failing'

export type FlameInputs = {
  vigor: number // how fast it seethes, from the median FLEX burning rate. 0.3 is calm, 0.75 is fierce.
  tempTop: number // how hot the brightest part is, 0 to 1 on the ramp, from the listed ACME flame temperature
  stability: number // 1 holds, 0 goes out, from the share of nearby FLEX tests that ended in extinction
  soot: number // camera view only: how yellow against how blue. A direction from NASA's guide.
  density: number // the haze of gas, in proportion to pressure. By definition.
  oxygenShare: number // the share of the haze that glows as oxygen. By definition.
  evidence: number // 0 is a ghost, 1 is solid, from the count of droplet tests in range
  flow: number // tracer speed, from the ventilation flow. By definition.
  stretch: number // the lean downwind. A direction from NASA's guide.
}

export type FlameParams = {
  inputs: FlameInputs
  steadiness: Steadiness
  ghost: boolean
  shape: 'fireball' | 'earth'
  gravityBadge: string | null
  tempTopKelvin: number | null
  lookup: FlameLookup
  nearestText: string | null
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
export const VIGOR_RANGE = { calm: 0.3, fierce: 0.75 }

export function flameParams(scenario: Scenario, tests: Test[]): FlameParams {
  const point = scenarioPoint(scenario)
  const lookup = flameLookup(tests, point)
  const rate = lookup.burningRate.value
  const share = lookup.extinction.of.length > 0 ? lookup.extinction.ended.length / lookup.extinction.of.length : 0
  const steadiness: Steadiness = share > 0.9 ? 'failing' : share >= 0.5 ? 'struggling' : 'steady'
  const count = lookup.dropletsInRange.length
  const tad = lookup.flameTemperature.value
  const nearest = lookup.nearestDroplet
  return {
    inputs: {
      vigor: rate == null ? 0.25 : clamp01((rate - VIGOR_RANGE.calm) / (VIGOR_RANGE.fierce - VIGOR_RANGE.calm)),
      tempTop: tad == null ? kelvinToT(2300) : kelvinToT(tad),
      stability: clamp01(1 - share),
      soot: clamp01((scenario.o2 - 0.17) / 0.17),
      density: clamp01(scenario.pressurePsi / 14.7),
      oxygenShare: clamp01(scenario.o2),
      evidence: clamp01(count / 10),
      flow: clamp01(scenario.flowCmS / 50),
      stretch: clamp01(scenario.flowCmS / 50) * 0.35,
    },
    steadiness,
    ghost: count === 0,
    shape: scenario.gravity === 1 ? 'earth' : 'fireball',
    gravityBadge: scenario.gravity === 0.166 || scenario.gravity === 0.38 ? 'No partial-gravity tests exist. This is the microgravity shape.' : null,
    tempTopKelvin: tad,
    lookup,
    nearestText:
      nearest && nearest.test.o2 != null && nearest.test.pressureAtm != null
        ? `${Math.round(nearest.test.o2 * 1000) / 10} percent oxygen and ${Math.round(atmToPsi(nearest.test.pressureAtm) * 10) / 10} psi`
        : null,
  }
}
