// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Turns the raw PSI records and tables into the snapshot the site reads. Deterministic, no network.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { csvParseRows } from 'd3-dsv'
import {
  cleanFuel,
  decodeBytes,
  findHeader,
  normalizeHeader,
  parseBreOxygenList,
  parseNumber,
  parseOxygenPercents,
} from '../../src/lib/parse.ts'
import { barToAtm, mmHgToAtm } from '../../src/lib/units.ts'
import { byAccession, median, round } from '../../src/lib/stats.ts'
import { shortHash } from './util.mjs'

const GENERATED_BY =
  'Built from the NASA PSI repository by the EMBER pipeline. Code and plain summaries were SI drafted and reviewed by the team.'

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'))

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const pad = (n) => String(n).padStart(2, '0')

// PSI dates look like 31-Jul-2016 or 07-31-2016. Both become ISO dates.
export function toIsoDate(text) {
  const value = String(text || '').trim()
  let m = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`
  m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`
  return null
}

const LABEL_CORRECTIONS = [
  {
    file: 'FLEX.csv',
    original: 'O initial ambient composition; mole fraction',
    corrected: 'O2 initial ambient composition; mole fraction',
    reason: 'The subscript was lost in the file. The column holds the oxygen mole fraction.',
  },
  {
    file: 'FLEX.csv',
    original: 'N initial ambient composition; mole fraction',
    corrected: 'N2 initial ambient composition; mole fraction',
    reason: 'The subscript was lost in the file. The column holds the nitrogen mole fraction.',
  },
  {
    file: 'FLEX.csv',
    original: 'CO initial ambient composition; mole fraction',
    corrected: 'CO2 initial ambient composition; mole fraction',
    reason: 'The subscript was lost in the file. The FLEX record says the suppressants were carbon dioxide and helium, so this column is carbon dioxide.',
  },
  {
    file: 'FLEX.csv',
    original: 'Burning rate; mm',
    corrected: 'Burning rate constant; mm²/s',
    reason: 'The unit lost its superscript and its time. EMBER reads it as the burning rate constant in mm² per second. The team confirms this from the publication.',
  },
  { file: 'SAFFIRE-2.csv', original: '?-g Burn Length', corrected: 'µg Burn Length', reason: 'The micro sign was lost in the file.' },
  { file: 'SAFFIRE-2.csv', original: '?-g Spread Length', corrected: 'µg Spread Length', reason: 'The micro sign was lost in the file.' },
]

function displayHeaderFor(file, header) {
  const clean = normalizeHeader(header)
  const hit = LABEL_CORRECTIONS.find((c) => file.endsWith(c.file) && c.original === clean)
  return hit ? { displayHeader: hit.corrected, corrected: true } : { displayHeader: clean, corrected: false }
}

