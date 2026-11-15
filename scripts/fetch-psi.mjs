// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Downloads the NASA PSI combustion snapshot. Manual only. Never runs in a deploy.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvParseRows } from 'd3-dsv'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://psi.nasa.gov/geode-py/ws'
const USER_AGENT = 'space-apps-team-project'
const PAUSE_MS = 500
const TIMEOUT_MS = 60000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const manifestFiles = []

async function get(url, attempt = 1) {
  await sleep(PAUSE_MS)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    return { bytes, status: response.status, type: response.headers.get('content-type') || '' }
  } catch (error) {
    if (attempt >= 4) throw new Error(`Failed after 4 tries: ${url} (${error.message})`)
    await sleep(1000 * 2 ** attempt)
    return get(url, attempt + 1)
  }
}

async function save(relPath, bytes, url, status) {
  const full = join(ROOT, relPath)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, bytes)
  manifestFiles.push({
    path: relPath,
    url,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    status,
  })
}

function decode(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function countFiles(added) {
  if (!Array.isArray(added) || added.length === 0) return null
  const byCategory = {}
  const byExtension = {}
  for (const file of added) {
    const segments = String(file.remote_path || '').split('/')
    const category = segments[4] || 'Other'
    byCategory[category] = (byCategory[category] || 0) + 1
    const name = String(file.file_name || '')
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : 'none'
    byExtension[ext] = (byExtension[ext] || 0) + 1
  }
  return { total: added.length, byCategory, byExtension }
}

function trimRecord(record, listing) {
  const tables = (record.experimentalTable || []).map((t) => ({ file_name: t.file_name, file_size: t.file_size }))
  return {
    accession: record.accession,
    title: record.title,
    investigationAcronym: record.investigationAcronym,
    doi: record.doi,
    licenseIdentifier: record.licenseIdentifier,
    licenseName: record.licenseName,
    licenseLink: record.licenseLink,
    objective: record.objective,
    approach: record.approach,
    hypothesis: record.hypothesis,
    researchImpacts: record.researchImpacts,
    experimentHardware: record.experimentHardware,
    experimentHardwareLink: record.experimentHardwareLink,
    flightProgram: record.flightProgram,
    projectType: record.projectType,
    researchArea: record.researchArea,
    subResearchArea: record.subResearchArea,
    managingNasaCenter: record.managingNasaCenter,
    investigationStartDate: record.investigationStartDate,
    investigationEndDate: record.investigationEndDate,
    releaseDate: record.releaseDate,
    modifiedDate: record.modifiedDate,
    related_glds: record.related_glds,
    totalFileSize: record.totalFileSize,
    version: record.version,
    keywords: listing['Keywords'] ?? null,
    // Email addresses are dropped here on purpose. Only names, affiliation and role are kept.
    contacts: (record.contacts || []).map((c) => ({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      affiliation: c.affiliation || '',
      role: (c.roles || []).map((r) => r.annotationValue).filter(Boolean).join(', '),
    })),
    publications: (record.publications || []).map((p) => ({
      title: p.title || '',
      authorList: p.authorList || '',
      doi: p.doi || '',
    })),
    experimentalTable: tables,
    modelingTable: (record.modelingTable || []).map((t) => ({ file_name: t.file_name, file_size: t.file_size })),
    images: (record.images || []).map((i) => ({ file_name: i.file_name })),
    fileCounts: countFiles(record.added),
  }
}

async function main() {
  const fetchedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const listUrl = `${BASE}/repo/search?source=psi&type=investigation&from=0&size=300`
  const list = JSON.parse((await get(listUrl)).bytes.toString('utf8'))
  const all = list.hits.hits.map((h) => h._source)
  const combustion = all.filter((s) => String(s['Research Area'] || '').toLowerCase() === 'combustion science')
  console.log(`${all.length} investigations listed, ${combustion.length} in Combustion Science`)
  if (combustion.length < 20) throw new Error('Tripwire: fewer than 20 combustion records')

  const sorted = combustion.sort((a, b) => Number(a.Accession.split('-')[1]) - Number(b.Accession.split('-')[1]))
  let tableCount = 0
  for (const listing of sorted) {
    const accession = listing.Accession
    const url = `${BASE}/repo/investigations/${accession}`
    const fetched = await get(url)
    const record = JSON.parse(fetched.bytes.toString('utf8'))
    const trimmed = trimRecord(record, listing)
    await save(
      `data/raw/investigations/${accession}.json`,
      Buffer.from(JSON.stringify(trimmed, null, 2) + '\n'),
      url,
      fetched.status,
    )

    for (const table of [...trimmed.experimentalTable, ...trimmed.modelingTable]) {
      const tableUrl = `${BASE}/studies/${accession}/download?source=datamanager&file=${encodeURIComponent(table.file_name)}`
      const got = await get(tableUrl)
      try {
        const rows = csvParseRows(decode(got.bytes).replace(/^﻿/, ''))
        if (rows.length < 2) throw new Error('no rows')
      } catch (error) {
        throw new Error(`Tripwire: ${table.file_name} does not parse as CSV (${error.message})`)
      }
      // The stored URL leaves out the signed redirect target, which is short lived.
      await save(`data/raw/tables/${table.file_name}`, got.bytes, tableUrl, got.status)
      tableCount += 1
    }

    // The image endpoint is not fetched. On 14 November 2026 it returned the same NASA program badge
    // for every record. That is NASA branding, which the event rules bar, so EMBER draws its own
    // neutral tile for each investigation instead.
    console.log(`${accession} done, ${trimmed.experimentalTable.length} table(s)`)
  }
  if (tableCount < 18) throw new Error('Tripwire: fewer than 18 tables')

  manifestFiles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const manifest = {
    fetchedAt,
    userAgent: USER_AGENT,
    source: 'NASA Physical Sciences Informatics (PSI) repository, psi.nasa.gov',
    counts: { listed: all.length, combustion: combustion.length, tables: tableCount },
    files: manifestFiles,
  }
  await writeFile(join(ROOT, 'data/raw/manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote manifest with ${manifestFiles.length} files, ${tableCount} tables`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
