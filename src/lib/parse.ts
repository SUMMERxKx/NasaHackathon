// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// One tolerant number parser for the PSI tables. It never throws.

export type Parsed = {
  value: number | null
  raw: string
  approximate: boolean
  isRange: boolean
  unit: string | null
  // True when the whole cell is a number, with at most a unit or a range after it.
  exact: boolean
}

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/

// A cell is a number only if, after trimming and an optional ~, < or >, it starts with a digit,
// a minus sign or a decimal point. Digits later in the text do not count, so "LOW O2" is null.
export function parseNumber(cell: string | null | undefined): Parsed {
  const raw = cell == null ? '' : String(cell)
  let text = raw.trim()
  const result: Parsed = { value: null, raw, approximate: false, isRange: false, unit: null, exact: false }
  if (text === '') return result
  const lead = text.match(/^[~<>≈]\s*/)
  if (lead) {
    result.approximate = true
    text = text.slice(lead[0].length)
  }
  const match = text.match(NUMBER)
  if (!match) return result
  const value = Number(match[0])
  if (!Number.isFinite(value)) return result
  const after = text.slice(match[0].length)
  // Dates and clock times such as 2/19/2014, 14:37:08 and 9-Mar-17 are not numbers.
  if (/^[/:]\d/.test(after) || /^-[A-Za-z]/.test(after)) return result
  result.value = value
  const rest = after.trim()
  if (rest === '') {
    result.exact = true
    return result
  }
  if (/^(?:-|–|to\b)\s*~?\s*-?\.?\d/i.test(rest)) {
    result.isRange = true
    result.exact = true
    return result
  }
  const unit = rest.match(/^(%|[A-Za-zµ°][A-Za-zµ°0-9/²]*)/)
  if (unit) {
    result.unit = unit[0]
    result.exact = rest.length === unit[0].length
  }
  return result
}

export type ListValue = { value: number; typoFixed: boolean }

// The ACME BRE oxygen column holds a list per test day such as "21; 26.5; 40".
// Values such as "3400%" and "2100%" are typos for 34 and 21. This fix applies to that column only.
export function parseBreOxygenList(cell: string): ListValue[] {
  const out: ListValue[] = []
  for (const part of String(cell || '').split(/[;,]/)) {
    const parsed = parseNumber(part)
    if (parsed.value == null) continue
    if (parsed.value > 100) out.push({ value: parsed.value / 100, typoFixed: true })
    else out.push({ value: parsed.value, typoFixed: false })
  }
  return out
}

// Finds every percentage that is followed by O2 in a text such as "~30% and ~21% O2 with He".
export function parseOxygenPercents(cell: string): number[] {
  const text = String(cell || '')
  const end = text.search(/O2/i)
  if (end < 0) return []
  const out: number[] = []
  for (const match of text.slice(0, end).matchAll(/(\d+(?:\.\d+)?)\s*%/g)) out.push(Number(match[1]))
  return out
}

export function decodeBytes(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function normalizeHeader(header: string): string {
  return String(header || '').replace(/\s+/g, ' ').trim()
}

// Loose header match: case-insensitive, by prefix, after collapsing spaces.
export function findHeader(headers: string[], prefix: string): string | null {
  const want = normalizeHeader(prefix).toLowerCase()
  for (const header of headers) {
    if (normalizeHeader(header).toLowerCase().startsWith(want)) return header
  }
  return null
}

// "75 % Propylene" and "75% Propylene" are one fuel.
export function cleanFuel(name: string | null | undefined): string | null {
  if (name == null) return null
  const text = String(name)
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/%(?=[A-Za-z])/g, '% ')
    .replace(/(: | including | where | in combination ).*$/, '')
    .trim()
  if (text === '' || /^(n\/a|none|-)$/i.test(text)) return null
  return text
}

// Groups free-text sample names into material families for counts and search.
export function materialFamily(fuel: string | null): string {
  const text = String(fuel || '').toLowerCase()
  if (text === '') return 'Not stated'
  if (/sibal|cotton/.test(text)) return 'Cotton and fiberglass fabric (SIBAL)'
  if (/nomex/.test(text)) return 'Nomex'
  if (/candle|wax/.test(text)) return 'Candle wax'
  if (/sphere/.test(text)) return 'PMMA spheres'
  if (/rod/.test(text)) return 'PMMA rods'
  if (/film|micron|0\.\d mm/.test(text)) return 'PMMA films'
  if (/pmma|slab/.test(text)) return 'PMMA sheets and slabs'
  if (/silicone/.test(text)) return 'Silicone'
  return 'Other materials'
}