// Per table: how to read the label, the fuel, the atmosphere and the extra values.
const num = (cell) => parseNumber(cell).value
const TABLE_RULES = [
  {
    match: 'FLEX.csv',
    label: (g) => g('FLEX Identifier') || g('FLEX Test #'),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      const o2 = parseNumber(g('O initial ambient composition'))
      t.setO2(o2.value, o2)
      const mmHg = num(g('Ambient pressure'))
      t.setPressure(mmHg && mmHg > 0 ? mmHgToAtm(mmHg) : null)
      t.diluent = { n2: num(g('N initial')) ?? 0, co2: num(g('CO initial')) ?? 0, he: num(g('He initial')) ?? 0 }
      t.extra.d0 = num(g('Droplet initial diameter'))
      t.extra.dExt = num(g('Visible flame extinction diameter'))
      t.extra.K = num(g('Burning rate'))
      t.extra.burnTime = num(g('Burn time'))
      t.extra.pressureMmHg = mmHg
      t.outcome = g('Test end') || null
      t.flags.push('label-corrected')
    },
  },
  {
    match: 'BASS-II.csv',
    label: (g) => g('Test #'),
    fuel: (g) => g('Fuel Sample Material'),
    read(g, t) {
      const o2 = parseNumber(g('Calibrated initial O2'))
      t.setO2(o2.value == null ? null : o2.value / 100, o2)
      t.extra.o2Final = num(g('Calibrated final O2'))
      t.extra.co2Final = num(g('Final CO2'))
      t.extra.coFinal = num(g('Final CO (ppm)'))
      t.extra.pi = g('PI') || null
    },
  },
  {
    match: 'CFI.csv',
    label: (g) => g('Flex Number'),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      const o2 = parseNumber(g('Oxygen'))
      t.setO2(o2.value, o2)
      t.setPressure(num(g('Pressure')))
      t.diluent = { n2: num(g('Nitrogen')) ?? 0, he: num(g('Helium')) ?? 0 }
      t.extra.fiber = g('Fiber') || null
    },
  },
  {
    match: 'CFI-G_Inverse Flames.csv',
    label: (g) => g('Test'),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      const o2 = parseNumber(g('XO2'))
      t.setO2(o2.value, o2)
      const bar = num(g('approx p (bar)'))
      t.setPressure(bar == null ? null : barToAtm(bar))
      t.extra.tad = num(g('Tad (K)'))
      t.extra.inverse = true
      const hot = g('Hot ignition')
      t.outcome = hot ? `Hot ignition: ${hot}` : null
      t.flags.push('oxidizer-stream')
    },
  },
  {
    match: 'CFI-G_Normal Flames.csv',
    label: (g) => g('Test'),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      const o2 = parseNumber(g('XO2 before test'))
      t.setO2(o2.value, o2)
      const bar = num(g('approx p (bar)'))
      t.setPressure(bar == null ? null : barToAtm(bar))
      t.extra.tad = num(g('Tad (K)'))
      t.extra.coolFlame = g('Cool flame?') || null
      t.outcome = g('Self-ext or flow term') || null
    },
  },
  {
    match: 'Flame Design_Normal Flame.csv',
    label: (g) => g('Test'),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      const o2 = parseNumber(g('XO2 (init)'))
      t.setO2(o2.value, o2)
      const mean = num(g('pmean (atm)'))
      // Twenty propane rows list only the starting pressure. It is used and flagged.
      if (mean != null) t.setPressure(mean)
      else if (num(g('pinit (atm)')) != null) {
        t.setPressure(num(g('pinit (atm)')))
        t.flags.push('pressure-from-pinit')
      }
      t.extra.tad = num(g('Tad (K)'))
    },
  },
  {
    match: 'Flame Design_Inverse Flame.csv',
    label: (g) => g('Test'),
    // This table has no fuel column. Its headers XC2H4 name ethylene as the fuel gas.
    fuel: () => 'C2H4',
    read(g, t) {
      const o2 = parseNumber(g('XO2'))
      t.setO2(o2.value, o2)
      t.setPressure(num(g('pmean (atm)')))
      t.extra.tad = num(g('Tad (K)'))
      t.extra.inverse = true
      t.flags.push('oxidizer-stream')
    },
  },
  {
    match: 'ACME BRE.csv',
    label: (g) => [g('Year'), g('Month'), g('Date')].filter(Boolean).join(' '),
    fuel: (g) => g('Fuel Bottle'),
    split(g) {
      return parseBreOxygenList(g('Oxygen Conc (percent)')).map((v) => ({ o2: v.value / 100, typoFixed: v.typoFixed }))
    },
    read(g, t) {
      t.extra.burnerMm = num(g('Burner Size (mm)'))
      t.extra.flamesIgnited = num(g('Flames Ignited'))
      t.extra.dayLevel = true
    },
  },
  {
    match: 'SAFFIRE-1.csv',
    label: (g) => g('Sample Number'),
    fuel: (g) => g('Material'),
    read(g, t) {
      const o2 = parseNumber(g('Percent O2'))
      t.setO2(o2.value == null ? null : o2.value / 100, o2)
      t.flowCmS = num(g('Air Flow'))
      t.extra.direction = (g('Flow Direction') || '').trim() || null
      t.extra.burnTimeS = num(g('Burn Time'))
    },
  },
  {
    match: 'SAFFIRE-2.csv',
    label: (g) => g('Sample Number'),
    fuel: (g) => g('Material'),
    inheritFuel: true,
    read(g, t) {
      const o2 = parseNumber(g('Percent O2'))
      t.setO2(o2.value == null ? null : o2.value / 100, o2)
      t.flowCmS = num(g('Air Flow'))
      t.extra.direction = (g('Flow Direction') || '').trim() || null
      t.extra.thickness = g('Samle Thickness') || null
      const lengthCm = num(g('Sample Length'))
      const ug = g('?-g Burn Length')
      const g1 = g('1-g Burn Length')
      t.extra.sampleLengthCm = lengthCm
      t.extra.ugBurnLengthRaw = ug || null
      t.extra.g1BurnLengthRaw = g1 || null
      t.extra.ugBurnLengthCm = /^complete/i.test(ug) ? lengthCm : num(ug)
      t.extra.g1BurnLengthCm = /^complete/i.test(g1) ? lengthCm : num(g1)
      t.extra.ugSpreadLength = g('?-g Spread Length') || null
      t.extra.g1SpreadRate = g('1-g Spread Rate') || null
      t.flags.push('label-corrected')
    },
  },
  {
    match: 'SAFFIRE-3.csv',
    label: (g) => g('Sample Number'),
    fuel: (g) => g('Material'),
    read(g, t) {
      t.flowCmS = num(g('Air Flow'))
      t.extra.direction = (g('Direction') || '').trim() || null
    },
  },
  {
    match: 'ACME s-Flame.csv',
    label: (g) => g('Test Day'),
    fuel: (g) => fixFill(g('Fuel Bottle'), /\bN[3-9]\b/g, 'N2'),
    split(g) {
      return parseOxygenPercents(g('Atmosphere')).map((v) => ({ o2: v / 100, approximate: true }))
    },
    read(g, t) {
      t.extra.atmosphere = fixFill(g('Atmosphere'), /\bN[3-9]\b/g, 'N2') || null
      if (/\bN[3-9]\b/.test(g('Fuel Bottle') + g('Atmosphere'))) t.flags.push('typo-fixed')
      t.extra.flamesIgnited = num(g('Flames Ignited'))
      t.extra.dayLevel = true
    },
  },
  { match: 'BASS.csv', label: (g) => g('Test #'), fuel: (g) => g('Fuel Sample Material'), read() {} },
  {
    match: 'SAME.csv',
    label: (g) => g('Sample #'),
    fuel: (g) => g('Sample Material'),
    read(g, t) {
      t.flowCmS = num(g('Air Flow'))
      t.extra.agingMin = num(g('Aging Duration'))
    },
  },
  {
    match: 'SAME-R.csv',
    label: (g) => g('SAME Test #'),
    fuel: (g) => g('Sample Type'),
    read(g, t) {
      t.flowCmS = num(g('Inlet velocity'))
      t.extra.netAgingS = num(g('Net aging time'))
      t.extra.durationS = num(g('Duration'))
    },
  },
  { match: 'DAFT.csv', label: (g) => g('Session Name'), fuel: (g) => g('Sample Material'), read() {} },
  {
    match: 'Spice.csv',
    label: (g) => `day ${g('GMT date')} ${g('GMT ignition')}`.trim(),
    fuel: (g) => g('Fuel'),
    read(g, t) {
      t.flowCmS = num(g('Air Rate'))
      t.extra.nozzleMm = num(g('Nozzle'))
    },
  },
  { match: 'Slice.csv', label: (g) => g('Test Date'), fuel: (g) => g('Fuel Type'), read() {} },
  {
    match: 'CLD Flame.csv',
    label: (g) => g('Test Day'),
    // The file counts up through CH5, CH6 and so on, a spreadsheet fill error. The fuel is fixed and flagged.
    fuel: (g) => fixFill(fixFill(g('Fuel Bottle'), /\bCH([5-9]|1\d)\b/g, 'CH4'), /\bC2H([5-9]|1\d)\b/g, 'C2H4'),
    read(g, t) {
      if (/\bCH([5-9]|1\d)\b|\bC2H([5-9]|1\d)\b/.test(g('Fuel Bottle'))) t.flags.push('typo-fixed')
    },
  },
  {
    match: 'E-FIELD Flames.csv',
    label: (g) => g('Test Day'),
    fuel: (g) => g('Fuel Bottle'),
    read(g, t) {
      t.extra.polarity = g('Mesh Polarity') || null
    },
  },
  { match: 'Flex2.csv', label: (g) => g('Sample (Fuel Type)'), fuel: (g) => g('Sample (Fuel Type)'), read() {} },
  {
    match: 'Data Summary Table.csv',
    label: (g) => `Data ${g('Data ID')}`,
    fuel: () => null,
    read(g, t) {
      t.extra.description = g('Data Description') || null
    },
  },
]

