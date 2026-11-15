// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Request checks for POST /api/ask.
import type { AskRequest, Gravity } from '../src/types.ts'
import { CONFIG } from './config.ts'

export type Validated = { ok: true; value: AskRequest } | { ok: false; status: number; code: string; message: string }

const ID_PATTERN = /^(S|I\d{1,3}|PSI-\d{1,4}|(G|H|M|HW|C)-[a-z0-9-]{1,48})$/
const GRAVITIES = [0, 0.166, 0.38, 1]

export const isEvidenceId = (id: unknown): id is string => typeof id === 'string' && ID_PATTERN.test(id)

const bad = (message: string): Validated => ({ ok: false, status: 400, code: 'bad_request', message })

export function validateBody(text: string): Validated {
  if (new TextEncoder().encode(text).length > CONFIG.maxBodyBytes) {
    return { ok: false, status: 413, code: 'too_large', message: 'The request body is too large.' }
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return bad('The request body is not JSON.')
  }
  if (typeof body !== 'object' || body === null) return bad('The request body is not an object.')
  const b = body as Record<string, unknown>
  if (typeof b.question !== 'string') return bad('A question is required.')
  const question = b.question.replace(/\s+/g, ' ').trim()
  if (question.length < 1) return bad('A question is required.')
  if (question.length > CONFIG.maxQuestionChars) return bad(`A question may hold at most ${CONFIG.maxQuestionChars} characters.`)
  if (!Array.isArray(b.evidenceIds) || b.evidenceIds.length < 1) return bad('At least one evidence id is required.')
  if (b.evidenceIds.length > CONFIG.maxEvidenceIds) return bad(`At most ${CONFIG.maxEvidenceIds} evidence ids may be sent.`)
  const s = b.scenario as Record<string, unknown> | undefined
  if (typeof s !== 'object' || s === null) return bad('A scenario is required.')
  const o2 = Number(s.o2)
  const pressurePsi = Number(s.pressurePsi)
  const gravity = Number(s.gravity)
  if (!(o2 >= 0.12 && o2 <= 1)) return bad('The scenario oxygen is out of range.')
  if (!(pressurePsi >= 3 && pressurePsi <= 15)) return bad('The scenario pressure is out of range.')
  if (!GRAVITIES.includes(gravity)) return bad('The scenario gravity is out of range.')
  const presetId = typeof s.presetId === 'string' && /^[a-z-]{1,24}$/.test(s.presetId) ? s.presetId : null
  if (b.use !== undefined && b.use !== 'backup') return bad('The use field may only be "backup".')
  return {
    ok: true,
    value: {
      question,
      scenario: { presetId, o2, pressurePsi, gravity: gravity as Gravity },
      // Only strings are kept. Evidence text is never accepted from the browser.
      evidenceIds: b.evidenceIds.filter((id): id is string => typeof id === 'string'),
      ...(b.use === 'backup' ? { use: 'backup' as const } : {}),
    },
  }
}
