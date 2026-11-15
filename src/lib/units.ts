// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Atmosphere units. 1 atm = 101.325 kPa = 14.696 psi = 760 mmHg. 1 bar = 0.98692 atm.

export const PSI_PER_ATM = 14.696
export const KPA_PER_ATM = 101.325
export const MMHG_PER_ATM = 760
export const ATM_PER_BAR = 0.98692
export const NORMOXIC_PPO2_ATM = 0.2095

export const psiToAtm = (psi: number): number => psi / PSI_PER_ATM
export const atmToPsi = (atm: number): number => atm * PSI_PER_ATM
export const mmHgToAtm = (mmHg: number): number => mmHg / MMHG_PER_ATM
export const barToAtm = (bar: number): number => bar * ATM_PER_BAR
export const atmToKpa = (atm: number): number => atm * KPA_PER_ATM

// Oxygen partial pressure, in the same unit as the pressure given.
export const ppO2 = (o2Fraction: number, pressure: number): number => o2Fraction * pressure

// The oxygen fraction that gives sea level oxygen partial pressure at this pressure.
export const normoxicO2 = (pressureAtm: number): number => NORMOXIC_PPO2_ATM / pressureAtm

export function formatPercent(fraction: number, digits = 1): string {
  return `${trimZeros((fraction * 100).toFixed(digits))}%`
}

export function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

export function formatNumber(value: number, digits = 1): string {
  return trimZeros(value.toFixed(digits))
}

export function formatCount(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return 'not listed'
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index += 1
  }
  return `${index === 0 ? String(value) : value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
}