function fixFill(text, pattern, replacement) {
  return String(text || '').replace(pattern, replacement)
}

function ruleFor(file) {
  // Longer names first, so "SAME-R.csv" is not read by the "SAME.csv" rule.
  const sorted = [...TABLE_RULES].sort((a, b) => b.match.length - a.match.length)
  return sorted.find((r) => file.endsWith(`_${r.match}`) || file.endsWith(r.match)) || null
}

// A note row has a label in its first cell and almost nothing else, such as "Note 1 ...".
function isNoteRow(cells, columnCount) {
  const filled = cells.filter((c) => c.trim() !== '').length
  if (/^note\s*\d/i.test(cells[0] || '')) return true
  return columnCount >= 6 && filled <= 2 && cells[0].trim() !== ''
}

// A continuation row leaves its first cells empty and carries on from the row above.
function isContinuationRow(cells, columnCount) {
  const filled = cells.filter((c) => c.trim() !== '').length
  return columnCount >= 6 && filled <= 2 && cells[0].trim() === ''
}

function profileColumn(file, header, values, rowCount) {
  const nonEmptyValues = values.filter((v) => v.trim() !== '')
  const counts = new Map()
  const clean = normalizeHeader(header)
  for (const v of nonEmptyValues) {
    const key = v.replace(/\s+/g, ' ').trim()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const parsed = nonEmptyValues.map((v) => parseNumber(v))
  const numbers = parsed.filter((p) => p.value != null && p.exact).map((p) => p.value)
  const numeric = nonEmptyValues.length > 0 && numbers.length / nonEmptyValues.length >= 0.8
  const unitCounts = new Map()
  for (const p of parsed) if (p.unit) unitCounts.set(p.unit, (unitCounts.get(p.unit) || 0) + 1)
  const unit = [...unitCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null
  const distinct = counts.size
  const namesAnId = /(#|number|identifier|\bid\b|\bdate\b|\bgmt\b|local time|session|test day|^test$|^cir$)/i.test(clean)
  let klass
  if (distinct <= 1) klass = 'constant'
  else if (namesAnId && distinct > 2) klass = 'identifier'
  else if (numeric && distinct > 12) klass = 'continuous'
  else if (distinct >= 0.9 * rowCount && rowCount > 12) klass = 'identifier'
  else if (distinct >= 2 && distinct <= 12) klass = 'factor'
  else klass = 'notes'
  const topValues = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 12)
    .map(([value, count]) => ({ value, count }))
  return {
    header: clean,
    ...displayHeaderFor(file, header),
    nonEmpty: nonEmptyValues.length,
    distinct,
    numeric,
    min: numeric ? Math.min(...numbers) : null,
    median: numeric ? median(numbers) : null,
    max: numeric ? Math.max(...numbers) : null,
    unit,
    klass,
    topValues,
  }
}

function normalizeTable({ root, accession, file, tableIndex, fuelClass, assumption }) {
  const text = decodeBytes(readFileSync(join(root, 'data/raw/tables', file)))
  const rows = csvParseRows(text)
  const headers = rows[0].map((h) => normalizeHeader(h))
  const rule = ruleFor(file)
  const tests = []
  const noteRows = []
  const dataRows = []
  let lastFuel = null
  let lastRaw = null
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = headers.map((_, i) => String(rows[rowIndex][i] ?? ''))
    if (cells.every((c) => c.trim() === '')) continue
    const raw = {}
    headers.forEach((h, i) => {
      raw[h] = cells[i].trim()
    })
    if (isNoteRow(cells, headers.length)) {
      noteRows.push({ rowIndex, cells: raw })
      continue
    }
    dataRows.push(cells)
    const continuation = lastRaw != null && isContinuationRow(cells, headers.length)
    const carried = continuation ? lastRaw : null
    const get = (prefix) => {
      const h = findHeader(headers, prefix)
      if (h == null) return ''
      return raw[h] === '' && carried ? carried[h] : raw[h]
    }
    if (!continuation) lastRaw = raw
    let fuel = cleanFuel(rule ? rule.fuel(get) : null)
    const flagsBase = continuation ? ['continuation'] : []
    if (!fuel && rule?.inheritFuel && lastFuel) {
      fuel = lastFuel
      flagsBase.push('material-inherited')
    }
    if (fuel) lastFuel = fuel
    const variants = rule?.split ? rule.split(get) : [null]
    const list = variants.length === 0 ? [null] : variants
    list.forEach((variant, k) => {
      const suffix = list.length > 1 ? String.fromCharCode(97 + k) : ''
      const t = {
        id: `${accession}:${tableIndex}:${rowIndex}${suffix}`,
        accession,
        table: file,
        rowIndex,
        label: String((rule ? rule.label(get) : '') || `row ${rowIndex}`).trim(),
        fuel,
        fuelClass,
        o2: null,
        o2Source: null,
        pressureAtm: null,
        pressureSource: null,
        flowCmS: null,
        diluent: null,
        outcome: null,
        extra: {},
        raw,
        flags: [...flagsBase],
      }
      const helper = {
        ...t,
        setO2(value, parsed) {
          if (value == null || !(value >= 0 && value <= 1)) return
          t.o2 = round(value, 6)
          t.o2Source = 'table'
          if (parsed?.approximate) t.flags.push('approximate')
          if (parsed?.isRange) t.flags.push('range')
        },
        setPressure(value) {
          if (value == null || !(value > 0)) return
          t.pressureAtm = round(value, 6)
          t.pressureSource = 'table'
        },
      }
      // The helper shares the extra and flags objects with the test, so rules can write to them.
      helper.extra = t.extra
      helper.flags = t.flags
      if (rule) rule.read(get, helper)
      t.flowCmS = helper.flowCmS
      t.diluent = helper.diluent
      t.outcome = helper.outcome
      if (variant) {
        helper.setO2(variant.o2, { approximate: Boolean(variant.approximate) })
        t.flags.push('day-level')
        if (variant.typoFixed) t.flags.push('typo-fixed')
      }
      if (assumption) {
        if (t.o2 == null && assumption.o2 != null) {
          t.o2 = assumption.o2
          t.o2Source = 'assumed'
        }
        if (t.pressureAtm == null && assumption.pressureAtm != null) {
          t.pressureAtm = assumption.pressureAtm
          t.pressureSource = 'assumed'
        }
      }
      // A pressure with no oxygen value cannot be plotted. Keep it, marked as it is.
      t.flags = [...new Set(t.flags)].sort()
      if (t.flags.length === 0) delete t.flags
      tests.push(t)
    })
  }
  const columns = headers.map((h, i) => profileColumn(file, h, dataRows.map((r) => r[i]), dataRows.length))
  return { tests, profile: { accession, table: file, rows: dataRows.length, columns, noteRows }, rowCount: dataRows.length + noteRows.length }
}

function buildInvestigation(record, manual, hasThumb) {
  const pillars = manual.pillars.investigations.find((p) => p.accession === record.accession)
  if (!pillars) throw new Error(`No pillars.json entry for ${record.accession}`)
  const summary = manual.summaries.summaries[record.accession]
  if (!summary) throw new Error(`No summary for ${record.accession}`)
  const informs = manual.equipment.informs.find((e) => e.accession === record.accession)?.tags ?? []
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
    : String(record.keywords || '').split(/[,;]\s*/)
  const text = (v) => String(v || '').replace(/\r/g, '').trim()
  return {
    accession: record.accession,
    displayName: pillars.displayName || record.investigationAcronym || record.accession,
    acronym: record.investigationAcronym ? String(record.investigationAcronym).trim() : null,
    title: text(record.title),
    doi: record.doi ? String(record.doi).trim() : null,
    license: record.licenseIdentifier
      ? { id: record.licenseIdentifier, name: record.licenseName || '', link: record.licenseLink || '' }
      : null,
    projectType: text(record.projectType),
    subResearchArea: text(record.subResearchArea) || null,
    flightProgram: text(record.flightProgram) || null,
    managingCenter: text(record.managingNasaCenter) || null,
    startDate: toIsoDate(record.investigationStartDate),
    endDate: toIsoDate(record.investigationEndDate),
    releaseDate: toIsoDate(record.releaseDate),
    modifiedDate: toIsoDate(record.modifiedDate),
    objective: text(record.objective),
    approach: text(record.approach),
    hypothesis: text(record.hypothesis),
    researchImpacts: text(record.researchImpacts),
    experimentHardware: text(record.experimentHardware),
    experimentHardwareLink: text(record.experimentHardwareLink) || null,
    keywords: keywords.map((k) => String(k).trim()).filter(Boolean),
    related: String(record.related_glds || '').split(',').map((s) => s.trim()).filter(Boolean),
    contacts: (record.contacts || []).map((c) => ({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      affiliation: c.affiliation || '',
      role: c.role || '',
    })),
    publications: (record.publications || []).map((p) => ({
      title: text(p.title),
      authors: text(p.authorList),
      doi: p.doi && String(p.doi).trim() ? String(p.doi).trim() : null,
    })),
    tables: [],
    files: record.fileCounts || null,
    totalFileSizeBytes: record.totalFileSize == null ? null : Math.round(Number(record.totalFileSize)),
    thumbnail: hasThumb ? `/img/psi/${record.accession}.png` : null,
    pillar: pillars.pillar,
    secondaryPillars: pillars.secondaryPillars,
    fuelClass: pillars.fuelClass,
    hardwareFamily: pillars.hardwareFamily,
    informs,
    summary: { ...summary, generatedBy: 'SI drafted, checked against PSI data', reviewed: false },
    testCount: 0,
    psiUrl: `https://psi.nasa.gov/physci/repo/data/investigations/${record.accession}`,
  }
}

export function loadManual(root) {
  return {
    pillars: readJson(root, 'data/manual/pillars.json'),
    summaries: readJson(root, 'data/manual/summaries.json'),
    equipment: readJson(root, 'data/manual/equipment.json'),
    habitats: readJson(root, 'data/manual/habitats.json'),
    defaults: readJson(root, 'data/manual/atmosphere-defaults.json'),
    glossary: readJson(root, 'data/manual/glossary.json'),
    resources: readJson(root, 'data/manual/resources.json'),
  }
}

export function buildSnapshot(root) {
  const manifest = readJson(root, 'data/raw/manifest.json')
  const manual = loadManual(root)
  const accessions = manifest.files
    .filter((f) => f.path.startsWith('data/raw/investigations/'))
    .map((f) => f.path.split('/').pop().replace('.json', ''))
    .sort(byAccession)
  const investigations = []
  const tests = []
  const tableProfiles = []
  let rows = 0
  let tables = 0
  for (const accession of accessions) {
    const record = readJson(root, `data/raw/investigations/${accession}.json`)
    const inv = buildInvestigation(record, manual, existsSync(join(root, 'public/img/psi', `${accession}.png`)))
    const assumption = manual.defaults.defaults.find((d) => d.accession === accession) || null
    const files = [...(record.experimentalTable || []), ...(record.modelingTable || [])].map((t) => t.file_name)
    files.forEach((file, tableIndex) => {
      if (!existsSync(join(root, 'data/raw/tables', file))) return
      const out = normalizeTable({ root, accession, file, tableIndex, fuelClass: inv.fuelClass, assumption })
      tests.push(...out.tests)
      tableProfiles.push(out.profile)
      inv.tables.push({ file, rows: out.profile.rows })
      inv.testCount += out.tests.length
      rows += out.rowCount
      tables += 1
    })
    investigations.push(inv)
  }
  const projectTypes = {}
  for (const inv of investigations) projectTypes[inv.projectType] = (projectTypes[inv.projectType] || 0) + 1
  const body = {
    schemaVersion: 1,
    buildId: '',
    fetchedAt: manifest.fetchedAt,
    generatedBy: GENERATED_BY,
    counts: {
      investigations: investigations.length,
      tables,
      rows,
      tests: tests.length,
      testsWithOxygen: tests.filter((t) => t.o2 != null).length,
      testsWithAssumedOxygen: tests.filter((t) => t.o2Source === 'assumed').length,
      testsWithAssumedValue: tests.filter((t) => t.o2Source === 'assumed' || t.pressureSource === 'assumed').length,
      projectTypes,
    },
    investigations,
    tests,
    tableProfiles,
    habitats: manual.habitats.habitats,
    assumptions: manual.defaults.defaults,
    labelCorrections: LABEL_CORRECTIONS.map((c) => {
      const profile = tableProfiles.find((p) => p.table.endsWith(c.file))
      return { accession: profile?.accession ?? '', table: profile?.table ?? c.file, original: c.original, corrected: c.corrected, reason: c.reason }
    }),
    glossary: manual.glossary.terms,
    hardwareFamilies: manual.pillars.hardwareFamilies,
    equipmentTags: manual.equipment.tags,
    equipmentBasis: manual.equipment.informs,
    resources: manual.resources.resources,
    context: manual.resources.context,
    quotes: manual.resources.quotes,
  }
  body.buildId = shortHash(JSON.stringify(body))
  return body
}

const CSV_COLUMNS = [
  'id', 'accession', 'investigation', 'table', 'row', 'label', 'fuel', 'fuel_class', 'o2_fraction', 'o2_source',
  'pressure_atm', 'pressure_source', 'flow_cm_s', 'n2_fraction', 'co2_fraction', 'he_fraction', 'outcome',
  'droplet_d0_mm', 'extinction_diameter_mm', 'burning_rate_mm2_s', 'burn_time_s', 'listed_flame_temperature_k', 'flags',
]

const csvCell = (value) => {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// The whole normalized dataset as one CSV, for download. Assumed values are marked in the source columns.
export function buildTestsCsv(snapshot) {
  const names = Object.fromEntries(snapshot.investigations.map((i) => [i.accession, i.displayName]))
  const lines = [CSV_COLUMNS.join(',')]
  for (const t of snapshot.tests) {
    const row = [
      t.id, t.accession, names[t.accession], t.table, t.rowIndex, t.label, t.fuel, t.fuelClass, t.o2, t.o2Source,
      t.pressureAtm, t.pressureSource, t.flowCmS, t.diluent?.n2, t.diluent?.co2, t.diluent?.he, t.outcome,
      t.extra.d0, t.extra.dExt, t.extra.K, t.extra.burnTime, t.extra.tad, (t.flags || []).join(' '),
    ]
    lines.push(row.map(csvCell).join(','))
  }
  return lines.join('\n') + '\n'
}

export function testsCsvColumns() {
  return CSV_COLUMNS
}
